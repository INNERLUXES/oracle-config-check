import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEST, DEFAULT_HEARTBEAT_MARGIN, RULES, addressProblem, analyzeConfig, checkText, duration, readConfig, readJson } from '../src/index.js';
import { ASSETS, FULL_CHECKS, addr, asset, config, configText, feed, idsOf, lineOf, ofCheck, sequencer, twap, withAsset } from './helpers.js';

// The configuration with the first asset (WETH on Ethereum, used as collateral) replaced.
const only = (a) => withAsset(a, 0);
const BP = /This is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum\.org\./;
// An asset on Arbitrum, a rollup, with every other field fine.
const onArb = (over = {}) => asset({ network: 'arbitrum', sequencer: sequencer(), ...over });

test('every check has an id, a level, a kind, a summary and a fix, and the ids are unique', () => {
  assert.equal(RULES.length, 23);
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const r of RULES) {
    assert.ok(['error', 'warning', 'info'].includes(r.severity), r.id);
    assert.ok(['documented', 'best practice', 'input'].includes(r.kind), r.id);
    assert.ok(r.summary.length > 20 && r.fix.length > 20, r.id);
  }
});

test('the configuration of the helpers gives no finding, and every finding of a check is at the line of its field', () => {
  assert.deepEqual(idsOf(config()), []);
  const c = only(asset({ scaleDecimals: 18 }));
  assert.equal(ofCheck(c, 'decimals-mismatch')[0].line, lineOf(configText(c), '"scaleDecimals"'));
});

test('staleness-missing: no maxStaleness, or answer checks without updatedAt; not when both are there, and not for a feed with no heartbeat', () => {
  const c = only(asset({ maxStaleness: undefined }));
  const f = ofCheck(c, 'staleness-missing');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(configText(c), '\n    {') + 1);
  assert.match(f[0].message, /^Asset WETH on ethereum has no maxStaleness, so the protocol takes an answer of any age; its feed has a heartbeat of 3,600 seconds \(1 hour\)/);
  const g = ofCheck(only(asset({ answerChecks: ['answerPositive'] })), 'staleness-missing');
  assert.match(g[0].message, /^The answer checks of asset WETH on ethereum do not list updatedAt, so the maxStaleness of the configuration is never compared/);
  assert.deepEqual(ofCheck(only(asset()), 'staleness-missing'), []);
  assert.deepEqual(ofCheck(only(asset({ maxStaleness: undefined, feed: twap(), fallback: undefined })), 'staleness-missing'), [], 'a TWAP has no heartbeat');
  assert.deepEqual(ofCheck(only(asset({ maxStaleness: undefined, feed: { type: 'custom', address: addr('1'), decimals: 8 } })), 'staleness-missing'), [], 'a custom feed with no heartbeat');
  assert.equal(ofCheck(only(asset({ maxStaleness: undefined, feed: { type: 'custom', address: addr('1'), decimals: 8, heartbeat: 3600 } })), 'staleness-missing').length, 1);
  assert.deepEqual(ofCheck(only(asset({ maxStaleness: 'x' })), 'staleness-missing'), [], 'an invalid value is a field-invalid finding only');
});

test('staleness-too-long: past the heartbeat and the margin; the margin itself passes, and --heartbeat-margin moves the limit', () => {
  const at = (s, options) => ofCheck(only(asset({ maxStaleness: s })), 'staleness-too-long', options).filter((f) => f.entry === 'WETH on ethereum');
  assert.equal(at(3961).length, 1);
  assert.deepEqual(at(3960), [], 'the heartbeat of 3,600 plus 10 percent');
  assert.match(at(7200)[0].message, /^Asset WETH on ethereum accepts answers up to 7,200 seconds \(2 hours\) old, but the configuration gives its feed a heartbeat of 3,600 seconds \(1 hour\); with the margin of 10 percent the limit is 3,960 seconds \(66 minutes\)\./);
  assert.equal(at(3601, { heartbeatMargin: 0 }).length, 1);
  assert.deepEqual(at(7200, { heartbeatMargin: 100 }), []);
  assert.equal(DEFAULT_HEARTBEAT_MARGIN, 10);
  assert.deepEqual(ofCheck(only(asset({ maxStaleness: 999999, feed: feed({ heartbeat: undefined }) })), 'staleness-too-long'), [], 'no heartbeat, no comparison');
});

test('staleness-below-heartbeat: below or equal to the heartbeat; one second above passes', () => {
  const at = (s) => ofCheck(only(asset({ maxStaleness: s })), 'staleness-below-heartbeat');
  assert.match(at(60)[0].message, /^Asset WETH on ethereum accepts answers up to 60 seconds \(1 minute\) old, shorter than the heartbeat of its feed, 3,600 seconds \(1 hour\)\./);
  assert.match(at(3600)[0].message, /old, equal to the heartbeat of its feed\. .*for a while before every heartbeat round/);
  assert.deepEqual(at(3601), []);
  assert.equal(at(0).length, 1);
});

test('bounds-missing: no minPrice, no maxPrice, or a minPrice of 0; both above 0 pass', () => {
  assert.match(ofCheck(only(asset({ minPrice: undefined, maxPrice: undefined })), 'bounds-missing')[0].message, /^Asset WETH on ethereum has no minPrice and no maxPrice, so an answer far outside/);
  assert.match(ofCheck(only(asset({ maxPrice: undefined })), 'bounds-missing')[0].message, /has no maxPrice, so/);
  const zero = only(asset({ minPrice: 0 }));
  assert.equal(ofCheck(zero, 'bounds-missing')[0].line, lineOf(configText(zero), '"minPrice"'));
  assert.match(ofCheck(zero, 'bounds-missing')[0].message, /The minPrice of asset WETH on ethereum is 0, so an answer of 0/);
  assert.deepEqual(ofCheck(only(asset({ minPrice: 0.000001 })), 'bounds-missing'), []);
  assert.deepEqual(ofCheck(only(asset({ role: 'borrowable', feed: { type: 'fixed', price: 1 }, fallback: undefined, minPrice: undefined, maxPrice: undefined })), 'bounds-missing'), [], 'a fixed price has no answer to bound');
});

test('bounds-inverted: a minPrice equal to or above the maxPrice; one step below passes', () => {
  assert.match(ofCheck(only(asset({ minPrice: 30, maxPrice: 5, referencePrice: undefined })), 'bounds-inverted')[0].message, /^The maxPrice of asset WETH on ethereum is 5, below its minPrice of 30, so no price passes the bounds/);
  assert.match(ofCheck(only(asset({ minPrice: 1, maxPrice: 1.0, referencePrice: undefined })), 'bounds-inverted')[0].message, /is 1, equal to its minPrice of 1, so only one price passes/);
  assert.deepEqual(ofCheck(only(asset({ minPrice: 0.99, maxPrice: 1, referencePrice: undefined })), 'bounds-inverted'), []);
  assert.match(ofCheck(only(asset({ minPrice: 30, maxPrice: 5 })), 'bounds-inverted')[0].message, BP);
  assert.deepEqual(ofCheck(only(asset({ minPrice: 30, maxPrice: 5 })), 'bounds-exclude-reference'), [], 'inverted bounds are not also compared with the reference');
});

test('bounds-exclude-reference: a referencePrice below or above the bounds; on the bounds it passes', () => {
  assert.match(ofCheck(only(asset({ referencePrice: 99.99 })), 'bounds-exclude-reference')[0].message, /^The referencePrice of asset WETH on ethereum is 99\.99, below its minPrice of 100:/);
  assert.match(ofCheck(only(asset({ referencePrice: 100000.01 })), 'bounds-exclude-reference')[0].message, /is 100000\.01, above its maxPrice of 100000:/);
  assert.deepEqual(ofCheck(only(asset({ referencePrice: 100 })), 'bounds-exclude-reference'), []);
  assert.deepEqual(ofCheck(only(asset({ referencePrice: 100000 })), 'bounds-exclude-reference'), []);
  assert.equal(ofCheck(only(asset({ maxPrice: undefined, referencePrice: 50 })), 'bounds-exclude-reference').length, 1, 'one bound is compared on its own');
  assert.deepEqual(ofCheck(only(asset({ referencePrice: undefined })), 'bounds-exclude-reference'), []);
});

test('decimals-mismatch: scaleDecimals other than the decimals of the feed, both ways; the same, or "feed", passes', () => {
  assert.match(ofCheck(only(asset({ scaleDecimals: 18 })), 'decimals-mismatch')[0].message, /^Asset WETH on ethereum scales the answer by 18 decimals, but its feed answers with 8: every price is too low by a factor of 10,000,000,000, which lets positions be liquidated at once\./);
  assert.match(ofCheck(only(asset({ scaleDecimals: 6 })), 'decimals-mismatch')[0].message, /too high by a factor of 100, which lets borrowers take far more/);
  assert.deepEqual(ofCheck(only(asset({ scaleDecimals: 8 })), 'decimals-mismatch'), []);
  assert.deepEqual(ofCheck(only(asset({ scaleDecimals: 'feed' })), 'decimals-mismatch'), []);
  assert.deepEqual(ofCheck(only(asset({ scaleDecimals: 18, feed: twap(), fallback: undefined })), 'decimals-mismatch'), [], 'a TWAP with no decimals given');
  assert.equal(ofCheck(only(asset({ scaleDecimals: 18, feed: twap({ decimals: 8 }) })), 'decimals-mismatch').length, 1);
});

test('sequencer-check-missing: an asset on a rollup with no sequencer check or with the check off; on a chain, or with the check on, it passes', () => {
  const none = only(onArb({ sequencer: undefined }));
  const f = ofCheck(none, 'sequencer-check-missing');
  assert.equal(f[0].line, lineOf(configText(none), '"arbitrum"'));
  assert.match(f[0].message, /^Asset WETH on arbitrum is priced on Arbitrum, a rollup with a sequencer uptime feed, but the configuration declares no sequencer check\./);
  const off = only(onArb({ sequencer: { checked: false } }));
  assert.equal(ofCheck(off, 'sequencer-check-missing')[0].line, lineOf(configText(off), '"checked"'));
  assert.match(ofCheck(off, 'sequencer-check-missing')[0].message, /turns the sequencer check off/);
  assert.deepEqual(ofCheck(only(onArb()), 'sequencer-check-missing'), []);
  assert.deepEqual(ofCheck(only(asset({ network: 'polygon' })), 'sequencer-check-missing'), []);
  for (const net of ['base', 'op', 'scroll', 'zksync', 'x-layer', 'celo', 'mantle', 'metis', 'soneium', 'megaeth']) assert.equal(ofCheck(only(asset({ network: net })), 'sequencer-check-missing').length, 1, net);
  assert.deepEqual(ofCheck(only(onArb({ role: 'borrowable', feed: { type: 'fixed', price: 1 }, fallback: undefined, sequencer: undefined })), 'sequencer-check-missing'), [], 'a fixed price reads no feed');
});

test('sequencer-grace-missing: a sequencer check with no grace period or one of 0; one second passes', () => {
  const none = only(onArb({ sequencer: sequencer({ gracePeriod: undefined }) }));
  assert.equal(ofCheck(none, 'sequencer-grace-missing')[0].line, lineOf(configText(none), '"sequencer"'));
  assert.match(ofCheck(none, 'sequencer-grace-missing')[0].message, /^The sequencer check of asset WETH on arbitrum has no gracePeriod, so prices are used the moment the sequencer is back/);
  const zero = only(onArb({ sequencer: sequencer({ gracePeriod: 0 }) }));
  assert.equal(ofCheck(zero, 'sequencer-grace-missing')[0].line, lineOf(configText(zero), '"gracePeriod"'));
  assert.match(ofCheck(zero, 'sequencer-grace-missing')[0].message, /has a gracePeriod of 0/);
  assert.deepEqual(ofCheck(only(onArb({ sequencer: sequencer({ gracePeriod: 1 }) })), 'sequencer-grace-missing'), []);
  assert.deepEqual(ofCheck(only(asset({ sequencer: sequencer({ gracePeriod: 0 }) })), 'sequencer-grace-missing'), [], 'not judged on a chain with no sequencer');
});

test('answered-in-round-deprecated: answeredInRound in the answer checks, at its own line; without it, nothing', () => {
  const c = only(asset({ answerChecks: [...FULL_CHECKS, 'answeredInRound'] }));
  const f = ofCheck(c, 'answered-in-round-deprecated');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(configText(c), '"answeredInRound"'));
  assert.match(f[0].message, /list answeredInRound, which the Chainlink API reference marks as deprecated/);
  assert.deepEqual(ofCheck(only(asset()), 'answered-in-round-deprecated'), []);
});

test('answer-checks-undeclared and answer-positive-unchecked: no answerChecks, or a list without answerPositive', () => {
  const none = ofCheck(only(asset({ answerChecks: undefined })), 'answer-checks-undeclared');
  assert.match(none[0].message, /^Asset WETH on ethereum is read through latestRoundData, but its configuration has no answerChecks/);
  assert.match(none[0].message, BP);
  const pos = ofCheck(only(asset({ answerChecks: ['updatedAt'] })), 'answer-positive-unchecked');
  assert.match(pos[0].message, /do not list answerPositive, so an answer of 0 or below would be used as a price/);
  assert.deepEqual(ofCheck(only(asset({ answerChecks: ['updatedAt', 'answerPositive'] })), 'answer-positive-unchecked'), []);
  assert.deepEqual(idsOf(only(asset({ answerChecks: undefined, feed: { type: 'custom', address: addr('1'), decimals: 8 } }))), [], 'a custom feed is not read through latestRoundData');
  assert.deepEqual(ofCheck(only(asset({ answerChecks: 'x' })), 'answer-checks-undeclared'), [], 'an invalid list is a field-invalid finding only');
});

test('address-malformed: every way an address can be wrong, for the feed, the fallback and the sequencer feed', () => {
  assert.equal(addressProblem(addr('1')), null);
  assert.equal(addressProblem(`0x${'A'.repeat(40)}`), null, 'either case');
  assert.equal(addressProblem(`0x${'1'.repeat(39)}`), 'has 39 characters after 0x, not 40');
  assert.equal(addressProblem(`0x${'1'.repeat(41)}`), 'has 41 characters after 0x, not 40');
  assert.equal(addressProblem(`1x${'1'.repeat(40)}`), 'does not start with 0x');
  assert.equal(addressProblem(`0x${'g'.repeat(40)}`), 'holds a character that is not a hex digit');
  assert.equal(addressProblem(`0x${'0'.repeat(40)}`), 'is the zero address');
  assert.equal(addressProblem(` ${addr('1')}`), 'has spaces around it');
  const c = only(onArb({ feed: feed({ address: '0x12' }), fallback: twap({ address: 'pool' }), sequencer: sequencer({ feed: `0x${'0'.repeat(40)}` }) }));
  const f = ofCheck(c, 'address-malformed');
  assert.deepEqual(f.map((x) => x.line), [lineOf(configText(c), '"0x12"'), lineOf(configText(c), '"pool"'), lineOf(configText(c), `"0x${'0'.repeat(40)}"`)]);
  assert.match(f[0].message, /^The address of the feed of asset WETH on arbitrum is "0x12", which has 2 characters after 0x, not 40; an address is 0x followed by 40 hex digits\./);
  assert.match(f[2].message, /The address of the sequencer uptime feed of asset WETH on arbitrum .* is the zero address/);
});

test('feed-shared: one address on one network for two assets; on two networks, or for one asset twice, it is not', () => {
  const c = config({}, [...ASSETS, asset({ name: 'stETH', feed: feed({ address: addr('1').toUpperCase().replace('0X', '0x') }), fallback: twap({ address: addr('e') }) })]);
  const f = ofCheck(c, 'feed-shared');
  assert.equal(f.length, 1, 'compared without case');
  assert.match(f[0].message, new RegExp(`^The feed of asset stETH on ethereum has the address of the feed of asset WETH on ethereum at line ${lineOf(configText(c), `"${addr('1')}"`)}, on the same network`));
  assert.deepEqual(ofCheck(config({}, [...ASSETS, asset({ name: 'stETH', network: 'polygon', fallback: twap({ address: addr('e') }) })]), 'feed-shared'), []);
  assert.equal(ofCheck(config({}, [...ASSETS, asset({ name: 'stETH', feed: feed({ address: addr('9') }), fallback: twap() })]), 'feed-shared').length, 1, 'a fallback shared with another asset counts');
  assert.deepEqual(ofCheck(only(asset({ fallback: feed() })), 'feed-shared'), [], 'one asset with the same feed twice is single-source-collateral');
});

test('single-source-collateral: collateral with no fallback, or a fallback that is the same feed; borrowable assets and real fallbacks pass', () => {
  const c = only(asset({ fallback: undefined }));
  const f = ofCheck(c, 'single-source-collateral');
  assert.equal(f[0].line, lineOf(configText(c), '"feed"'));
  assert.match(f[0].message, /^Asset WETH on ethereum is used as collateral and has one price source and no fallback/);
  const same = only(asset({ fallback: feed() }));
  assert.equal(ofCheck(same, 'single-source-collateral')[0].line, lineOf(configText(same), `"${addr('1')}"`, 2));
  assert.match(ofCheck(same, 'single-source-collateral')[0].message, /its fallback is the same feed as its primary feed/);
  assert.match(ofCheck(only(asset({ role: 'both', fallback: undefined })), 'single-source-collateral')[0].message, /is used as collateral and borrowed/);
  assert.deepEqual(ofCheck(only(asset({ role: 'borrowable', fallback: undefined })), 'single-source-collateral'), []);
  assert.deepEqual(ofCheck(only(asset({ fallback: feed({ address: addr('b') }) })), 'single-source-collateral'), []);
});

test('pegged-price-hardcoded: a fixed price on collateral, at the line of the type; a fixed price on a borrowable asset is not', () => {
  const c = only(asset({ name: 'USDC', feed: { type: 'fixed', pair: 'USDC / USD', price: 1 }, fallback: undefined }));
  const f = ofCheck(c, 'pegged-price-hardcoded');
  assert.equal(f[0].line, lineOf(configText(c), '"fixed"'));
  assert.match(f[0].message, /^The price of asset USDC on ethereum is fixed in the configuration at 1, and the asset is used as collateral: if it loses its peg/);
  assert.deepEqual(idsOf(c), ['pegged-price-hardcoded'], 'no other check of a feed is made for a fixed price');
  assert.match(ofCheck(only(asset({ role: 'both', feed: { type: 'fixed', price: 1 } })), 'pegged-price-hardcoded')[0].message, /used as collateral and borrowed/);
  assert.deepEqual(idsOf(only(asset({ role: 'borrowable', feed: { type: 'fixed', price: 1 }, fallback: undefined }))), []);
});

test('network-not-in-table: a network out of the table is a note at its line; one in the table, or an alias, is not', () => {
  const c = only(asset({ network: 'linea' }));
  const f = ofCheck(c, 'network-not-in-table');
  assert.equal(f[0].line, lineOf(configText(c), '"linea"'));
  assert.match(f[0].message, /^The network "linea" of asset WETH on linea is not in the tool's table \(ethereum, polygon, .*\), so whether it runs a sequencer that needs an uptime check was not judged\./);
  assert.deepEqual(idsOf(c), ['network-not-in-table']);
  assert.deepEqual(idsOf(only(asset({ network: 'mainnet' }))), []);
});

test('a feed that could not be read is named in a note, and its checks are left out', () => {
  const r = checkText(configText(only(asset({ feed: feed({ type: 'pyth' }) }))));
  assert.deepEqual(r.findings.map((f) => f.id), ['field-invalid']);
  assert.ok(r.notes.some((n) => /the feed of WETH on ethereum could not be read, so it was not checked/.test(n)));
  const missing = checkText(configText(only(asset({ feed: undefined }))));
  assert.ok(missing.notes.some((n) => /WETH on ethereum/.test(n)));
});

test('the best practice messages say so, and the documented ones do not', () => {
  const c = config({}, [asset({ fallback: undefined, minPrice: 30, maxPrice: 5, answerChecks: undefined, network: 'linea' }), asset({ name: 'USDC', feed: { type: 'fixed', price: 1 } })]);
  const found = checkText(configText(c)).findings;
  for (const f of found) {
    const rule = RULES.find((r) => r.id === f.id);
    if (rule.kind === 'best practice') assert.match(f.message, BP, f.id);
    else assert.doesNotMatch(f.message, BP, f.id);
  }
  assert.ok(found.length >= 5);
  assert.ok(BEST.startsWith('a best practice of this tool'));
});

test('analyzeConfig gives a row for every asset, with the values the table shows', () => {
  const { config: c } = readConfig(readJson(configText(config())));
  const { rows } = analyzeConfig(c);
  assert.deepEqual(rows[1], { asset: 'ARB', network: 'arbitrum', role: 'borrowable', feed: 'chainlink', fallback: null, heartbeat: 86400, maxStaleness: 90720, decimals: 8, scaleDecimals: 'feed', bounds: '0.01..100', sequencer: 'on, 3600s' });
  assert.equal(duration(86400), '86,400 seconds (24 hours)');
  assert.equal(duration(1260), '1,260 seconds (21 minutes)');
  assert.equal(duration(95040), '95,040 seconds');
  assert.equal(duration(1), '1 second');
  assert.equal(duration(90), '90 seconds');
});
