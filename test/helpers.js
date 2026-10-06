// Shared test helpers: configurations built inline, checked in memory or written into a temporary folder that is removed
// after the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and
// Windows. The line a test expects is found with lineOf(), which counts lines the way the reader does, so a test never
// holds a line number worked out by hand for one system only. No test reads the clock, the time zone or the locale. Every
// address is made up from one repeated hex digit and is not a real feed.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkText, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'oracle-config-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return text.slice(0, at).split('\n').length;
}

// A made-up address of one repeated hex digit.
export const addr = (c) => `0x${c.repeat(40)}`;

const drop = (out) => {
  for (const [k, v] of Object.entries(out)) if (v === undefined) delete out[k];
  return out;
};

export const FULL_CHECKS = ['updatedAt', 'answerPositive', 'roundComplete'];

// A Chainlink feed; over replaces fields, and a field set to undefined is left out.
export const feed = (over = {}) => drop({ type: 'chainlink', pair: 'ETH / USD', address: addr('1'), heartbeat: 3600, deviation: 0.5, decimals: 8, ...over });

// A time-weighted average price as a fallback.
export const twap = (over = {}) => drop({ type: 'twap', address: addr('a'), window: 1800, ...over });

// An asset that passes every check on a chain with no sequencer; over replaces fields.
export const asset = (over = {}) => drop({ name: 'WETH', network: 'ethereum', role: 'collateral', feed: feed(), fallback: twap(), maxStaleness: 3780, minPrice: 100, maxPrice: 100000, referencePrice: 3500, scaleDecimals: 8, answerChecks: FULL_CHECKS, ...over });

// A sequencer check that passes.
export const sequencer = (over = {}) => drop({ checked: true, feed: addr('5'), gracePeriod: 3600, ...over });

// Three assets that pass every check: WETH on Ethereum with a fallback, ARB borrowable on Arbitrum with a sequencer check,
// and USDC on BASE used both ways with a fallback and a sequencer check.
export const ASSETS = [
  asset(),
  asset({ name: 'ARB', network: 'arbitrum', role: 'borrowable', feed: feed({ pair: 'ARB / USD', address: addr('2'), heartbeat: 86400, deviation: 0.1 }), fallback: undefined, maxStaleness: 90720, minPrice: 0.01, maxPrice: 100, referencePrice: 0.75, scaleDecimals: 'feed', sequencer: sequencer() }),
  asset({ name: 'USDC', network: 'base', role: 'both', feed: feed({ pair: 'USDC / USD', address: addr('3'), heartbeat: 86400, deviation: 0.25 }), fallback: twap({ address: addr('c') }), maxStaleness: 90720, minPrice: 0.5, maxPrice: 1.05, referencePrice: 1, sequencer: sequencer({ feed: addr('6') }) })
];

// A configuration with every field the checks need; over replaces fields, and a field set to undefined is left out.
export function config(over = {}, assets = ASSETS) {
  return drop({ protocol: 'Test Lending', assets, ...over });
}

// The configuration with one asset replaced by another, or added when at is past the end.
export const withAsset = (a, at = ASSETS.length) => config({}, [...ASSETS.slice(0, at), a, ...ASSETS.slice(at + 1)]);

export const configText = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

// The findings of a configuration given as an object, through the reader and the checks.
export const findingsOf = (obj, options = {}) => checkText(configText(obj), options).findings;

// The ids of the findings of a configuration.
export const idsOf = (obj, options = {}) => findingsOf(obj, options).map((f) => f.id);

// The findings of one check.
export const ofCheck = (obj, id, options = {}) => findingsOf(obj, options).filter((f) => f.id === id);

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// Writes the files and runs the command line in the folder.
export async function run(files, args) {
  return withFiles(files, (dir) => cli(args, dir));
}

// A clean configuration, and one whose WETH asset scales by 18 decimals, for the command line tests.
export const GOOD = configText(config());
export const BAD = configText(withAsset(asset({ scaleDecimals: 18 }), 0));

// The time a hostile test may take: four times as long when the runner collects coverage, which sets NODE_V8_COVERAGE.
export const allowed = (ms) => (process.env.NODE_V8_COVERAGE ? ms * 4 : ms);
