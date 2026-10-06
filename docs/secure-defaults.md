# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which file you give it, where the output goes, and who may
change the configuration it reads. A clean result is not a security audit and not a guarantee that the oracle of the
protocol cannot be manipulated or fail; it is a file with none of the problems the checks look for, not a finding that
the contracts read their prices safely.

## How the tool behaves by default

- **Never a key.** The tool needs no private key, no seed and no RPC endpoint, and has no option to take one. A key
  named for one and a value shaped like one, anywhere in the file, is a `secret-in-config` error that fails the run; the
  value is left out of every check and never written to a report or an error message, in any format.
- **Reads, never runs.** The tool reads the one configuration file it is given. It follows no symbolic link, fetches no
  URL, refuses an argument that looks like an address, contacts no chain or RPC endpoint, evaluates nothing and writes
  nothing to disk.
- **Every check on from the first run.** A missing staleness threshold, decimals that do not match, a rollup with no
  sequencer check or no grace period, inverted bounds, bounds that reject the reference price, a malformed address and a
  fixed price on collateral are errors; a staleness threshold past the heartbeat and its margin or not past the
  heartbeat, missing bounds, answer checks not declared or without a check that the answer is above 0, one feed for two
  assets and collateral with one source are warnings; answeredInRound relied on and a network out of the table are
  notes. There is no configuration file of the tool that could set a check off.
- **Fail closed on what it cannot read.** A file that is not JSON, or not an object, is an error finding that fails the
  run at the default `--fail-on` of `error`. A missing field and a value of the wrong type are findings of their own, so
  a part of the configuration that was not read is never taken for one that is fine; an asset whose feed could not be
  read is named in a note. A misspelt key is a warning that names the key it is probably meant to be. A file that is not
  text, is too large or is a link stops the run with exit code `2` and no report.
- **Prices as written.** A price, a percent or a bound is compared from the characters of the file, never through a
  floating point number, and a number with an exponent or a sign is refused, so a bound of 0.999999999999999999 is not
  taken for 1.
- **Unknown arguments are errors.** An option the tool does not know, a value that looks like an option and an option
  given twice stop the run, so a typo such as `--fail-no` cannot leave a default in place.
- **No pattern from the input.** No regular expression is built from a file or from an argument.
- **Bounded work.** The reader has limits of size, nesting, values and string length, and works with a stack of its own;
  a configuration has at most 1,000 assets (docs/limits.md), so a large or deep file cannot exhaust the stack, the
  memory or the time.
- **No prototype tricks.** Keys from a file are kept in lists and compared with the names the tool reads, never set as
  properties of an object, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names, protocol names, assets, networks and addresses included, has
  control characters, line separators and direction controls replaced and its length capped before it reaches a report
  or an error message; the markdown report also escapes what markdown gives a meaning to.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--fail-on warning`.** Staleness thresholds past the heartbeat or below it, missing bounds, undeclared answer
  checks, shared feeds, collateral with one source and misspelt keys fail the run too. Use it once the configuration is
  meant to be final, and record in the pull request each warning the team keeps on purpose, such as a wrapped asset
  priced by the feed of the asset under it.
- **`--heartbeat-margin 0`.** A staleness threshold one second past the heartbeat is reported. The default of 10 percent
  leaves room for the delay before a heartbeat round reaches the chain; a smaller margin is stricter, a larger one more
  lenient.
- **`--fail-on info`.** A network out of the table and answeredInRound in the answer checks fail the run too; use it
  where every network must be checked by a person for a sequencer before an asset is listed on it.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Oracle config check
    run: npx --yes github:INNERLUXES/oracle-config-check config/oracles.json --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret, no key and no RPC endpoint;
  never give it one.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Keep one configuration as the source of the oracle settings that the deployment scripts, the tests and the documents
  use, and check it on every change. A value copied by hand into a deployment script can drift from the one that was
  checked; read the values from the configuration in the scripts, or compare the two in their tests.
- Copy the heartbeat, the deviation threshold and the decimals of each feed from the list of feed addresses of its
  network, and review a change to them like code: the checks compare the staleness thresholds and the decimals with these
  values, and a heartbeat copied wrongly moves every result.
- Test the contracts that read the feeds against a mock feed that returns a stale answer, an answer of 0, an answer
  outside the bounds and a sequencer that is down, in their own test suite. This tool checks the configuration; the
  tests check that the contracts do what it says.
- Do not hide the exit code with a trailing `|| true`. To keep the report without failing, keep `--fail-on` at `error`
  and keep the SARIF or JSON report as an artifact of the job, or upload the SARIF to code scanning.
- Treat a report built from a file you do not trust as untrusted data.
- If the tool ever reports `secret-in-config`, treat the key as exposed: remove it from the file and from the history of
  the repository, and move whatever it controls to a new key. The tool does not show the value, but the file itself was
  readable to everyone with access to the repository.

## Protecting the configuration

The oracle configuration decides at what price every loan of the protocol is valued and liquidated. Keep it in the
repository next to the contracts and the deployment scripts, put its path in `CODEOWNERS` with the people who approve
changes to risk parameters, and require their review in branch protection. Review a change to a feed address, a
staleness threshold or a bound like a change to the code that moves funds: a feed address of the wrong pair, or a
staleness threshold of a day on a feed with a heartbeat of an hour, values every loan of that asset wrongly.

Once the protocol is deployed, a value in the configuration is a value in a contract. A finding on a deployed asset is
fixed through the governance or the admin path of the protocol, with the same review as the first deployment.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
