# 2. Read JSON with a reader of its own, and never read a key

## Status

Accepted

## Context

The facts the checks need sit in the configuration: for each asset the network, the role, the feed with its heartbeat
and decimals, the staleness threshold, the bounds, the decimals the protocol scales by, the sequencer check and the
answer checks. `JSON.parse` would read them, but it keeps no line and column, so a finding could not point at the line
of an asset; it takes the last of two values written under one key without a word; it builds objects whose keys come
from the file; and it turns every price into a floating point number, so that a bound of 0.1 and a price written with
twenty digits after the point compare as the number type rounds them, not as the file writes them.

An oracle configuration sits next to the deployment scripts of the protocol, and a careless file can hold a key: the
private key of the deployer pasted next to the feed addresses, a mnemonic under a key named `seed`, a key left in a
notes field. A tool that reads such a file and echoes its values in a report would copy the key into a pipeline log, a
pull request comment or a SARIF upload, where many more people can read it.

A configuration that is not complete (an asset with no feed type, a misspelt heartbeat) would also be read as if it
were, and a check could take a value it never saw for one that is fine.

## Decision

1. The file is read by src/json.js, a reader of the tool's own for strict JSON, with the line and column of every value,
   a key written twice as an error, and limits of nesting, values and string length. It does not recurse. Every number
   keeps the characters it was written with.
2. Prices, percents and bounds are read from those characters by src/decimal.js into a whole number and a scale and
   compared with BigInt. A number with a sign, an exponent or more than 40 digits on a side of the point is a
   `field-invalid` finding, never rounded.
3. The tool never asks for a private key, a seed or a mnemonic: it checks the configuration as written. Before the
   configuration is read, src/secrets.js, kept from the sibling tool wallet-derivation-check, walks every key and every
   string of the file. A key named for a key or a seed, and a string shaped like a mnemonic, an extended private key, a
   private key in hex or a key in WIF, is a `secret-in-config` error at its line. The value is marked, the configuration
   reader leaves it out as if it were not there, and no report and no error message shows it, in any format. A feed
   address of 40 hex digits is never taken for a key of 64.
4. Every field the checks need and the file does not give, every key the tool does not read and every value of the
   wrong type is returned with its line and shown as a finding. A check never takes a value it did not read for one
   that is fine, and an asset whose feed could not be read is named in a note.
5. A file that is not JSON, or not an object, stops with one `config-unreadable` finding and a line; the tool does not
   guess at the rest of the file.
6. The checks are a heuristic over the configuration as written, and every report says so; docs/method.md says what each
   check reads and docs/limits.md what it cannot see. The result is an input to a review before the protocol is
   deployed: not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail.

## Consequences

- The tool needs no install and no network, and the same file gives the same report on Linux, Windows and macOS.
- A finding points at the line of the field or the asset.
- A key or a seed in the file fails the run and is never copied into the output. The shapes are loose, so a value that
  only looks like a key is reported too, such as a 32-byte feed id of another oracle written as 64 hex digits; that is
  the safe side, and the tool reads no such ids.
- Configurations in YAML or TOML, and oracle settings written only in Solidity, are not read (docs/limits.md).
