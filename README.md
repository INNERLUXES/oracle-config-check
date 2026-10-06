# oracle-config-check

Oracle config check. Give it the price oracle configuration of a DeFi protocol, as a JSON file: for each asset the
network, the role (collateral, borrowable or both), the feed (such as a Chainlink AggregatorV3 proxy) with its address,
its documented heartbeat, deviation threshold and decimals, an optional fallback such as a time-weighted average price,
the staleness threshold the protocol accepts, the price bounds, the decimals the protocol scales by, the L2 sequencer
uptime check with its grace period, and the checks the protocol makes on each answer. It reads the file and lists the
problems to fix before the protocol is deployed, the ones that lead to bad liquidations or drained pools: a staleness
threshold that is missing, longer than the heartbeat or not longer than it, bounds that are missing, inverted or reject
a plausible price, decimals that do not match, a rollup with no sequencer check or no grace period, answeredInRound
relied on, malformed or shared feed addresses, collateral with a single source and a stablecoin fixed at its peg. Every
finding has its id, level, message and file and line, and the run exits with a code a pipeline can act on.

**It is an input to a review before the protocol is deployed: not a security audit and not a guarantee that the oracle
of the protocol cannot be manipulated or fail.** It is not an auditor. It reads one file only: it contacts no chain or
RPC, fetches nothing, runs nothing, needs no key and reads no clock, so it does not see the contracts that read the
feeds, the feeds themselves or the market; the checks are a heuristic. A clean run means only that none of the problems
of its checks were found in the file, and the team still has to test the contracts against feeds that go stale, return
0 or leave their bounds, and against a sequencer that goes down.

A lending protocol values every deposit and every loan at the price it reads from its oracle, and liquidates a loan when
that price says the collateral no longer covers it. The Chainlink pages on Data Feeds
(https://docs.chain.link/data-feeds/overview) say what a protocol has to do with each answer: compare its age with the
heartbeat of the feed, keep it within limits the protocol chooses, scale it by the decimals of the feed, and, on a
rollup, wait while the sequencer is down and for a grace period after it comes back. A staleness threshold of two days on
a feed with a heartbeat of one, a scale of 18 decimals on an answer of 8, a stablecoin valued at 1 whatever the market
says: each is easy to write in a configuration and costly to find once the pool holds funds. This tool reads the
configuration on every change and points at the line.

- **One check per problem.** Twenty-three checks, each with what it looks at, what it cannot see, the public pages it
  rests on and what to change. Each check is either documented (in the Chainlink pages on Data Feeds) or a best practice
  of this tool, and its message says which.
- **Never a key.** The tool needs no private key, no seed and no RPC endpoint. A key named for one, or a value shaped
  like a mnemonic, an extended private key, a private key in hex or a key in WIF, is an error, and its value is never
  shown in any report.
- **Prices as written.** Prices, percents and bounds are compared from the characters of the file, never through a
  floating point number; a bound of 0.999999999999999999 is not taken for 1.
- **A JSON reader of its own.** It keeps the line and column of every value, so a finding points at the line of the
  asset or the field; what the configuration does not say is listed as a finding, never taken for a value that is fine.
- Reports as text, markdown, JSON and SARIF, with an exit code for a pipeline: `0` no finding at or above the
  `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 129
pass 127
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link or a device (a link to a configuration file, and `/dev/null` named as a file); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests
with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/oracle-config-check.git
cd oracle-config-check
node bin/oracle-config-check.js examples/bad/oracles.json
```

Or without a clone, in your own project:

```
npx --yes github:INNERLUXES/oracle-config-check config/oracles.json
```

`examples/` holds two made-up configurations of a lending protocol; every address in them is one hex digit written
forty times and is not a real feed. `examples/bad/oracles.json` holds a finding of nearly every check: a key named
`privateKey`, WETH on Arbitrum with no sequencer check, a staleness threshold of two days on a heartbeat of one, no
fallback and answeredInRound among its answer checks, WBTC scaled by 18 decimals on an answer of 8 with a staleness
threshold below its heartbeat and a sequencer check with no grace period, USDC fixed at 1 as collateral, ARB with no
staleness threshold, no maximum price, no answer checks and a sequencer check with a short address and a grace period of
0, LINK with inverted bounds and a fallback that is its own feed, DAI with a reference price above its bounds, USDT on the
feed of DAI with a misspelt heartbeat, wstETH on a network out of the table, a second WETH on Arbitrum with the sequencer
check off, and CRV with a role the tool does not know. `examples/good/oracles.json` passes at error and warning level:
assets on Ethereum, Arbitrum and BASE with fallbacks on collateral, staleness thresholds 5 percent above the heartbeat,
bounds around a reference price, sequencer checks with a grace period of an hour on the rollups, and the one note it
still shows is a network that is not in the tool's table.

## Usage

```
oracle-config-check <oracles.json> [options]
```

```
--format <name>              text, markdown, json or sarif (default: text)
--json                       the same as --format json
--min-severity <level>       the lowest level of a finding that is shown: info, warning, error (default: info)
--fail-on <level>            the lowest level of a finding that fails the run: info, warning, error (default: error)
--heartbeat-margin <percent> staleness-too-long: how far past the heartbeat maxStaleness may go, 0 to 1000 (default: 10)
--explain                    show the points of the pages behind each finding (text, markdown and JSON)
--list-checks                list the checks with their level and kind, and exit
--help                       show the usage
--version                    show the version
```

Name one file: the configuration. [docs/inputs.md](docs/inputs.md) lists every field. The path in the report is
relative to the folder you run the command in, with forward slashes on every system, followed by the line.

A short configuration looks like this:

```json
{
  "protocol": "Harbor Example Lending",
  "assets": [
    {
      "name": "WETH",
      "network": "arbitrum",
      "role": "collateral",
      "feed": { "type": "chainlink", "pair": "ETH / USD", "address": "0x4444444444444444444444444444444444444444", "heartbeat": 86400, "deviation": 0.05, "decimals": 8 },
      "fallback": { "type": "twap", "address": "0xdddddddddddddddddddddddddddddddddddddddd", "window": 1800 },
      "maxStaleness": 90720,
      "minPrice": 100,
      "maxPrice": 100000,
      "referencePrice": 3500,
      "scaleDecimals": 8,
      "sequencer": { "checked": true, "feed": "0x5555555555555555555555555555555555555555", "gracePeriod": 3600 },
      "answerChecks": ["updatedAt", "answerPositive", "roundComplete"]
    }
  ]
}
```

The report of the bad example starts with what was read, the findings in one line, and the checks with the number of
findings of each; then the findings, errors first, each with what to change:

```
oracle-config-check: examples/bad/oracles.json
file: 244 lines, 6,040 bytes
protocol: Lantern Example Lending; 10 assets on 5 networks (arbitrum, base, optimism, ethereum and linea); 5 used as collateral
findings: 25 (14 error, 9 warning, 2 info)

Checks (23)

  check                         level    kind           findings
  config-unreadable             error    input          0
  field-missing                 error    input          1
  field-unknown                 warning  input          1
  field-invalid                 error    input          1
  asset-duplicate               error    input          1
  secret-in-config              error    input          1
  staleness-missing             error    documented     1
  staleness-too-long            warning  documented     1
  staleness-below-heartbeat     warning  documented     1
  bounds-missing                warning  documented     1
  decimals-mismatch             error    documented     1
  sequencer-check-missing       error    documented     2
  sequencer-grace-missing       error    documented     2
  answered-in-round-deprecated  info     documented     1
  bounds-inverted               error    best practice  1
  bounds-exclude-reference      error    best practice  1
  answer-checks-undeclared      warning  best practice  1
  answer-positive-unchecked     warning  best practice  1
  address-malformed             error    best practice  1
  feed-shared                   warning  best practice  1
  single-source-collateral      warning  best practice  2
  pegged-price-hardcoded        error    best practice  1
  network-not-in-table          info     best practice  1
```

A finding names its check, its level, the file and the line of the field and what to change. With `--explain` it also
gives the points of the pages behind it and, for a best practice check, the tool's own choice:

```
  ERROR    sequencer-check-missing       examples/bad/oracles.json:8
           Asset WETH on arbitrum is priced on Arbitrum, a rollup with a sequencer uptime feed, but the configuration declares no sequencer check. While the sequencer is down, most users cannot add collateral or repay, while some can still reach the chain through L1, and stale prices drive liquidations when it comes back.
           fix: Read the sequencer uptime feed of the network before every read of a price, revert while it answers 1, and declare it under sequencer.
           basis: While the sequencer of a rollup is down, most users cannot send transactions but some can still reach the chain through L1, which can distort liquidations; the uptime feed answers 0 when the sequencer is up and 1 when it is down. (Chainlink: L2 Sequencer Uptime Feeds, https://docs.chain.link/data-feeds/l2-sequencer-feeds)
           basis: The example consumer of the guide says that a contract reading feeds on an L2 network has to read the L2 Sequencer Uptime Feed as well, so that its data holds up when the sequencer is down. (Chainlink: Using Data Feeds on EVM Chains, https://docs.chain.link/data-feeds/using-data-feeds)
```

After the findings come the assets, each with its feed and fallback, the heartbeat and the staleness threshold in
seconds, the decimals of the feed and the scale of the protocol, the sequencer check and the bounds:

```
Assets (10)

  asset   network   role        feed       fallback   heartbeat  maxAge   dec  scale  sequencer  bounds
  WETH    arbitrum  collateral  chainlink  -          86400s     172800s  8    8      -          100..100000
  WBTC    arbitrum  collateral  chainlink  twap       86400s     3600s    8    18     on         1000..1000000
  USDC    base      collateral  fixed      -          -          -        -    8      -          -
  ARB     arbitrum  borrowable  chainlink  -          86400s     -        8    8      on, 0s     0.01..-
  LINK    optimism  both        chainlink  chainlink  1200s      1260s    8    8      on, 3600s  30..5
  DAI     ethereum  collateral  chainlink  twap       3600s      3780s    8    8      -          0.9..1.1
  USDT    ethereum  borrowable  chainlink  -          -          90720s   8    8      -          0.5..2
  wstETH  linea     borrowable  chainlink  -          86400s     90720s   8    feed   -          100..100000
  weth    arbitrum  borrowable  chainlink  -          86400s     90720s   8    8      off        100..100000
  CRV     ethereum  -           chainlink  -          86400s     90720s   8    8      -          0.01..100
```

The end of the report holds the notes, the notice and the result:

```
  CRV     ethereum  -           chainlink  -          86400s     90720s   8    8      -          0.01..100

This report is an input to a review before the protocol is deployed: not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail.

RESULT: FAIL - 14 findings at or above error (14 error, 9 warning, 2 info)
```

The good example passes:

```
  LINK   linea     borrowable  chainlink  -          86400s     90720s  8    8      -          0.5..1000

This report is an input to a review before the protocol is deployed: not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail.

RESULT: PASS - no finding at or above error (1 info)
```

## How the configuration is read

1. The path is resolved against the folder you run the command in. A link, a folder, a device or a file over 4 MB is
   refused, and so is a file that is not UTF-8 (or UTF-16 with a byte order mark) or holds a null byte, with exit code
   `2` and no report.
2. The JSON reader of the tool reads the file with the line and column of every value and the characters of every
   number. It reads strict JSON and refuses a key written twice in one object.
3. Every key and every string is looked at for a private key or a seed. One that is found is an error at its line, and
   its value is left out of everything that follows and never shown.
4. The fields of the configuration, of each asset, of its feed, its fallback and its sequencer check are read with their
   lines. A key the tool does not read is a `field-unknown` finding; a missing field and a value of the wrong type are
   findings of their own, and that value is left out of the checks that need it.
5. Each asset is checked against the type of its feed and the kind of its network; then the assets are compared with
   each other for a feed that prices two of them.

[docs/method.md](docs/method.md) says what each check reads, and [docs/inputs.md](docs/inputs.md) lists the fields, the
feed types and the networks.

## What it checks

| Check | Level | Kind | What it reports |
| --- | --- | --- | --- |
| `staleness-missing` | error | documented | a feed with a heartbeat and no `maxStaleness`, or answer checks without `updatedAt` |
| `staleness-too-long` | warning | documented | a `maxStaleness` above the heartbeat plus the margin (10 percent by default) |
| `staleness-below-heartbeat` | warning | documented | a `maxStaleness` at or below the heartbeat, so reads revert in a calm market |
| `bounds-missing` | warning | documented | no `minPrice` or no `maxPrice`, or a `minPrice` of 0 |
| `decimals-mismatch` | error | documented | a `scaleDecimals` other than the decimals of the feed |
| `sequencer-check-missing` | error | documented | an asset on a rollup with a sequencer uptime feed and no sequencer check, or the check off |
| `sequencer-grace-missing` | error | documented | a sequencer check with no grace period, or one of 0 |
| `answered-in-round-deprecated` | info | documented | `answeredInRound` among the answer checks, which the API reference marks as deprecated |
| `bounds-inverted` | error | best practice | a `minPrice` at or above the `maxPrice` |
| `bounds-exclude-reference` | error | best practice | a `referencePrice` outside the bounds |
| `answer-checks-undeclared` | warning | best practice | a Chainlink feed whose configuration does not say what is checked on each answer |
| `answer-positive-unchecked` | warning | best practice | answer checks without a check that the answer is above 0 |
| `address-malformed` | error | best practice | an address that is not 0x and 40 hex digits, or is the zero address |
| `feed-shared` | warning | best practice | one feed address on one network for two assets |
| `single-source-collateral` | warning | best practice | collateral with no fallback, or a fallback that is its own feed |
| `pegged-price-hardcoded` | error | best practice | collateral with a fixed price, such as a stablecoin valued at 1 |
| `network-not-in-table` | info | best practice | a network out of the tool's table, whose sequencer is then checked by hand |
| `secret-in-config` | error | input | a key named for a private key or a seed, or a value shaped like one; its value is never shown |
| `asset-duplicate` | error | input | two assets of one name on one network |
| `field-invalid` | error | input | a value of the wrong type or form, a role or a feed type the tool does not know |
| `field-unknown` | warning | input | a key the tool does not read, often a misspelt one |
| `field-missing` | error | input | a field the checks need |
| `config-unreadable` | error | input | a file that is not JSON, or holds no configuration object |

A documented check rests on the Chainlink pages on Data Feeds. A best practice check is this tool's own choice, and its
message says "a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org".
`--list-checks` shows the kind of each check. Some of the levels are worth a word:

- `staleness-too-long` and `staleness-below-heartbeat` are warnings. The Chainlink overview lets an application set a
  limit of its own, so a threshold away from the heartbeat can be a choice; record it. `--heartbeat-margin` sets how far
  past the heartbeat a threshold may go before it is reported.
- `answered-in-round-deprecated` is a note. Checking `answeredInRound` does no harm, but the API reference marks it as
  deprecated and it says nothing of the age of the answer.
- `feed-shared` and `single-source-collateral` are warnings and best practices. A wrapped asset priced by the feed of
  the asset under it, or collateral with one source the team trusts, can be a deliberate choice; the finding asks the
  team to say so.
- `pegged-price-hardcoded` is an error and a best practice. No page names a rule against a fixed price, but the page on
  selecting feeds warns that stablecoins lose their peg in extreme events and asks for a ceiling on their value.
- `network-not-in-table` is a note. The rollups of the table are the networks the Chainlink page lists with a sequencer
  uptime feed.

## What is not checked

[docs/limits.md](docs/limits.md) lists what the tool cannot see. Among them: whether the contracts apply what the
configuration declares (test them against mock feeds), whether an address is the feed of its pair, the live heartbeat,
deviation and decimals of a feed (the tool compares with the values the configuration gives), the checksum of an
address, the market risk of an asset, the fallback beyond its form, other oracle networks, networks out of the table, and
keys or seeds in a shape the search does not know.

## Formats

`--format text` (the default) is for a terminal. `--format markdown` is a report for a job summary or a pull request,
with a table of findings and the table of assets. `--format json` writes every finding with its `id`, `severity`,
`message`, `file`, `line`, `column`, `entry` and `fix`, the table of assets, and with `--explain` the points of the
pages. `--format sarif` writes SARIF 2.1.0, with the checks as rules, the configuration as the artifact and a result for
each finding with its line and column, for code scanning; the table of assets has no place in it. The saved output of
the examples is in [examples/output](examples/output).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | no finding at or above the `--fail-on` level (default `error`) |
| `1` | a finding at or above it |
| `2` | a usage error, or an input error such as a path that does not exist, a link or a folder, or a file that is not text or is too large; there is no report |

Findings below `--min-severity` are not shown, and still count for the result.

## Limits

The tool reads one file; it contacts no chain and connects to nothing. A run reports the problems of docs/method.md
that the file holds. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 4 MB for a file,
objects and arrays nested up to 1,000 deep, 1,000 assets, and prices of up to 40 digits on each side of the point.
[docs/threat-model.md](docs/threat-model.md) lists the risks of reading a file from a pull request and their controls,
and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the file, looks for keys and seeds, reads the configuration, runs the checks and builds the report of the run |
| `src/files.js` | the bounded reading of a file by its byte order mark, with no link followed |
| `src/json.js` | the JSON reader: lines and columns, keys written twice, limits, a stack of its own |
| `src/secrets.js` | the search for keys and seeds by the name of a key and the shape of a value, which marks them so that no report shows them |
| `src/config.js` | the fields of the configuration, of each asset, its feeds and its sequencer check, and the input checks |
| `src/decimal.js` | prices, percents and bounds read from the characters of the file and compared with BigInt |
| `src/networks.js` | the networks, with the rollups that have a sequencer uptime feed |
| `src/analyze.js` | the checks on each asset and across the assets |
| `src/rules.js` | the checks, their levels and kinds, and the result |
| `src/report.js`, `src/text.js`, `src/size.js` | the text, markdown, JSON and SARIF output, the cleaning of text from the input and number formats |
| `src/data.js` | the public pages and the points the checks rest on, in this project's own words |
| `research/sources/` | text copies of the pages, as they were read |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

The documented checks rest on six pages of the Chainlink documentation on Data Feeds, and two best practice checks also
name the section on oracle manipulation of the page of ethereum.org on smart contract security, nothing else. Each page
was read before it was listed, a text copy of it is kept in [research/sources](research/sources), and
[research/sources.md](research/sources.md) has a note on each and lists the lines the copies leave out.
[docs/rules-and-sources.md](docs/rules-and-sources.md) lists every check with the points of the pages it rests on, what
it cannot see and what to change. Where a check is a best practice and not a rule in the pages, it says so.

- Chainlink, What are Chainlink Data Feeds?: https://docs.chain.link/data-feeds/overview
- Chainlink, Decentralized Data Model: https://docs.chain.link/architecture-overview/architecture-decentralized-model
- Chainlink, Data Feeds API Reference: https://docs.chain.link/data-feeds/api-reference
- Chainlink, Using Data Feeds on EVM Chains: https://docs.chain.link/data-feeds/using-data-feeds
- Chainlink, L2 Sequencer Uptime Feeds: https://docs.chain.link/data-feeds/l2-sequencer-feeds
- Chainlink, Selecting Quality Data Feeds: https://docs.chain.link/data-feeds/selecting-data-feeds
- ethereum.org, Smart contract security, Oracle manipulation: https://ethereum.org/en/developers/docs/smart-contracts/security/

## Background

The oracle settings of a lending protocol are decided before its first deployment, and every loan it makes is valued
with them for as long as they stand. They are read line by line when a team prepares a protocol for an audit, lists a
new asset or a new network, or brings in engineers to build the contracts, the deployment scripts and their tests. How
such work is staffed and carried out is described on the page
[DeFi Development Services](https://innerluxes.dev/blockchain/defi).

## License

MIT
