import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { CONFIG_LIMITS, JSON_LIMITS, checkText } from '../src/index.js';
import { ASSETS, allowed, asset, cli, config, configText, feed, run, twap, withFiles } from './helpers.js';

// Each test builds input meant to make the tool slow or to exhaust the stack or the memory, and checks that it ends with
// an answer in good time. The time allowed is four times as long under coverage (NODE_V8_COVERAGE is set only when
// coverage is on).

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

// A made-up address from a number, so that a thousand assets get a thousand addresses.
const nth = (i) => `0x${i.toString(16).padStart(40, '0').replace(/^0/, 'f')}`;

test('a thousand assets, all compared with each other for shared feeds, are checked in good time', () => {
  const many = Array.from({ length: CONFIG_LIMITS.maxAssets }, (_, i) => asset({ name: `A${i}`, feed: feed({ address: nth(i) }), fallback: twap({ address: nth(i + 5000) }) }));
  const { value, ms } = timed(() => checkText(configText(config({}, many))));
  assert.equal(value.config.assets.length, CONFIG_LIMITS.maxAssets);
  assert.deepEqual(value.findings, []);
  assert.ok(ms < allowed(10000), `took ${ms} ms`);
  const same = Array.from({ length: CONFIG_LIMITS.maxAssets }, (_, i) => asset({ name: `A${i}` }));
  const dup = timed(() => checkText(configText(config({}, same))));
  assert.equal(dup.value.findings.filter((f) => f.id === 'feed-shared').length, CONFIG_LIMITS.maxAssets - 1);
  assert.ok(dup.ms < allowed(10000), `took ${dup.ms} ms`);
});

test('deep nesting ends with an error finding at the limit, never a stack overflow, and the secret scan does not recurse', () => {
  const deep = `${'['.repeat(100000)}${']'.repeat(100000)}`;
  const { value } = timed(() => checkText(deep));
  assert.equal(value.findings[0].id, 'config-unreadable');
  assert.match(value.findings[0].message, new RegExp(`nested more than ${JSON_LIMITS.maxDepth} deep`));
  const nested = `{"notes": ${'['.repeat(JSON_LIMITS.maxDepth - 1)}"x"${']'.repeat(JSON_LIMITS.maxDepth - 1)}, "protocol": "p", "assets": []}`;
  const r = checkText(nested);
  assert.ok(r.findings.some((f) => f.id === 'field-invalid' && /notes/.test(f.message)));
  const keyed = `{"privateKey": ${'{"a": '.repeat(JSON_LIMITS.maxDepth - 1)}1${'}'.repeat(JSON_LIMITS.maxDepth - 1)}}`;
  assert.equal(checkText(keyed).findings.filter((f) => f.id === 'secret-in-config').length, 1);
});

test('numbers with very many digits or a huge exponent are refused as a field, not worked out', () => {
  const huge = config({}, [asset({ maxStaleness: 1e300, minPrice: 1e300 }), ...ASSETS.slice(1)]);
  const text = configText(huge).split('1e+300').join(`1${'0'.repeat(5000)}`);
  const { value, ms } = timed(() => checkText(text));
  const f = value.findings.filter((x) => x.id === 'field-invalid');
  assert.equal(f.length, 2);
  assert.match(f[0].message, /The maxStaleness of asset WETH on ethereum is the number 1000000000000000000000000000000000000\.\.\./);
  assert.ok(ms < allowed(3000), `took ${ms} ms`);
  assert.ok(checkText(configText(config({}, [asset({ maxPrice: 1 }), ...ASSETS.slice(1)])).replace('"maxPrice": 1,', '"maxPrice": 1e999999,')).findings.some((x) => x.id === 'field-invalid'));
  const decimals = checkText(configText(config({}, [asset({ referencePrice: 1 }), ...ASSETS.slice(1)])).replace('"referencePrice": 1,', `"referencePrice": 0.${'1'.repeat(5000)},`));
  assert.ok(decimals.findings.some((x) => x.id === 'field-invalid' && /referencePrice/.test(x.message)));
});

test('long strings and long lines are read in good time', () => {
  const long = configText(config({ notes: 'a '.repeat(200000) }, [asset({ name: 'n'.repeat(200000) }), ...ASSETS.slice(1)]));
  const { value, ms } = timed(() => checkText(long));
  assert.deepEqual(value.findings, []);
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
  const address = checkText(configText(config({}, [asset({ feed: feed({ address: `0x${'1'.repeat(200000)}` }) }), ...ASSETS.slice(1)])));
  const f = address.findings.find((x) => x.id === 'address-malformed');
  assert.ok(f.message.length < 600);
});

test('names such as __proto__, constructor and toString are only names', () => {
  const text = configText(config({}, [asset({ name: '__proto__' }), asset({ name: 'constructor', network: 'toString', feed: feed({ address: `0x${'d'.repeat(40)}` }), fallback: twap({ address: `0x${'e'.repeat(40)}` }) }), asset({ name: 'toString', role: 'borrowable', fallback: undefined, feed: feed({ address: `0x${'b'.repeat(40)}` }) })])).replace('"protocol": "Test Lending",', '"protocol": "Test Lending", "__proto__": {"polluted": 1}, "hasOwnProperty": 2,');
  const { value } = timed(() => checkText(text));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'network-not-in-table' && /"toString"/.test(f.message)));
  assert.deepEqual(value.config.assets.map((a) => a.name), ['__proto__', 'constructor', 'toString']);
  assert.equal({}.polluted, undefined);
});

test('a run leaves the folder as it was: the tool writes nothing', async () => {
  const files = { 'oracles.json': configText(config()) };
  await withFiles(files, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli(['oracles.json', '--format', 'sarif'], dir);
    await cli(['oracles.json', '--json', '--explain'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
  assert.equal((await run(files, ['oracles.json'])).code, 0);
});
