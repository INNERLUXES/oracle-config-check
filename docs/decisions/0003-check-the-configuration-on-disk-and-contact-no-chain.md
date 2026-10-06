# 3. Check the configuration on disk, and contact no chain

## Status

Accepted

## Context

Some facts about a feed live on the chain or on a web page: the decimals the proxy returns, the aggregator behind it,
the pair it prices, its live heartbeat and deviation threshold on data.chain.link, the age of its latest answer, and
whether the sequencer of a rollup is up. A check could call an RPC endpoint on every run, read `decimals()` and
`description()` from each address, and compare them with the configuration. Each would need the network and an endpoint,
would make the result depend on the state of a chain and of a server, would need secrets such as the key of a paid RPC
endpoint in the pipeline, and would let a file in a pull request make the pipeline reach any address it names.

What a team needs first, before the protocol is deployed, is a list of what is wrong in the configuration and where:
the staleness thresholds, the bounds, the decimals, the sequencer checks and the sources, as the configuration writes
them.

## Decision

1. The tool reads the one file it is given, and nothing else. It contacts no chain and no RPC endpoint, fetches nothing,
   needs no key, runs no program and calls no service.
2. The heartbeat, deviation threshold and decimals of a feed are values the configuration gives, copied by the team from
   the list of feed addresses of the network; the tool compares the other values of the configuration with them, and
   says so in docs/limits.md.
3. The rules the checks apply are listed in docs/method.md, and the public pages each documented check rests on are
   named in src/data.js and research/sources.md, each fetched and read before it was listed, with a copy of its text
   under research/sources; the tool never looks them up while it runs.
4. The table of networks in src/networks.js is short; its rollups are the networks the saved copy of the page on L2
   Sequencer Uptime Feeds lists, and a test checks them against it. A network out of the table is a note, never a guess.
5. The tool lists what to look at and what to change; it changes nothing.

## Consequences

- The result depends only on the file, and a run needs no network access, no secret and no endpoint.
- A heartbeat copied wrongly into the configuration is not caught; the checks then compare with the wrong value. The
  team checks the copied values against the list of feed addresses, and docs/secure-defaults.md says to review them like
  code.
- A rollup that gets a sequencer uptime feed after the copy was saved is a note until the table is updated in a
  release, with a test.
