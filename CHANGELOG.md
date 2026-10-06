# Changes

## 1.0.0

First release.

- Reads the price oracle configuration of a DeFi protocol, as JSON, and lists the problems to fix before the protocol is
  deployed, with file and line, as an input to a review: not a security audit and not a guarantee that the oracle of the
  protocol cannot be manipulated or fail. It reads the file, contacts no chain or RPC, fetches nothing, runs nothing,
  needs no key, follows no symbolic link and reads no clock.
- Reads the protocol name and its assets, each with a name, a network, a role (`collateral`, `borrowable` or `both`), a
  feed and an optional fallback of type `chainlink`, `custom`, `twap` or `fixed` with its address, heartbeat, deviation
  threshold, decimals, window or price, a staleness threshold (`maxStaleness`), price bounds (`minPrice`, `maxPrice`), a
  `referencePrice`, the decimals the protocol scales by (`scaleDecimals`), a sequencer check with its uptime feed and
  grace period, and the answer checks the protocol makes on each read (`answerChecks`).
- A strict JSON reader with no dependency and no recursion, with the line and column of every value, a key written
  twice as an error, and limits of size, nesting, values and string length. Prices, percents and bounds are compared from
  the characters of the file with BigInt, never through a floating point number.
- A search for keys and seeds before anything else is read, kept from the sibling tool wallet-derivation-check: a key
  named for a private key, a seed or a mnemonic, and a value shaped like a mnemonic, an extended private key, a private
  key in hex or a key in WIF, is an error whose value is left out of every check and never shown.
- Twenty-three checks in three levels, each documented or a best practice of the tool and saying which: no staleness
  threshold (`staleness-missing`), one longer than the heartbeat and its margin (`staleness-too-long`) or not longer than
  the heartbeat (`staleness-below-heartbeat`), no bounds (`bounds-missing`), decimals that do not match
  (`decimals-mismatch`), a rollup with no sequencer check (`sequencer-check-missing`) or no grace period
  (`sequencer-grace-missing`), answeredInRound relied on (`answered-in-round-deprecated`), inverted bounds
  (`bounds-inverted`), bounds that reject the reference price (`bounds-exclude-reference`), answer checks not declared
  (`answer-checks-undeclared`) or without a check that the answer is above 0 (`answer-positive-unchecked`), a malformed
  address (`address-malformed`), one feed for two assets (`feed-shared`), collateral with one source
  (`single-source-collateral`), a fixed price on collateral (`pegged-price-hardcoded`) and a network out of the table
  (`network-not-in-table`); and six checks about the input (`config-unreadable`, `field-missing`, `field-unknown`,
  `field-invalid`, `asset-duplicate`, `secret-in-config`).
- A table of the assets with their feeds, heartbeats, staleness thresholds, decimals, sequencer checks and bounds, in
  every format but SARIF.
- Reports as text, markdown, JSON and SARIF 2.1.0; every finding has its id, severity, message, file, line and column;
  `--min-severity`, `--fail-on`, `--heartbeat-margin`, `--explain` with the points of the pages behind each finding, and
  `--list-checks`. Exit code `0` when no finding is at or above the fail-on level, `1` when one is, `2` for a usage or
  input error, with no result.
- Plain text copies of the public pages the documented checks rest on, under research/sources, with a note on each page.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
