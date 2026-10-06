# Limits

The tool is not an auditor. It reads one oracle configuration, and its result is an input to a review before the
protocol is deployed: not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or
fail. A clean run means only that none of the problems in [method.md](method.md) were found in the file.

## What it cannot see

- **The contracts.** It reads the configuration, not the Solidity that reads the feeds. Whether the contracts apply the
  staleness threshold, the bounds, the decimals, the sequencer check and the answer checks the configuration declares
  is for the team and the reviewers of the code to make sure. A value written in a contract and not in the
  configuration is not seen.
- **The chain.** It contacts no chain and no RPC endpoint, so it cannot tell whether an address is a feed at all, whether
  it prices the pair the configuration says, whether it is a proxy or an aggregator, whether it is owned by the operator
  the team expects, or whether it was shut down. The heartbeat, the deviation threshold and the decimals are the values
  the configuration gives; a value copied wrongly from the list of feed addresses is compared as it is.
- **Checksums of addresses.** An address is checked for its form (0x and 40 hex digits, not the zero address); the mixed
  case checksum of EIP-55 is not checked.
- **The market.** Whether a feed is of low or high market pricing risk, whether its asset is liquid, and whether a
  wrapped asset may part from the asset under it are for the team to judge from the page on selecting feeds. A
  `referencePrice` is the team's own figure; the tool does not know the price of anything.
- **The fallback in full.** A fallback is checked for its form, its address, and whether it is the same feed as the
  primary or the feed of another asset. Its own staleness, bounds and decimals, and what the protocol does when the two
  sources disagree, are not checked.
- **Other oracles.** The answer checks are for feeds of type `chainlink` read through `latestRoundData`. A `custom`
  oracle is checked only for its address, its decimals, its bounds and, when a heartbeat is given, its staleness; a
  `twap` only for its address, its bounds and its decimals. The checks of other oracle networks (their confidence
  intervals, their publish times, their update fees) are not known to the tool, and a 32-byte feed id written as 64 hex
  digits is taken for a private key in hex.
- **Networks out of the table.** The table names the rollups the Chainlink page lists with a sequencer uptime feed and a
  few chains with no sequencer. A rollup that is not in the table is a note, and whether its assets need a sequencer
  check is not judged. The page says its sequencer uptime feeds will not be extended to more networks.
- **Every key and every seed.** The search for keys and seeds knows them by the name of their key and by their shape: a
  mnemonic of 12 to 24 lowercase English words, an extended private key, 64 hex digits or a key in WIF. A key split over
  fields, encrypted or encoded another way is not caught. A clean run does not say that the repository holds no secret.
- **What a misspelt key meant.** A key the tool does not read is reported and left out. A misspelt `maxStaleness`
  makes an asset look as if it had none; read the `field-unknown` findings first.

## What the reader does not read

[inputs.md](inputs.md) lists the fields. A file that is not strict JSON is one `config-unreadable` finding, and nothing
else is checked. A value that is missing, of the wrong type or a key is a finding, and the checks that need it leave it
out: a clean run says nothing about that part. YAML, TOML, comments, prices written as text and numbers with an
exponent are not read.

## Size limits

| Limit | Value |
| --- | --- |
| file size | 4 MB |
| nesting of objects and arrays | 1,000 levels |
| values (nodes) in a file | 2,000,000 |
| a string | 1,000,000 characters |
| assets | 1,000; the rest are not read |
| answer checks of an asset | 20 |
| a span of seconds | 100,000,000 |
| decimals | 36 |
| a price, a percent or a bound | 40 digits on each side of the point |
| a text the search for keys looks at | 4,000 characters |

Input past a limit is a `config-unreadable` or `field-invalid` finding or, for the file size, an input error with exit
code `2`. The tool never passes a run because something could not be read.

## What a run does not do

It never reads or asks for a private key or a seed, contacts no chain or RPC, fetches nothing and connects to nothing,
runs no program, evaluates nothing it reads, reads no clock and no locale, follows no symbolic link and writes nothing
to disk. [threat-model.md](threat-model.md) lists the risks of reading a file from a pull request and their controls.
