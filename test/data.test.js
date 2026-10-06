import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEST, NETWORKS, POINTS, ROLLUPS, RULES, SOURCES, flat, grouped, listText, plural, pointPage, safeText, source } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');
const norm = (t) => t.replace(/\s+/g, ' ');

const PLACES = /^https:\/\/(?:docs\.chain\.link\/(?:data-feeds|architecture-overview)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?|ethereum\.org\/en\/developers\/docs\/smart-contracts\/security\/)$/;

test('every source has an address on docs.chain.link or ethereum.org, and no number that reads like a year', () => {
  for (const s of SOURCES) {
    assert.match(s.url, PLACES, s.id);
    assert.doesNotMatch(s.url, /(?<!(?:EIP|ERC)[- ]?)\b(?:19|20)\d{2}\b/i, s.id);
    assert.ok(s.title.length > 5);
  }
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.deepEqual(SOURCES.map((s) => s.id), ['chainlink-overview', 'chainlink-model', 'chainlink-api', 'chainlink-using', 'chainlink-l2', 'chainlink-selecting', 'ethereum-security']);
});

test('every source has a text copy under research/sources that starts with its address, and research/sources.md lists it', async () => {
  const notes = await read('research/sources.md');
  for (const s of SOURCES) {
    const copy = await read(s.file);
    assert.ok(copy.startsWith(`Source: ${s.url}\n`), s.file);
    assert.ok(copy.length > 1500, `${s.file} holds the page`);
    assert.ok(notes.includes(s.url), `research/sources.md lists ${s.id}`);
    assert.ok(notes.includes(s.file), `research/sources.md names ${s.file}`);
  }
});

test('every point belongs to a listed source, is written in a sentence of its own and is not a long quotation of its page', async () => {
  for (const [id, p] of Object.entries(POINTS)) {
    const page = source(p.source);
    assert.ok(page, `${id}: the source ${p.source}`);
    assert.equal(pointPage(id), page);
    assert.ok(p.text.length > 40 && p.text.length < 400, id);
    assert.match(p.text, /\.$/, id);
    const copy = norm(await read(page.file));
    // No run of 12 words of the point appears word for word in its page.
    const words = norm(p.text).split(' ');
    for (let i = 0; i + 12 <= words.length; i += 1) assert.ok(!copy.includes(words.slice(i, i + 12).join(' ')), `${id} quotes its page`);
  }
});

test('every point is used by a rule, and every basis of a rule is a point', () => {
  const used = new Set(RULES.flatMap((r) => r.basis));
  for (const id of Object.keys(POINTS)) assert.ok(used.has(id), `${id} is not used by a rule`);
  for (const id of used) assert.ok(Object.hasOwn(POINTS, id), `${id} is not a point`);
});

test('docs/rules-and-sources.md lists every page with its copy and every check with its level, kind and points', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const s of SOURCES) assert.ok(doc.includes(s.url) && doc.includes(s.file), s.id);
  for (const r of RULES) {
    const section = doc.split(/^## /m).find((p) => p.startsWith(`${r.id}\n`));
    assert.ok(section, r.id);
    assert.ok(section.includes(`- Level: ${r.severity}`), r.id);
    assert.ok(section.includes('- Cannot see: '), r.id);
    for (const b of r.basis) assert.ok(section.includes(POINTS[b].text), `${r.id}: ${b}`);
    if (r.kind === 'best practice') assert.ok(norm(section).includes(BEST), r.id);
    if (r.own) assert.ok(section.includes(r.own), `${r.id}: its own choice`);
  }
});

test('the documented checks name a page of Chainlink, the best practice checks say what is their own choice, and the input checks rest on no page', () => {
  for (const r of RULES.filter((x) => x.kind === 'documented')) {
    assert.ok(r.basis.length > 0, r.id);
    assert.ok(r.basis.every((b) => POINTS[b].source.startsWith('chainlink-')), r.id);
  }
  for (const r of RULES.filter((x) => x.kind === 'best practice')) assert.ok(r.own && r.own.includes(BEST), `${r.id} says what is its own choice`);
  for (const r of RULES.filter((x) => x.kind === 'input')) assert.deepEqual(r.basis, [], r.id);
});

test('the pages say what the documented checks rest on', async () => {
  const overview = norm(await read('research/sources/chainlink-data-feeds-overview.txt'));
  assert.ok(overview.includes('use the `updatedAt` value from the `latestRoundData()` function to make sure that the latest answer is recent enough for your application to use it'));
  assert.ok(overview.includes('pause operation or switch to an alternate operation mode'));
  assert.ok(overview.includes('when the heartbeat idle time has passed'));
  assert.ok(overview.includes('Some heartbeats are configured to last several hours'));
  assert.ok(overview.includes('there may be a slight delay for the latest round to get onchain'));
  assert.ok(overview.includes('Heartbeat and deviation thresholds can also differ for the same asset across different blockchains'));
  assert.ok(overview.includes('On most data feeds, these values are no longer used and they do not stop your application from reading the most recent answer.'));
  assert.ok(overview.includes('you must decide what limits are acceptable for your application'));
  const model = norm(await read('research/sources/chainlink-decentralized-data-model.txt'));
  assert.ok(model.includes('The first condition that is met triggers an update to the data.'));
  assert.ok(model.includes('Heartbeat Threshold: A new aggregation round starts after a specified amount of time from the last update.'));
  const api = norm(await read('research/sources/chainlink-data-feeds-api-reference.txt'));
  assert.ok(api.includes('Get the number of decimals present in the response value.'));
  assert.equal(api.split('`answeredInRound`: Deprecated - Previously used when answers could take multiple rounds to be computed').length - 1, 2, 'getRoundData and latestRoundData');
  assert.ok(api.includes('No timestamp is included to check data freshness.'));
  assert.ok(api.includes('This value is no longer used on most Data Feeds.'));
  const using = norm(await read('research/sources/chainlink-using-data-feeds.txt'));
  assert.ok(using.includes('If you are reading data feeds on L2 networks, you must * check the latest answer from the L2 Sequencer Uptime * Feed'));
  const l2 = norm(await read('research/sources/chainlink-l2-sequencer-uptime-feeds.txt'));
  assert.ok(l2.includes('Implement a grace period to prevent mass liquidations or unexpected disruptions.'));
  assert.ok(l2.includes('uint256 private constant GRACE_PERIOD_TIME = 3600;'));
  assert.ok(l2.includes('wait for the `GRACE_PERIOD_TIME` to pass before accepting answers from the data feed'));
  assert.ok(l2.includes('Chainlink is no longer expanding L2 Sequencer Uptime Feeds to additional networks.'));
  const selecting = norm(await read('research/sources/chainlink-selecting-quality-data-feeds.txt'));
  assert.ok(selecting.includes('Users of single-source feeds MUST implement additional safeguards such as value bounds, caps, circuit breakers, freshness checks, fallback behavior'));
  assert.ok(selecting.includes('the de-pegging of synthetic assets, stablecoins, and currencies from their intended exchange rates'));
  assert.ok(selecting.includes('evaluate setting an explicit valuation ceiling for each stablecoin'));
  assert.ok(selecting.includes('Decisions should be made on a case-by-case basis'));
  assert.ok(selecting.includes('> - `latestAnswer` will return `0` > - `latestRoundData` will revert with no data available'));
  const eth = norm(await read('research/sources/ethereum-org-smart-contract-security-oracle-manipulation.txt'));
  assert.ok(eth.includes('use a decentralized oracle network that queries information from multiple sources to avoid single points of failure'));
  assert.ok(eth.includes('time-weighted average price (TWAP)'));
});

test('every rollup of the table of networks is a heading of the saved copy of the page on L2 Sequencer Uptime Feeds, and no other network is', async () => {
  const headings = (await read('research/sources/chainlink-l2-sequencer-uptime-feeds.txt')).split('## Real-time Monitoring Process')[0].split('\n').filter((l) => l.startsWith('### ')).map((l) => l.slice(4).trim());
  assert.deepEqual(NETWORKS.filter((n) => n.kind === 'rollup').map((n) => n.title).sort(), [...headings].sort());
  assert.equal(ROLLUPS.length, headings.length);
  for (const n of NETWORKS.filter((x) => x.kind === 'chain')) assert.ok(!headings.includes(n.title), n.id);
});

test('size helpers: grouped numbers, lists for a sentence and plurals', () => {
  assert.equal(grouped(12345), '12,345');
  assert.equal(grouped(10n ** 10n), '10,000,000,000');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd', 'e'], 3), 'a, b, c and 2 more');
  assert.equal(plural(1, 'line'), '1 line');
  assert.equal(plural(2, 'line'), '2 lines');
  assert.equal(plural(2, 'asset'), '2 assets');
});

test('text helpers: safeText replaces control, direction and separator characters and caps the length; flat folds white space', () => {
  const bad = ['a', String.fromCharCode(0x1b), '[31m', String.fromCharCode(0x202e), 'b', String.fromCharCode(0x2028), 'c', String.fromCharCode(7), 'd', String.fromCharCode(0x85), 'e'].join('');
  const out = safeText(bad);
  assert.ok(![...out].some((c) => c.charCodeAt(0) < 32 || [0x202e, 0x2028, 0x85].includes(c.charCodeAt(0))));
  assert.equal(safeText('x'.repeat(50), 10), 'xxxxxxx...');
  assert.equal(safeText('short', 10), 'short');
  assert.equal(flat('  a \n  b\t c '), 'a b c');
});
