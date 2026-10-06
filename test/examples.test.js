import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/index.js';
import { BAD, EXPECTED, GOOD, GOOD_EXPECTED, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const BAD_FILE = 'examples/bad/oracles.json';
const GOOD_FILE = 'examples/good/oracles.json';

test('examples: the bad configuration fails with the report that is saved in examples/output', async () => {
  const r = await run(BAD);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('bad.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the good configuration passes at error and warning level with the report that is saved', async () => {
  const r = await run(GOOD);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('good.txt'));
  for (const e of GOOD_EXPECTED) assert.ok(r.out.includes(e), e);
  assert.equal((await run([...GOOD, '--fail-on', 'warning'])).code, 0);
  assert.equal((await run([...GOOD, '--fail-on', 'info'])).code, 1);
  assert.doesNotMatch(r.out, /ERROR {4}|WARNING {2}/);
});

test('examples: every output saved in examples/output is the real output, in all four formats for both configurations', async () => {
  const outputs = {
    'bad-explain.txt': [...BAD, '--explain'],
    'bad.md': [...BAD, '--format', 'markdown'],
    'bad-explain.md': [...BAD, '--format', 'markdown', '--explain'],
    'bad.json': [...BAD, '--json', '--explain'],
    'bad.sarif': [...BAD, '--format', 'sarif'],
    'good.md': [...GOOD, '--format', 'markdown'],
    'good.json': [...GOOD, '--json'],
    'good.sarif': [...GOOD, '--format', 'sarif'],
    'checks.txt': ['--list-checks'],
    'checks.json': ['--list-checks', '--format', 'json']
  };
  for (const [name, args] of Object.entries(outputs)) assert.equal((await run(args)).out, await saved(name), name);
});

test('examples: every check but one fires on the bad configuration, each on the line built for it', async () => {
  const report = JSON.parse((await run([...BAD, '--json'])).out);
  const lines = (await readFile(resolve(root, BAD_FILE), 'utf8')).split('\n');
  const at = (needle, n = 1) => {
    let seen = 0;
    for (let i = 0; i < lines.length; i += 1) if (lines[i].includes(needle) && (seen += 1) === n) return i + 1;
    throw new Error(`${needle} x${n}`);
  };
  // The line of the object of the n-th asset.
  const assetAt = (n) => at('    {', n);
  const of = (id) => report.findings.filter((f) => f.id === id).map((f) => f.line).sort((x, y) => x - y);
  assert.deepEqual(of('secret-in-config'), [at('"privateKey"')]);
  assert.deepEqual(of('staleness-too-long'), [at('"maxStaleness": 172800')]);
  assert.deepEqual(of('answered-in-round-deprecated'), [at('"answeredInRound"')]);
  assert.deepEqual(of('answer-positive-unchecked'), [at('"answerChecks"')]);
  assert.deepEqual(of('decimals-mismatch'), [at('"scaleDecimals": 18')]);
  assert.deepEqual(of('staleness-below-heartbeat'), [at('"maxStaleness": 3600')]);
  assert.deepEqual(of('sequencer-grace-missing'), [at('"sequencer"'), at('"gracePeriod": 0')]);
  assert.deepEqual(of('pegged-price-hardcoded'), [at('"type": "fixed"')]);
  assert.deepEqual(of('staleness-missing'), [at('"name": "ARB"') - 1]);
  assert.deepEqual(of('answer-checks-undeclared'), [at('"name": "ARB"') - 1]);
  assert.deepEqual(of('bounds-missing'), [at('"name": "ARB"') - 1]);
  assert.deepEqual(of('address-malformed'), [at('"0x5e0"')]);
  assert.deepEqual(of('bounds-inverted'), [at('"maxPrice": 5,')]);
  assert.deepEqual(of('single-source-collateral'), [at('"feed": {'), at(`"0x${'4'.repeat(40)}"`, 2)]);
  assert.deepEqual(of('bounds-exclude-reference'), [at('"referencePrice": 1.25')]);
  assert.deepEqual(of('feed-shared'), [at(`"0x${'7'.repeat(40)}"`, 2)]);
  assert.deepEqual(of('field-unknown'), [at('"Heartbeat"')]);
  assert.deepEqual(of('field-missing'), [at('"pair": "USDT / USD"') - 2]);
  assert.deepEqual(of('network-not-in-table'), [at('"linea"')]);
  assert.deepEqual(of('asset-duplicate'), [at('"name": "weth"')]);
  assert.deepEqual(of('sequencer-check-missing'), [at('"network": "arbitrum"'), at('"checked": false')]);
  assert.deepEqual(of('field-invalid'), [at('"collateralized"')]);
  assert.equal(assetAt(1), at('"name": "WETH"') - 1);
  assert.deepEqual(report.rules.filter((r) => r.findings === 0).map((r) => r.id), ['config-unreadable']);
  assert.equal(report.rules.length, RULES.length);
});

test('examples: the good configuration holds one note, and every asset of it is in the table with its feed', async () => {
  const report = JSON.parse((await run([...GOOD, '--json'])).out);
  assert.deepEqual(report.findings.map((f) => f.id), ['network-not-in-table']);
  assert.equal(report.table.length, 7);
  assert.ok(report.table.every((r) => r.feed === 'chainlink'));
  assert.deepEqual(report.protocol.networks, ['ethereum', 'arbitrum', 'base', 'linea']);
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same findings', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'oracle-config-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const ids = async () => JSON.parse((await run([...BAD, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`);
    const base = await ids();
    const text = await readFile(resolve(root, BAD_FILE), 'utf8');
    await writeFile(resolve(dir, BAD_FILE), text.split('\n').join('\r\n'));
    assert.deepEqual(await ids(), base);
    await writeFile(resolve(dir, BAD_FILE), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
    assert.deepEqual(await ids(), base);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('examples: the files are plain ASCII with LF line ends, made up, hold no key and no real address, and no year-like number', async () => {
  for (const f of [BAD_FILE, GOOD_FILE]) {
    const text = await readFile(resolve(root, f), 'utf8');
    assert.ok([...text].every((c) => c.charCodeAt(0) < 128), f);
    assert.ok(!text.includes('\r'), f);
    assert.doesNotMatch(text, /\b(?:19|20)\d{2}\b/, f);
    assert.doesNotThrow(() => JSON.parse(text), f);
    assert.match(text, /"notes": "A made-up configuration for the examples of oracle-config-check/, f);
    assert.match(text, /Every address is made up and is not a real feed, and the file holds no key and no seed\./, f);
    // Every address of the examples is 0x and one hex digit forty times, or the short one that is a finding.
    for (const m of text.matchAll(/"0x([0-9a-fA-F]*)"/g)) assert.ok(/^(.)\1{39}$/.test(m[1]) || m[1] === '5e0', m[0]);
  }
  const outputs = ['bad.txt', 'bad.json', 'bad.md', 'bad.sarif', 'bad-explain.txt', 'bad-explain.md'];
  for (const o of outputs) assert.ok(!(await saved(o)).includes('left out on purpose'), `${o} does not show the value under privateKey`);
});

test('examples: the sample output of the bad configuration is the one the README shows', async () => {
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const bad = await saved('bad.txt');
  assert.ok(readme.includes(bad.split('\n').slice(0, 31).join('\n')));
  assert.ok(readme.includes(bad.split('\n').slice(-6).join('\n')));
});
