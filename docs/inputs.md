# Inputs

The tool takes one path: the oracle configuration, a JSON file. There is no configuration file of the tool itself, no
environment variable and no standard input; the options are on the command line. The tool never asks for a private
key, a seed or an RPC endpoint, and needs none.

```
oracle-config-check <oracles.json> [--format text|markdown|json|sarif] [--json] [--min-severity <level>]
                    [--fail-on <level>] [--heartbeat-margin <percent>] [--explain] [--list-checks]
```

| Option | Meaning |
| --- | --- |
| `--format <name>` | `text` (default), `markdown`, `json` or `sarif` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | the lowest level shown: `info` (default), `warning` or `error` |
| `--fail-on <level>` | the lowest level that fails the run: `info`, `warning` or `error` (default) |
| `--heartbeat-margin <percent>` | how far, in percent of the heartbeat, `maxStaleness` may pass the heartbeat before `staleness-too-long` reports it: a whole number from 0 to 1,000 (default 10) |
| `--explain` | add the points of the pages behind each finding to the text, markdown and JSON reports |
| `--list-checks` | list the checks with their level and kind, in text, markdown or JSON, and exit |
| `--help`, `--version` | the usage, the version |

Every option that takes a value takes it once. A value may not start with `--`. `-` (standard input) and an address
such as `https://...` are refused. A folder is refused: name the file. Two paths are a usage error.

## The configuration

The configuration is one JSON object. Every key is read with its line, and a key that is not in the lists below is a
`field-unknown` finding.

| Field | Needed | Read as |
| --- | --- | --- |
| `protocol` | yes | the name of the protocol, text |
| `assets` | yes | a list of assets, at least one; each is an asset the protocol prices |
| `notes` | no | text, not read by any check |

## An asset

| Field | Needed | Read as |
| --- | --- | --- |
| `name` | yes | text, such as the symbol of the asset; two assets of one network may not share a name (compared without case and outer spaces) |
| `network` | yes | the network the protocol reads the price on, by the name or an alias of the table below, in any case; another name is a note (`network-not-in-table`) |
| `role` | yes | `collateral`, `borrowable` or `both`, in any case |
| `feed` | yes | the primary price source, an object; see below |
| `fallback` | no | a second price source, an object of the same form; the protocol reads it when the feed fails a check |
| `maxStaleness` | no | the oldest answer of the feed the protocol accepts, in whole seconds; missing on a feed with a heartbeat is `staleness-missing` |
| `minPrice` | no | the lowest answer the protocol accepts, a plain decimal number in the unit of the answer (such as USD); missing is `bounds-missing` |
| `maxPrice` | no | the highest answer the protocol accepts, the same form; missing is `bounds-missing` |
| `referencePrice` | no | a price the team takes as plausible for the asset, read only to check the bounds against it |
| `scaleDecimals` | yes | the decimals the protocol divides the answer by, a whole number from 0 to 36, or `"feed"` when it reads `decimals()` from the feed at run time |
| `sequencer` | no | the sequencer check on a rollup, an object; see below |
| `answerChecks` | no | the values of `latestRoundData` the protocol checks on each read, a list of `updatedAt`, `answerPositive`, `roundComplete` and `answeredInRound` |
| `notes` | no | text, not read by any check |

A price, a percent and a bound are written as JSON numbers in plain decimal form, with no sign and no exponent and at
most 40 digits on each side of the point, such as `100000`, `0.98` or `1.05`. They are compared as written, never
through a floating point number.

No field holds a private key, a seed or a mnemonic. A key named for one (`privateKey`, `mnemonic`, `seed`,
`seedPhrase`, `secret`, `passphrase`, `password` and their kin, in any case and with any separator) and a string shaped
like one, under any key, is a `secret-in-config` error; its value is never shown.

## A feed and a fallback

| Field | Read as |
| --- | --- |
| `type` | `chainlink`, `custom`, `twap` or `fixed`, in any case; needed |
| `pair` | text, such as `ETH / USD`; not read by any check |
| `address` | the address of the proxy, the oracle or the pool, text: `0x` and 40 hex digits |
| `heartbeat` | the documented heartbeat of the feed on this network, in whole seconds |
| `deviation` | the documented deviation threshold of the feed, a percent above 0 and up to 100 |
| `decimals` | the decimals of the answer of the feed, a whole number from 0 to 36 |
| `window` | the window of a time-weighted average price, in whole seconds |
| `price` | the fixed price of a `fixed` source, a plain decimal number |
| `notes` | text, not read by any check |

Each type needs some of these fields and takes some others; a field a type does not take is a `field-invalid` finding
and its value is left out.

| Type | Needs | Also takes | Checks of staleness and answers |
| --- | --- | --- | --- |
| `chainlink` | `address`, `heartbeat`, `decimals` | `deviation` | yes: it is an AggregatorV3Interface proxy read through `latestRoundData` |
| `custom` | `address`, `decimals` | `heartbeat`, `deviation` | the staleness checks when a heartbeat is given; no answer checks |
| `twap` | `address`, `window` | `decimals` | no |
| `fixed` | `price` | | no; a fixed price on collateral is `pegged-price-hardcoded` |

The heartbeat, the deviation threshold and the decimals are the documented values of the feed on the network of the
asset, as the list of feed addresses of the network shows them; the tool does not read them from the chain.

## The sequencer check

| Field | Needed | Read as |
| --- | --- | --- |
| `checked` | yes | `true` when the protocol reads the sequencer uptime feed before a price, `false` when it does not |
| `feed` | when `checked` is `true` | the address of the sequencer uptime feed, `0x` and 40 hex digits |
| `gracePeriod` | no | the seconds the protocol waits after the sequencer comes back, counted from `startedAt` of the uptime feed; missing or 0 is `sequencer-grace-missing` |
| `notes` | no | text, not read by any check |

## The networks

A rollup is a network for which the Chainlink page on L2 Sequencer Uptime Feeds lists a sequencer uptime feed; on a
rollup, every asset read from a feed needs a sequencer check. A chain runs no sequencer of its own; which chains those are
is the tool's own table.

| Name | Aliases | Kind |
| --- | --- | --- |
| `ethereum` | `mainnet`, `ethereum-mainnet` | chain |
| `polygon` | `polygon-pos`, `matic` | chain |
| `bnb` | `bsc`, `bnb-chain`, `binance-smart-chain` | chain |
| `avalanche` | `avalanche-c`, `avax` | chain |
| `gnosis` | `xdai` | chain |
| `arbitrum` | `arbitrum-one` | rollup |
| `base` | | rollup |
| `celo` | | rollup |
| `mantle` | | rollup |
| `megaeth` | | rollup |
| `metis` | `metis-andromeda`, `andromeda` | rollup |
| `optimism` | `op`, `op-mainnet` | rollup |
| `scroll` | | rollup |
| `soneium` | | rollup |
| `x-layer` | `xlayer` | rollup |
| `zksync` | `zksync-era` | rollup |

## An example

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

Every address in this repository is made up from one hex digit written forty times and is not a real feed.

## What stops the reading

| Problem | Result |
| --- | --- |
| a file that is not strict JSON (a comment, a trailing comma, a single quote, a key written twice in one object, text after the value), or is nested past the limits | one `config-unreadable` finding with the line and column, and nothing else is checked |
| JSON whose top level is not an object | one `config-unreadable` finding |
| a field missing, of the wrong type or unknown | a finding with the line; that value is left out of the checks that need it |
| a feed with no type, or a type the tool does not know | a finding; the other checks of that feed are left out, and a note names the asset |
| a key or a seed | a `secret-in-config` finding with the line; the value is left out of every check and never shown |

Line ends may be LF, CRLF or CR, and the file may be UTF-8 with or without a byte order mark or UTF-16 with one; the same
findings are written for each.

## Output paths

The path shown in a report is relative to the folder the command runs in, with forward slashes on every system, and the
whole path when the file is outside that folder. A finding is `file:line`: the line of the field it is about, or of the
object that lacks a field. The JSON, markdown and SARIF reports also carry the column.
