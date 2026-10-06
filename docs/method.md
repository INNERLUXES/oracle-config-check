# Method

This document says how the tool reads an oracle configuration and what each check looks at. The tool is an input to a
review before the protocol is deployed: not a security audit and not a guarantee that the oracle of the protocol cannot
be manipulated or fail. A clean run means only that none of the problems below were found in the file.

## Why the configuration

A lending protocol values every deposit and every loan with a price it reads from an oracle, and it liquidates a loan
when that price says the collateral no longer covers it. The price is only as good as the way it is read: how old an
answer the protocol accepts, what range of answers it takes as sane, how many decimals it divides by, whether it waits
when the sequencer of a rollup was down, and whether it has anything to fall back on when its one feed stops. A
staleness threshold of a day on a feed that should be written every hour, a scale of 18 decimals on an answer of 8, or a
stablecoin valued at 1 whatever the market says: each lets borrowers take more than their collateral is worth, or
liquidates loans that were sound, and either way the pool pays.

These choices sit in a configuration long before the protocol is deployed, and once it is deployed they sit in a
contract. The tool reads that configuration as a file, so the same check runs on every change, and every finding points
at a line.

## Reading the file

1. The path is resolved against the folder the command runs in. A link, a folder, a device or a pipe is refused; a file
   over 4 MB is refused before it is read; a file with a null byte, or bytes that are not UTF-8 (or UTF-16 with a byte
   order mark), is refused with exit code `2` and no report.
2. The text goes to a JSON reader of the tool's own (`src/json.js`), which keeps the line and column of every value and
   the characters every number was written with, and reads strict JSON: a comment, a trailing comma, a key written twice
   in one object or text after the value is a `config-unreadable` finding with the line.
3. Every key and every string of the file is looked at for a key or a seed (`src/secrets.js`). A key named for a private
   key, a seed or a mnemonic, and a string shaped like a mnemonic, an extended private key, a private key in hex or a key
   in WIF, is `secret-in-config`. The value is marked and left out of everything that follows, and no report shows it.
4. The fields are read (`src/config.js`) as docs/inputs.md lists them. A missing field is `field-missing`, a key the tool
   does not read is `field-unknown`, a value of the wrong type or form is `field-invalid`, and two assets of one name on
   one network are `asset-duplicate`. The value is then left out of every check that needs it. Prices, percents and
   bounds are read by `src/decimal.js` into a whole number and a scale.
5. The feed and the fallback of each asset are read with the fields their type needs; a feed with no type, or a type the
   tool does not know, leaves the asset out of the checks of its feed, and a note names it.

## The checks of one asset

Each asset is checked on its own (`src/analyze.js`), with the type of its feed and the kind of its network.

- The addresses of the feed, the fallback and the sequencer uptime feed: 0x and 40 hex digits, and not the zero
  address.
- The network against the table of networks: a network out of the table is a note.
- A feed of type `fixed` on collateral is reported, and no other check of a feed is made for a fixed price.
- The staleness threshold, for a `chainlink` feed and for a `custom` feed with a heartbeat: there must be a
  `maxStaleness`, and when `answerChecks` are given they must list `updatedAt`; then `maxStaleness` must be above the
  heartbeat and at most the heartbeat plus the margin (10 percent by default, `--heartbeat-margin`).
- The bounds: a `minPrice` above 0 and a `maxPrice`; the `minPrice` below the `maxPrice`; and a `referencePrice`, when
  one is given, between them.
- The decimals: when `scaleDecimals` is a number and the feed gives its decimals, the two must be the same.
- The answer checks, for a `chainlink` feed: `answerChecks` must be given and list `answerPositive`; `answeredInRound`
  in the list is a note.
- The sequencer check, on a rollup of the table: there must be a `sequencer` with `checked` true, and a `gracePeriod`
  above 0.
- The sources of collateral: an asset of role `collateral` or `both` must have a fallback, and the fallback must not be
  the primary feed again.

## The checks across assets

- Every feed and fallback address is compared with those of the assets before it, on the same network and without case.
  The same address on two assets of different names is reported once, at the later asset, with the first one it meets.
  The same address on two networks is not compared: one address can be a different contract on each chain.

## The checks

Each check says whether it is documented or a best practice. A documented check rests on the Chainlink pages on Data
Feeds. A best practice check is the tool's own choice; its message says so, and so does `--list-checks`.
[rules-and-sources.md](rules-and-sources.md) lists the pages and the points of each page behind each check.

| Check | Looks at | Level |
| --- | --- | --- |
| `staleness-missing` | `maxStaleness` and `updatedAt` in `answerChecks`, on a feed with a heartbeat | error |
| `staleness-too-long` | `maxStaleness` above the heartbeat plus the margin | warning |
| `staleness-below-heartbeat` | `maxStaleness` at or below the heartbeat | warning |
| `bounds-missing` | `minPrice` and `maxPrice` missing, or a `minPrice` of 0 | warning |
| `decimals-mismatch` | `scaleDecimals` against the `decimals` of the feed | error |
| `sequencer-check-missing` | on a rollup of the table, no `sequencer` or `checked` false | error |
| `sequencer-grace-missing` | on a rollup, a sequencer check with no `gracePeriod` or one of 0 | error |
| `answered-in-round-deprecated` | `answeredInRound` in `answerChecks` | info |
| `bounds-inverted` | `minPrice` at or above `maxPrice` | error |
| `bounds-exclude-reference` | `referencePrice` below `minPrice` or above `maxPrice` | error |
| `answer-checks-undeclared` | a `chainlink` feed with no `answerChecks` | warning |
| `answer-positive-unchecked` | `answerChecks` without `answerPositive` | warning |
| `address-malformed` | an address that is not 0x and 40 hex digits, or is the zero address | error |
| `feed-shared` | one address on one network for two assets | warning |
| `single-source-collateral` | collateral with no fallback, or a fallback that is the primary feed | warning |
| `pegged-price-hardcoded` | a feed of type `fixed` on collateral | error |
| `network-not-in-table` | a network the table does not hold | info |
| `secret-in-config` | a key named for a key or a seed, or a value shaped like one | error |
| `asset-duplicate` | two assets of one name on one network | error |
| `field-invalid` | a value of the wrong type or form | error |
| `field-unknown` | a key the tool does not read | warning |
| `field-missing` | a field the checks need | error |
| `config-unreadable` | a file that is not JSON, or holds no configuration object | error |

## The levels

- `staleness-missing` is an error: with no limit on the age of an answer, a feed that stopped keeps its last price for
  as long as it is stopped, and the protocol lends and liquidates at it.
- `staleness-too-long` and `staleness-below-heartbeat` are warnings. The Chainlink overview lets each application set a
  limit of its own, so a threshold away from the heartbeat can be a choice; the finding asks the team to make it on
  purpose. The margin leaves room for the delay before a heartbeat round reaches the chain.
- `bounds-missing` is a warning: the pages leave the limits to each application. `bounds-inverted` and
  `bounds-exclude-reference` are errors, because bounds that reject every price, or the price the team itself expects,
  stop the protocol.
- `decimals-mismatch`, `sequencer-check-missing` and `sequencer-grace-missing` are errors: each values loans wrongly or
  liquidates them unfairly the first time it matters.
- `answered-in-round-deprecated` is a note: checking answeredInRound does no harm, but it says nothing of the age of the
  answer, which the API reference no longer relies on it for.
- `answer-checks-undeclared`, `answer-positive-unchecked`, `feed-shared` and `single-source-collateral` are warnings and
  best practices: each can be a deliberate choice, such as a wrapped asset priced by the feed of the asset under it.
- `pegged-price-hardcoded` is an error and a best practice: no page names a rule against a fixed price, but a stablecoin
  that loses its peg while it is valued at 1 is the case the page on selecting feeds warns of.
- `address-malformed` is an error and a best practice: an address that is not 0x and 40 hex digits cannot be the address
  of a contract, and the zero address is never a feed.
- `network-not-in-table` is a note: the table is short, and a network out of it is for a person to check.
