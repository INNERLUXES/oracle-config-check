import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECIMAL_LIMITS, NETWORKS, ROLLUPS, compareDecimal, formatDecimal, isZero, networkOf, parseDecimal } from '../src/index.js';

const d = (raw) => parseDecimal(raw);

test('parseDecimal: plain decimals into a whole number and a scale', () => {
  assert.deepEqual(d('0'), { int: 0n, scale: 0 });
  assert.deepEqual(d('1500'), { int: 1500n, scale: 0 });
  assert.deepEqual(d('0.98'), { int: 98n, scale: 2 });
  assert.deepEqual(d('1.050'), { int: 1050n, scale: 3 });
  assert.deepEqual(d(`${'9'.repeat(40)}.${'1'.repeat(40)}`).scale, 40);
});

test('parseDecimal: a sign, an exponent, a leading zero, a lone point and too many digits are refused', () => {
  for (const raw of ['-1', '+1', '1e3', '1E-2', '01', '00.5', '.5', '5.', '', ' 1', '1,000', `1${'0'.repeat(40)}`, `0.${'1'.repeat(41)}`, '0x10', 'NaN', 'Infinity']) assert.equal(parseDecimal(raw), null, raw);
  assert.equal(DECIMAL_LIMITS.maxDigits, 40);
});

test('compareDecimal: compares as written, across scales, with no floating point', () => {
  assert.equal(compareDecimal(d('1'), d('1.000')), 0);
  assert.equal(compareDecimal(d('0.999'), d('1')), -1);
  assert.equal(compareDecimal(d('1.0000000000000000001'), d('1')), 1, 'a difference a double would lose');
  assert.equal(compareDecimal(d('30'), d('5')), 1);
  assert.equal(compareDecimal(d('0.1'), d('0.10000000000000000555')), -1);
});

test('formatDecimal and isZero: the shortest form of a decimal', () => {
  assert.equal(formatDecimal(d('1.050')), '1.05');
  assert.equal(formatDecimal(d('1.000')), '1');
  assert.equal(formatDecimal(d('0.01')), '0.01');
  assert.equal(formatDecimal(d('100000')), '100000');
  assert.equal(formatDecimal(d('0.000')), '0');
  assert.ok(isZero(d('0.00')));
  assert.ok(!isZero(d('0.01')));
});

test('networkOf: by id or alias, in any case and with outer spaces; a network out of the table is null', () => {
  assert.equal(networkOf('Arbitrum').id, 'arbitrum');
  assert.equal(networkOf(' arbitrum-one ').id, 'arbitrum');
  assert.equal(networkOf('OP').id, 'optimism');
  assert.equal(networkOf('bsc').id, 'bnb');
  assert.equal(networkOf('zksync-era').kind, 'rollup');
  assert.equal(networkOf('ethereum').kind, 'chain');
  assert.equal(networkOf('linea'), null);
  assert.equal(networkOf('toString'), null);
});

test('the table of networks: unique ids and aliases, and the rollups of the page', () => {
  const names = NETWORKS.flatMap((n) => [n.id, ...n.aliases]);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(ROLLUPS, ['arbitrum', 'base', 'celo', 'mantle', 'megaeth', 'metis', 'optimism', 'scroll', 'soneium', 'x-layer', 'zksync']);
  for (const n of NETWORKS) assert.ok(['rollup', 'chain'].includes(n.kind), n.id);
});
