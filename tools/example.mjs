// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// configurations to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const BAD = ['examples/bad/oracles.json'];
export const GOOD = ['examples/good/oracles.json'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the bad configuration: the counts, a finding of nearly every check, and the result.
export const EXPECTED = [
  'protocol: Lantern Example Lending; 10 assets on 5 networks (arbitrum, base, optimism, ethereum and linea); 5 used as collateral',
  'findings: 25 (14 error, 9 warning, 2 info)',
  'The configuration holds the key "privateKey", which names a seed, a mnemonic or a private key. The tool never reads one, and the value is not shown.',
  'Asset WETH on arbitrum is priced on Arbitrum, a rollup with a sequencer uptime feed, but the configuration declares no sequencer check.',
  'Asset WBTC on arbitrum scales the answer by 18 decimals, but its feed answers with 8: every price is too low by a factor of 10,000,000,000',
  'The sequencer check of asset WBTC on arbitrum has no gracePeriod',
  'The price of asset USDC on base is fixed in the configuration at 1, and the asset is used as collateral',
  'Asset ARB on arbitrum has no maxStaleness, so the protocol takes an answer of any age',
  'The address of the sequencer uptime feed of asset ARB on arbitrum is "0x5e0", which has 3 characters after 0x, not 40',
  'The sequencer check of asset ARB on arbitrum has a gracePeriod of 0',
  'The maxPrice of asset LINK on optimism is 5, below its minPrice of 30',
  'The referencePrice of asset DAI on ethereum is 1.25, above its maxPrice of 1.1',
  'The feed of asset USDT on ethereum is of type chainlink, which needs address, heartbeat, decimals; the configuration has no heartbeat.',
  'Asset 9 is weth on Arbitrum, as is asset 1 at line 7',
  'Asset weth on Arbitrum is priced on Arbitrum, a rollup with a sequencer uptime feed, but the configuration turns the sequencer check off.',
  'The role of asset CRV on ethereum is "collateralized"; it must be collateral, borrowable or both.',
  'Asset WETH on arbitrum is used as collateral and has one price source and no fallback',
  'Asset WETH on arbitrum accepts answers up to 172,800 seconds (48 hours) old, but the configuration gives its feed a heartbeat of 86,400 seconds (24 hours); with the margin of 10 percent the limit is 95,040 seconds.',
  'The answer checks of asset WETH on arbitrum do not list answerPositive',
  'Asset WBTC on arbitrum accepts answers up to 3,600 seconds (1 hour) old, shorter than the heartbeat of its feed, 86,400 seconds (24 hours).',
  'Asset ARB on arbitrum is read through latestRoundData, but its configuration has no answerChecks',
  'Asset ARB on arbitrum has no maxPrice',
  'Asset LINK on optimism is used as collateral and borrowed and its fallback is the same feed as its primary feed',
  'The feed of asset USDT on ethereum has the address of the feed of asset DAI on ethereum at line 131, on the same network',
  'Did you mean "heartbeat"?',
  'The answer checks of asset WETH on arbitrum list answeredInRound, which the Chainlink API reference marks as deprecated',
  'The network "linea" of asset wstETH on linea is not in the tool\'s table',
  'not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail',
  'RESULT: FAIL - 14 findings at or above error (14 error, 9 warning, 2 info)'
];
// What must not be reported: the check the bad configuration does not hold, the value under privateKey, and a pass.
export const UNWANTED = ['ERROR    config-unreadable', 'left out on purpose', 'RESULT: PASS'];

// What the README says of the good configuration: one note.
export const GOOD_EXPECTED = [
  'protocol: Harbor Example Lending; 7 assets on 4 networks (ethereum, arbitrum, base and linea); 5 used as collateral',
  'findings: 1 (1 info)',
  'The network "linea" of asset LINK on linea is not in the tool\'s table',
  'RESULT: PASS - no finding at or above error (1 info)'
];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = await run(BAD);
  process.stdout.write(bad.out);
  expect('bad configuration', bad, 1, EXPECTED, UNWANTED);

  const good = await run(GOOD);
  expect('good configuration', good, 0, GOOD_EXPECTED, ['ERROR    ', 'WARNING  ', 'RESULT: FAIL']);
  // The good configuration also passes when warnings fail the run, and fails only when notes do.
  expect('good, fail on warning', await run([...GOOD, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning (1 info)'], []);
  expect('good, fail on info', await run([...GOOD, '--fail-on', 'info']), 1, ['RESULT: FAIL - 1 finding at or above info (1 info)'], []);
  // The good configuration keeps every maxStaleness within 5 percent of the heartbeat, so it passes with that margin too.
  expect('good, margin of 5 percent', await run([...GOOD, '--fail-on', 'warning', '--heartbeat-margin', '5']), 0, ['RESULT: PASS'], []);
  // The bad configuration with only the errors shown still counts the rest.
  expect('bad, errors only', await run([...BAD, '--min-severity', 'error']), 1, ['findings: 14 (14 error); 11 below error not shown'], ['WARNING  ', 'INFO     ']);
  // A file that is not there stops the run with no report.
  expect('missing file', await run(['examples/none/oracles.json']), 2, ['examples/none/oracles.json: does not exist'], [], 'err');

  // The README shows the head of the report of the bad configuration with its table of checks, one finding, the table of
  // assets and the end of the report, and the end of the report of the good configuration.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const lines = bad.out.split('\n');
  const head = lines.slice(0, 31).join('\n');
  if (!readme.includes(head)) problems.push('README: the head of the sample output of the bad configuration differs from a real run');
  const explained = (await run([...BAD, '--explain'])).out.split('\n');
  const at = explained.findIndex((l) => l.includes('sequencer-check-missing') && l.includes('examples/bad/oracles.json:8'));
  const sample = explained.slice(at, at + 5).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the sample finding of the sequencer check differs from a real run');
  const t = lines.findIndex((l) => l.startsWith('Assets ('));
  const table = lines.slice(t, t + 13).join('\n');
  if (t < 0 || !readme.includes(table)) problems.push('README: the table of assets of the bad configuration differs from a real run');
  const tail = lines.slice(-6).join('\n');
  if (!readme.includes(tail)) problems.push('README: the tail of the sample output of the bad configuration differs from a real run');
  const goodTail = good.out.split('\n').slice(-6).join('\n');
  if (!readme.includes(goodTail)) problems.push('README: the tail of the sample output of the good configuration differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/bad.txt'), bad.out);
  await writeFile(resolve(root, 'examples/output/good.txt'), good.out);
  const outputs = [
    ['bad-explain.txt', [...BAD, '--explain'], 1],
    ['bad.md', [...BAD, '--format', 'markdown'], 1],
    ['bad-explain.md', [...BAD, '--format', 'markdown', '--explain'], 1],
    ['bad.json', [...BAD, '--json', '--explain'], 1],
    ['bad.sarif', [...BAD, '--format', 'sarif'], 1],
    ['good.md', [...GOOD, '--format', 'markdown'], 0],
    ['good.json', [...GOOD, '--json'], 0],
    ['good.sarif', [...GOOD, '--format', 'sarif'], 0],
    ['checks.txt', ['--list-checks'], 0],
    ['checks.json', ['--list-checks', '--format', 'json'], 0]
  ];
  for (const [name, args, code] of outputs) {
    const r = await run(args);
    if (r.code !== code) problems.push(`${name}: exit code ${r.code}, expected ${code}`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
