# Sources

The public pages the documented checks of this tool are based on, each with a short note in this project's own words on
what the page says and which checks lean on it. Nothing here is a copy of a page: read the page itself for its exact
wording. A plain text copy of each page, taken when it was read, is kept in [research/sources](sources) so that a point
can be checked against the page it came from, and the copies are the pages' own words, not this project's. src/data.js
holds the pages and the points the reports show, and test/data.test.js checks that every page in src/data.js is listed
here and has its copy, that no point quotes its page at length, and that every rollup of the table of src/networks.js
is a heading of the copy of the page on L2 Sequencer Uptime Feeds.

The tool reads an oracle configuration and runs nothing; its result is an input to a review before the protocol is
deployed: not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail. These
notes say what the pages say so a reader can follow a finding back to its source. The pages were chosen with web
addresses that hold no number that reads like a year: six pages of the Chainlink documentation on Data Feeds, each read
as the markdown the documentation site serves for the page (the address of the page followed by `.md`), and the page of
ethereum.org on smart contract security, read as the markdown source of the page in its repository.

Where a check rests on a statement the pages do not make, it is a best practice of this tool, its message says so, and
the note for the check in [docs/rules-and-sources.md](../docs/rules-and-sources.md) names the choice. No page asks every
collateral asset for a second source, forbids a fixed price, asks a protocol to declare its answer checks or to reject
an answer of 0, or says how bounds or addresses are written in a configuration; those checks are best practices of this
tool.

## What the copies leave out

Each copy is the text of the page as it was read, with a two-line header that names its address and how it was read,
and with these lines left out, so that no copy holds a date, a number that reads like a year or a word this project
keeps out of every file, and every copy is plain ASCII (decision 1 in docs/decisions):

- Every Chainlink page: the line `Source:` that the site puts under the title (the header of the copy names the address
  instead), and the line that points to the index of the documentation in a file for language tools.
- What are Chainlink Data Feeds?: the paragraph on SmartData feeds, which holds a word this project keeps out of every
  file. No check leans on it.
- Selecting Quality Data Feeds: the row of the table of market hours for US equities traded 24 hours on 5 days, which
  holds a word this project keeps out of every file, and the colour marks written as emoji in front of the names of the
  categories of market pricing risk. No check leans on either.
- Every copy: curly quotes and dashes are written as ASCII quotes and hyphens, and the letter o with two dots in the
  name of a German exchange as a plain o.
- Smart contract security on ethereum.org: only the section "Oracle manipulation" is kept, with the title of the page
  above it. The rest of the page is about other attacks, and it holds dated links and dated figures that the year check
  would catch.

The overview page of the Chainlink documentation on Data Feeds (https://docs.chain.link/data-feeds) was read and not
kept: it lists the other pages and a changelog with dates, and no check leans on it.

## Chainlink Data Feeds

### What are Chainlink Data Feeds?

https://docs.chain.link/data-feeds/overview

Copy: research/sources/chainlink-data-feeds-overview.txt

The kinds of feeds, the parts of a feed (consumer, proxy and aggregator) and how to monitor a feed. Its section on
monitoring says that minAnswer and maxAnswer no longer stop an application from reading an answer on most feeds, so each
application chooses the limits it accepts; that feeds do not stream, but are written when the price moves past the
deviation threshold or when the heartbeat runs out, that some heartbeats last hours and that a round can reach the chain
a little late; that an application should compare updatedAt from latestRoundData with the heartbeat or a limit of its
own and pause when the answer is older; and that heartbeats and deviation thresholds differ between assets and between
chains. `staleness-missing`, `staleness-too-long`, `staleness-below-heartbeat`, `bounds-missing`, `bounds-inverted` and
`bounds-exclude-reference` lean on it.

### Decentralized Data Model

https://docs.chain.link/architecture-overview/architecture-decentralized-model

Copy: research/sources/chainlink-decentralized-data-model.txt

How a feed is written: an aggregator gets a new answer only when the deviation threshold or the heartbeat threshold
starts a round, whichever comes first, and the page defines both. `staleness-too-long` and `staleness-below-heartbeat`
lean on it.

### Data Feeds API Reference

https://docs.chain.link/data-feeds/api-reference

Copy: research/sources/chainlink-data-feeds-api-reference.txt

The functions of AggregatorV3Interface and of the aggregator: decimals() gives the decimals of the answer;
latestRoundData returns the round id, the answer, startedAt, updatedAt and answeredInRound, which the reference marks as
deprecated; latestAnswer carries no time; minAnswer and maxAnswer are no longer used on most feeds. `decimals-mismatch`,
`staleness-missing`, `answered-in-round-deprecated`, `answer-checks-undeclared` and `bounds-missing` lean on it.

### Using Data Feeds on EVM Chains

https://docs.chain.link/data-feeds/using-data-feeds

Copy: research/sources/chainlink-using-data-feeds.txt

How to read a feed from a contract and from outside the chain. Its example consumer says that a contract reading feeds
on an L2 network must also read the L2 Sequencer Uptime Feed. `sequencer-check-missing` leans on it.

### L2 Sequencer Uptime Feeds

https://docs.chain.link/data-feeds/l2-sequencer-feeds

Copy: research/sources/chainlink-l2-sequencer-uptime-feeds.txt

Why a rollup whose sequencer is down distorts liquidations, the networks with a sequencer uptime feed (Arbitrum, BASE,
Celo, Mantle, MegaETH, Metis, OP, Scroll, Soneium, X Layer and ZKsync), and an example consumer that reverts while the
sequencer is down and waits a grace period of 3600 seconds, counted from startedAt of the uptime feed, after it comes
back. The page says the feeds will not be extended to more networks. `sequencer-check-missing`,
`sequencer-grace-missing` and `network-not-in-table` lean on it, and the rollups of the table of src/networks.js are its
headings.

### Selecting Quality Data Feeds

https://docs.chain.link/data-feeds/selecting-data-feeds

Copy: research/sources/chainlink-selecting-quality-data-feeds.txt

The categories of market pricing risk, the measures a protocol takes against risk (circuit breakers, kill switches,
monitoring), the safeguards a feed of one source needs (bounds, freshness checks, a fallback, comparison with independent
references, a way to pause), a ceiling for stablecoins, the loss of a peg in extreme events, the choice between the feed
of a wrapped asset and the feed of the asset under it, and what a feed that was shut down returns. `single-source-collateral`,
`pegged-price-hardcoded`, `feed-shared` and `answer-positive-unchecked` lean on it.

## ethereum.org

### Smart contract security: Oracle manipulation

https://ethereum.org/en/developers/docs/smart-contracts/security/

Copy: research/sources/ethereum-org-smart-contract-security-oracle-manipulation.txt

The section on oracle manipulation: a lending protocol that reads the spot price of one decentralized exchange can be
pushed with a flash loan, and the advice is a decentralized oracle network that reads many sources, or a time-weighted
average price. `single-source-collateral` leans on it. No documented check rests on this page: the checks that use it
are best practices of this tool.
