import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_CHECKS, ASSET_KEYS, CONFIG_LIMITS, FEED_KEYS, FEED_TYPES, ROLES, SEQUENCER_KEYS, TOP_KEYS, checkText, cut, describe, readConfig, readJson, suggestKey } from '../src/index.js';
import { ASSETS, FULL_CHECKS, addr, asset, config, configText, feed, idsOf, lineOf, ofCheck, sequencer, twap, withAsset } from './helpers.js';

test('readConfig: the protocol and its assets, with the network, role, feed, fallback and every value of each', () => {
  const { config: c, findings } = readConfig(readJson(configText(config({ notes: 'made up' }))));
  assert.deepEqual(findings, []);
  assert.equal(c.protocol, 'Test Lending');
  assert.deepEqual(c.assets.map((a) => [a.name, a.network.id, a.role, a.feed.type, a.fallback?.type ?? null, a.maxStaleness, a.scaleDecimals]), [['WETH', 'ethereum', 'collateral', 'chainlink', 'twap', 3780, 8], ['ARB', 'arbitrum', 'borrowable', 'chainlink', null, 90720, 'feed'], ['USDC', 'base', 'both', 'chainlink', 'twap', 90720, 8]]);
  const weth = c.assets[0];
  assert.equal(weth.title, 'WETH on ethereum');
  assert.equal(weth.feed.address, addr('1'));
  assert.equal(weth.feed.heartbeat, 3600);
  assert.equal(weth.feed.decimals, 8);
  assert.deepEqual(weth.feed.deviation, { int: 5n, scale: 1 });
  assert.equal(weth.fallback.window, 1800);
  assert.deepEqual(weth.answerChecks.map((x) => x.value), FULL_CHECKS);
  assert.deepEqual(c.assets[1].sequencer.checked, true);
  assert.equal(c.assets[1].sequencer.gracePeriod, 3600);
});

test('the lists of keys, roles, answer checks and feed types', () => {
  assert.deepEqual(TOP_KEYS, ['protocol', 'assets', 'notes']);
  assert.deepEqual(ASSET_KEYS, ['name', 'network', 'role', 'feed', 'fallback', 'maxStaleness', 'minPrice', 'maxPrice', 'referencePrice', 'scaleDecimals', 'sequencer', 'answerChecks', 'notes']);
  assert.deepEqual(FEED_KEYS, ['type', 'pair', 'address', 'heartbeat', 'deviation', 'decimals', 'window', 'price', 'notes']);
  assert.deepEqual(SEQUENCER_KEYS, ['checked', 'feed', 'gracePeriod', 'notes']);
  assert.deepEqual(ROLES, ['collateral', 'borrowable', 'both']);
  assert.deepEqual(ANSWER_CHECKS, ['updatedAt', 'answerPositive', 'roundComplete', 'answeredInRound']);
  assert.deepEqual(FEED_TYPES.map((t) => `${t.id}:${t.needs.join('+')}`), ['chainlink:address+heartbeat+decimals', 'custom:address+decimals', 'twap:address+window', 'fixed:price']);
  assert.equal(CONFIG_LIMITS.maxAssets, 1000);
  assert.equal(cut('x'.repeat(200)).length, 120);
  assert.equal(describe({ kind: 'number', raw: '7' }), 'the number 7');
  assert.equal(describe({ kind: 'string', secret: true }), 'a value that is not shown');
});

test('config-unreadable: text that is not JSON and JSON that is not an object; not an object with fields missing', () => {
  for (const text of ['{"protocol": "a",}', '[1, 2]', '"protocol"', '{"a": 1, "a": 2}']) {
    const r = checkText(text);
    assert.deepEqual(r.findings.map((f) => f.id), ['config-unreadable'], text);
    assert.equal(r.config, null);
  }
  assert.match(checkText('[]').findings[0].message, /The file holds a list, not an oracle configuration/);
  assert.ok(!checkText('{}').findings.some((f) => f.id === 'config-unreadable'));
  assert.match(checkText('{"a": 1,\n "b": }').findings[0].message, /at line 2, column 7/);
});

test('field-missing: every field the checks need, at the line of the object that lacks it', () => {
  assert.equal(ofCheck(config({ protocol: undefined }), 'field-missing').length, 1);
  assert.match(ofCheck(config({ assets: undefined }), 'field-missing')[0].message, /has no assets/);
  assert.match(ofCheck(config({}, []), 'field-missing')[0].message, /an empty list; give at least one asset/);
  for (const key of ['name', 'network', 'role', 'feed', 'scaleDecimals']) {
    const c = withAsset(asset({ [key]: undefined }), 1);
    const f = ofCheck(c, 'field-missing');
    assert.equal(f.length, 1, key);
    assert.match(f[0].message, new RegExp(`^Asset 2 has no ${key}`));
    assert.equal(f[0].line, lineOf(configText(c), '\n    {', 2) + 1);
  }
  for (const key of ['fallback', 'maxStaleness', 'minPrice', 'maxPrice', 'referencePrice', 'sequencer', 'answerChecks']) assert.ok(!idsOf(withAsset(asset({ [key]: undefined }), 0)).includes('field-missing'), `${key} is not a field-missing finding`);
});

test('field-missing: the fields a feed type needs, named together', () => {
  assert.match(ofCheck(withAsset(asset({ feed: feed({ heartbeat: undefined, decimals: undefined }) }), 0), 'field-missing')[0].message, /The feed of asset WETH on ethereum is of type chainlink, which needs address, heartbeat, decimals; the configuration has no heartbeat and no decimals\./);
  assert.match(ofCheck(withAsset(asset({ fallback: twap({ window: undefined }) }), 0), 'field-missing')[0].message, /The fallback of asset WETH on ethereum is of type twap, which needs address, window/);
  assert.match(ofCheck(withAsset(asset({ feed: { type: 'fixed' }, role: 'borrowable' }), 0), 'field-missing')[0].message, /of type fixed, which needs price/);
  assert.match(ofCheck(withAsset(asset({ feed: feed({ type: undefined }) }), 0), 'field-missing')[0].message, /^The feed of asset WETH on ethereum has no type\./);
  assert.deepEqual(idsOf(withAsset(asset({ feed: { type: 'custom', address: addr('1'), decimals: 8 } }), 0)), [], 'a custom feed needs no heartbeat');
  assert.match(ofCheck(withAsset(asset({ network: 'arbitrum', sequencer: { checked: true, gracePeriod: 3600 } }), 0), 'field-missing')[0].message, /The sequencer check of asset WETH on arbitrum has no feed\./);
  assert.match(ofCheck(withAsset(asset({ network: 'arbitrum', sequencer: { feed: addr('5'), gracePeriod: 3600 } }), 0), 'field-missing')[0].message, /has no checked; write true/);
  assert.ok(!idsOf(withAsset(asset({ network: 'arbitrum', sequencer: { checked: false } }), 0)).includes('field-missing'), 'no feed is needed when the check is off');
});

test('field-unknown: a key the tool does not read, with the key it is probably meant to be, at every level', () => {
  assert.match(ofCheck(config({ protocols: 'x' }), 'field-unknown')[0].message, /The key "protocols" of the configuration is not one the tool reads.*Did you mean "protocol"\?/);
  assert.match(ofCheck(withAsset(asset({ MaxStaleness: 3780 }), 0), 'field-unknown')[0].message, /The key "MaxStaleness" of asset 1 .*Did you mean "maxStaleness"\?/);
  assert.match(ofCheck(withAsset(asset({ feed: feed({ Heartbeat: 3600 }) }), 0), 'field-unknown')[0].message, /The key "Heartbeat" of the feed of asset WETH on ethereum .*Did you mean "heartbeat"\?/);
  assert.match(ofCheck(withAsset(asset({ network: 'arbitrum', sequencer: sequencer({ grace: 3600 }) }), 0), 'field-unknown')[0].message, /The key "grace" of the sequencer check of asset WETH on arbitrum .*Did you mean "gracePeriod"\?/);
  assert.match(ofCheck(config({ zz: 1 }), 'field-unknown')[0].message, /reads, so its value was left out of every check\. The keys of the configuration are protocol, assets, notes\./);
  assert.equal(suggestKey('maxstale', ASSET_KEYS), 'maxStaleness');
  assert.equal(suggestKey('ty', FEED_KEYS), null);
  assert.equal(suggestKey('feeds', ASSET_KEYS), 'feed');
});

test('field-invalid: values of the wrong type or form, each named; near misses pass', () => {
  const msg = (a) => ofCheck(withAsset(a, 0), 'field-invalid').map((f) => f.message);
  assert.match(msg(asset({ role: 'lender' }))[0], /The role of asset WETH on ethereum is "lender"; it must be collateral, borrowable or both\./);
  assert.deepEqual(msg(asset({ role: ' Both ' })), [], 'case and outer spaces are fine');
  assert.match(msg(asset({ feed: feed({ type: 'pyth' }) }))[0], /The type of the feed of asset WETH on ethereum is "pyth", not one the tool knows; it must be one of chainlink, custom, twap, fixed\./);
  assert.match(msg(asset({ maxStaleness: '3780' }))[0], /The maxStaleness of asset WETH on ethereum is text; it must be a whole number of seconds from 0 to 100000000, written as a number\./);
  assert.match(msg(asset({ maxStaleness: 3780.5 }))[0], /the number 3780\.5/);
  assert.match(msg(asset({ maxStaleness: 100000001 }))[0], /the number 100000001/);
  assert.deepEqual(msg(asset({ maxStaleness: 100000000 })).length, 0);
  assert.match(msg(asset({ feed: feed({ decimals: 37 }) }))[0], /The decimals of the feed of asset WETH on ethereum is the number 37; it must be a whole number of decimals from 0 to 36\./);
  assert.match(msg(asset({ minPrice: -1 }))[0], /The minPrice of asset WETH on ethereum is the number -1; a price must be a plain decimal number/);
  assert.match(msg(asset({ maxPrice: 1e21 }))[0], /the number 1e\+21/);
  assert.match(msg(asset({ referencePrice: '3500' }))[0], /The referencePrice of asset WETH on ethereum is text/);
  assert.match(msg(asset({ feed: feed({ deviation: 0 }) }))[0], /The deviation of the feed of asset WETH on ethereum is 0; it must be a percent above 0 and up to 100\./);
  assert.match(msg(asset({ feed: feed({ deviation: 100.5 }) }))[0], /is 100\.5; it must be a percent/);
  assert.deepEqual(msg(asset({ feed: feed({ deviation: 100 }) })), []);
  assert.match(msg(asset({ scaleDecimals: 'auto' }))[0], /The scaleDecimals of asset WETH on ethereum is "auto"; it must be a whole number of decimals from 0 to 36, or "feed"\./);
  assert.deepEqual(msg(asset({ scaleDecimals: 'FEED' })), []);
  assert.match(msg(asset({ feed: feed({ address: 1 }) }))[0], /The address of the feed of asset WETH on ethereum is the number 1; it must be text\./);
  assert.match(msg(asset({ feed: feed({ window: 1800 }) }))[0], /The feed of asset WETH on ethereum is of type chainlink, which takes no window; the value was left out of every check\./);
  assert.match(msg(asset({ role: 'borrowable', feed: { type: 'fixed', price: 1, address: addr('1') } }))[0], /of type fixed, which takes no address/);
  assert.match(msg(asset({ feed: 'chainlink' }))[0], /The feed of asset WETH on ethereum is text; it must be an object with a type/);
  assert.match(msg(asset({ fallback: [] }))[0], /The fallback of asset WETH on ethereum is a list/);
  assert.match(msg(asset({ network: 'arbitrum', sequencer: true }))[0], /The sequencer of asset WETH on arbitrum is true; it must be an object/);
  assert.match(msg(asset({ network: 'arbitrum', sequencer: sequencer({ checked: 'yes' }) }))[0], /The checked of the sequencer check of asset WETH on arbitrum is text; it must be true or false\./);
  assert.match(msg(asset({ answerChecks: 'updatedAt' }))[0], /The answerChecks of asset WETH on ethereum are text; they must be a list of updatedAt, answerPositive, roundComplete, answeredInRound\./);
  assert.match(msg(asset({ answerChecks: [...FULL_CHECKS, 'priceFresh'] }))[0], /An answer check of asset WETH on ethereum is "priceFresh"; the answer checks are/);
  assert.deepEqual(msg(asset({ answerChecks: ['UPDATEDAT', ' answerpositive '] })), [], 'case and outer spaces are fine');
  assert.match(msg(asset({ notes: 3 }))[0], /The notes of asset WETH on ethereum are the number 3; they must be text\./);
  assert.match(ofCheck(config({ notes: [] }), 'field-invalid')[0].message, /The notes of the configuration are a list/);
  assert.match(ofCheck(config({ assets: {} }), 'field-invalid')[0].message, /The assets of the configuration are an object; they must be a list of objects\./);
  assert.match(ofCheck(config({}, [...ASSETS, 'x']), 'field-invalid')[0].message, /Asset 4 of the assets is text; an asset is an object/);
  assert.match(ofCheck(config({ protocol: true }), 'field-invalid')[0].message, /The protocol of the configuration is true; it must be text\./);
  assert.match(ofCheck(config({ protocol: ' ' }), 'field-invalid')[0].message, /The protocol of the configuration is empty\./);
});

test('field-invalid: more assets or answer checks than the limit', () => {
  const many = Array.from({ length: CONFIG_LIMITS.maxAssets + 2 }, (_, i) => asset({ name: `A${i}`, role: 'borrowable', fallback: undefined }));
  const r = checkText(configText(config({}, many)));
  assert.ok(r.findings.some((f) => f.id === 'field-invalid' && /1002 assets, more than the limit of 1000; only the first 1000 were read/.test(f.message)));
  assert.equal(r.config.assets.length, CONFIG_LIMITS.maxAssets);
  const checks = Array.from({ length: CONFIG_LIMITS.maxAnswerChecks + 1 }, () => 'updatedAt');
  assert.match(ofCheck(withAsset(asset({ answerChecks: checks }), 0), 'field-invalid')[0].message, /hold 21 values, more than the limit of 20/);
});

test('asset-duplicate: two assets of one name on one network, compared without case and outer spaces; another network is fine', () => {
  const c = config({}, [...ASSETS, asset({ name: ' weth ', network: 'Ethereum', feed: feed({ address: addr('9') }), fallback: twap({ address: addr('e') }) })]);
  const f = ofCheck(c, 'asset-duplicate');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(configText(c), '" weth "'));
  assert.match(f[0].message, new RegExp(`Asset 4 is  weth  on Ethereum, as is asset 1 at line ${lineOf(configText(c), '"WETH"')}`));
  assert.deepEqual(ofCheck(config({}, [...ASSETS, asset({ network: 'polygon', feed: feed({ address: addr('9') }), fallback: twap({ address: addr('e') }) })]), 'asset-duplicate'), []);
  assert.equal(ofCheck(config({}, [...ASSETS, asset({ network: 'mainnet', feed: feed({ address: addr('9') }), fallback: twap({ address: addr('e') }) })]), 'asset-duplicate').length, 1, 'an alias is the same network');
});
