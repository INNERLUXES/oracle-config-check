# Rules and sources

Every check of the tool, with what it looks at, the points of the public pages it rests on, what it cannot see, and what to change. The points are in this project's own words and are the ones the reports show with `--explain`; each page was fetched and read before it was listed, and a copy of its text is kept under [research/sources](../research/sources) so that a point can be checked against the page it came from. [../research/sources.md](../research/sources.md) has a note on each page.

The tool is an input to a review before the protocol is deployed: not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail. A check that is a best practice of this tool says so in its message; it is not a rule in the Chainlink pages on Data Feeds or on ethereum.org.

## The pages

- Chainlink: What are Chainlink Data Feeds?: https://docs.chain.link/data-feeds/overview (copy: `research/sources/chainlink-data-feeds-overview.txt`)
- Chainlink: Decentralized Data Model: https://docs.chain.link/architecture-overview/architecture-decentralized-model (copy: `research/sources/chainlink-decentralized-data-model.txt`)
- Chainlink: Data Feeds API Reference: https://docs.chain.link/data-feeds/api-reference (copy: `research/sources/chainlink-data-feeds-api-reference.txt`)
- Chainlink: Using Data Feeds on EVM Chains: https://docs.chain.link/data-feeds/using-data-feeds (copy: `research/sources/chainlink-using-data-feeds.txt`)
- Chainlink: L2 Sequencer Uptime Feeds: https://docs.chain.link/data-feeds/l2-sequencer-feeds (copy: `research/sources/chainlink-l2-sequencer-uptime-feeds.txt`)
- Chainlink: Selecting Quality Data Feeds: https://docs.chain.link/data-feeds/selecting-data-feeds (copy: `research/sources/chainlink-selecting-quality-data-feeds.txt`)
- ethereum.org: Smart contract security, Oracle manipulation: https://ethereum.org/en/developers/docs/smart-contracts/security/ (copy: `research/sources/ethereum-org-smart-contract-security-oracle-manipulation.txt`)

## config-unreadable

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: the file is not JSON the reader can follow, or its top level is not an object, so no configuration was read.
- Cannot see: It stops at the first place that is not JSON, or at a top level that is not an object, so nothing in that file is checked.
- What to change: Write the configuration as one JSON object (docs/inputs.md), and fix the line named.
- Points of the pages: none; this check is about the configuration file itself.

## field-missing

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: a field the checks need is not in the configuration: the protocol name or the assets, the name, network, role, feed or scaleDecimals of an asset, or a field its feed type needs.
- Cannot see: It names the field and the object that lacks it; it does not guess the value, and the checks that need the field do not run for that asset.
- What to change: Add the field named; docs/inputs.md lists what each part of the configuration needs.
- Points of the pages: none; this check is about the configuration file itself.

## field-unknown

- Level: warning
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: a key the tool does not read, often a misspelt one; its value was left out of every check.
- Cannot see: It cannot tell what a misspelt key was meant to say; it names a known key when one is close, and the value is left out of every check.
- What to change: Correct the spelling to a key of docs/inputs.md, or remove the key.
- Points of the pages: none; this check is about the configuration file itself.

## field-invalid

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: a value of the wrong type or form: text where a number belongs, a role or feed type the tool does not know, seconds or decimals that are not whole numbers, a price that is not a plain decimal, or a field the feed type does not take.
- Cannot see: It names the value and the form it needs; the value is left out of the checks that need it.
- What to change: Write the value as docs/inputs.md shows: text for names and addresses, whole numbers for seconds and decimals, plain decimal numbers for prices and percents.
- Points of the pages: none; this check is about the configuration file itself.

## asset-duplicate

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: two assets share a name on one network (compared without case and outer spaces), so a reader cannot tell which line a finding comes from.
- Cannot see: It compares names without case and outer spaces, on one network; the same name on two networks is two assets, and two names that differ in other ways, such as WETH and WETH 2, are two assets.
- What to change: Give each asset of a network a name of its own, or merge the two.
- Points of the pages: none; this check is about the configuration file itself.

## secret-in-config

- Level: error
- Kind: a problem with the configuration file itself; it has no setting to lower
- Looks at: the configuration holds a key named for a private key, a seed or a mnemonic, or a value shaped like one; the tool never reads it and never shows it.
- Cannot see: It knows keys and seeds by the name of their key and by their shape; a key split over fields, encrypted or encoded another way is not caught, and a 32-byte id written as 64 hex digits is reported as a key.
- What to change: Remove the key from the file and from the history of the repository, and treat it as exposed: move what it controls to a new key. An oracle configuration lists public addresses only.
- Points of the pages: none; this check is about the configuration file itself.

## staleness-missing

- Level: error
- Kind: documented
- Looks at: a feed read through latestRoundData with no maxStaleness, or answer checks that do not list updatedAt, so the protocol takes an answer of any age.
- Cannot see: It reads the configuration, not the contract: whether the contract compares updatedAt with maxStaleness on every read is for the review of the code. A feed of type twap or fixed, and a custom feed with no heartbeat, are not checked for staleness.
- What to change: Give the asset a maxStaleness in seconds, from the heartbeat of the feed on its network, and list updatedAt in answerChecks.
- Points of the pages:
  - An application is told to compare the updatedAt time that latestRoundData returns with the heartbeat, or with a limit it sets for itself, and to pause or move to another mode when the answer is older than that. (Chainlink: What are Chainlink Data Feeds?, https://docs.chain.link/data-feeds/overview)
  - latestRoundData returns the round id, the answer, the start and update times of the round and answeredInRound, while latestAnswer gives the answer with no time to judge its freshness by. (Chainlink: Data Feeds API Reference, https://docs.chain.link/data-feeds/api-reference)

## staleness-too-long

- Level: warning
- Kind: documented
- Looks at: maxStaleness is longer than the documented heartbeat of the feed plus the margin (--heartbeat-margin, 10 percent by default), so answers the feed should already have replaced are taken.
- Cannot see: It compares maxStaleness with the heartbeat the configuration gives; a heartbeat copied wrongly from the list of feed addresses is compared as it is, and the live heartbeat of the feed is not read.
- What to change: Set maxStaleness to the heartbeat of the feed on this network plus a small margin, or record why the protocol accepts older answers.
- Points of the pages:
  - An application is told to compare the updatedAt time that latestRoundData returns with the heartbeat, or with a limit it sets for itself, and to pause or move to another mode when the answer is older than that. (Chainlink: What are Chainlink Data Feeds?, https://docs.chain.link/data-feeds/overview)
  - A new answer is written only when a round is started by the deviation threshold (the offchain value has moved far enough from the onchain one) or by the heartbeat threshold (a set time has passed since the last update), whichever comes first. (Chainlink: Decentralized Data Model, https://docs.chain.link/architecture-overview/architecture-decentralized-model)
  - The heartbeat and the deviation threshold belong to one feed on one chain: a wrapped or liquid staking asset may have its own, and the same asset may have other values on another chain. (Chainlink: What are Chainlink Data Feeds?, https://docs.chain.link/data-feeds/overview)

## staleness-below-heartbeat

- Level: warning
- Kind: documented
- Looks at: maxStaleness is not longer than the documented heartbeat of the feed, so in a calm market every answer goes stale before the next one and reads revert.
- Cannot see: It compares maxStaleness with the heartbeat the configuration gives; how often the feed is written in a volatile market, when the deviation threshold starts rounds before the heartbeat, is not seen.
- What to change: Set maxStaleness above the heartbeat of the feed on this network, with room for the delay before a round reaches the chain.
- Points of the pages:
  - A new answer is written only when a round is started by the deviation threshold (the offchain value has moved far enough from the onchain one) or by the heartbeat threshold (a set time has passed since the last update), whichever comes first. (Chainlink: Decentralized Data Model, https://docs.chain.link/architecture-overview/architecture-decentralized-model)
  - Feeds do not stream prices: the answer changes when the price moves past the deviation threshold or when the heartbeat has run out, a heartbeat can last several hours, and the round it starts may reach the chain a little after it. (Chainlink: What are Chainlink Data Feeds?, https://docs.chain.link/data-feeds/overview)

## bounds-missing

- Level: warning
- Kind: documented
- Looks at: an asset read from a feed with no minPrice or no maxPrice, or a minPrice of 0, so an answer outside a sane range is taken as it is.
- Cannot see: It reads whether the bounds are written, not whether the contract applies them or what it does with an answer outside them.
- What to change: Give the asset a minPrice above 0 and a maxPrice that the price of the asset should never reach, and pause or fall back on an answer outside them.
- Points of the pages:
  - On most feeds minAnswer and maxAnswer no longer keep an application from reading the latest answer, so each application has to choose the range of answers it accepts and act on an answer outside it. (Chainlink: What are Chainlink Data Feeds?, https://docs.chain.link/data-feeds/overview)
  - The reference says the minAnswer and maxAnswer values of the aggregator are not used on most feeds any more, and that each application should judge whether it needs a circuit breaker of its own. (Chainlink: Data Feeds API Reference, https://docs.chain.link/data-feeds/api-reference)

## decimals-mismatch

- Level: error
- Kind: documented
- Looks at: the decimals the protocol scales the answer by (scaleDecimals) are not the decimals the configuration gives for the feed.
- Cannot see: It compares two values of the configuration; the decimals the proxy returns on the chain are not read, and a scale built in code is not seen.
- What to change: Scale by the decimals of the feed, or read decimals() from the feed at run time and write scaleDecimals as "feed".
- Points of the pages:
  - The decimals function of AggregatorV3Interface returns how many decimals the answer carries; answers are kept as fixed-point numbers. (Chainlink: Data Feeds API Reference, https://docs.chain.link/data-feeds/api-reference)

## sequencer-check-missing

- Level: error
- Kind: documented
- Looks at: an asset on a rollup whose sequencer uptime feed the Chainlink page lists, with no sequencer check declared or with the check off.
- Cannot see: It knows the rollups of the table, which are the networks the Chainlink page lists with a sequencer uptime feed; another rollup is a note, and whether the contract reads the uptime feed before every price is for the review of the code.
- What to change: Read the sequencer uptime feed of the network before every read of a price, revert while it answers 1, and declare it under sequencer.
- Points of the pages:
  - While the sequencer of a rollup is down, most users cannot send transactions but some can still reach the chain through L1, which can distort liquidations; the uptime feed answers 0 when the sequencer is up and 1 when it is down. (Chainlink: L2 Sequencer Uptime Feeds, https://docs.chain.link/data-feeds/l2-sequencer-feeds)
  - The example consumer of the guide says that a contract reading feeds on an L2 network has to read the L2 Sequencer Uptime Feed as well, so that its data holds up when the sequencer is down. (Chainlink: Using Data Feeds on EVM Chains, https://docs.chain.link/data-feeds/using-data-feeds)

## sequencer-grace-missing

- Level: error
- Kind: documented
- Looks at: the sequencer check of an asset has no grace period, or a grace period of 0, so prices are used the moment the sequencer is back.
- Cannot see: It reads the grace period the configuration gives, not how the contract counts it; a grace period counted from another time than startedAt of the uptime feed is not seen. How long is long enough is for the team to judge.
- What to change: Wait a grace period after the sequencer comes back, counted from startedAt of the uptime feed, such as the 3600 seconds of the example of the Chainlink page.
- Points of the pages:
  - Once the sequencer is back, an application should wait for a grace period, counted from the startedAt time of the uptime feed, before it takes answers from a data feed; the example contract of the page waits 3600 seconds. (Chainlink: L2 Sequencer Uptime Feeds, https://docs.chain.link/data-feeds/l2-sequencer-feeds)

## answered-in-round-deprecated

- Level: info
- Kind: documented
- Looks at: the answer checks list answeredInRound, which the Chainlink API reference marks as deprecated.
- Cannot see: It reads the list of answer checks; whether the contract also checks updatedAt is seen only through that list.
- What to change: Do not rest on answeredInRound for freshness; check updatedAt against maxStaleness.
- Points of the pages:
  - The API reference marks answeredInRound as deprecated: it served when one answer could take several rounds to compute. (Chainlink: Data Feeds API Reference, https://docs.chain.link/data-feeds/api-reference)

## bounds-inverted

- Level: error
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: minPrice is equal to or above maxPrice, so no answer, or only one, passes the bounds.
- Cannot see: It compares the two bounds as the configuration writes them, in the unit of the answer; a contract that scales them differently is not seen.
- What to change: Write minPrice below maxPrice.
- The tool's own choice: checking that the bounds leave a range is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the pages ask for limits but say nothing of how they are written.
- Points of the pages:
  - On most feeds minAnswer and maxAnswer no longer keep an application from reading the latest answer, so each application has to choose the range of answers it accepts and act on an answer outside it. (Chainlink: What are Chainlink Data Feeds?, https://docs.chain.link/data-feeds/overview)

## bounds-exclude-reference

- Level: error
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: the referencePrice the configuration gives for the asset is outside its minPrice and maxPrice, so the bounds reject a price the team calls plausible.
- Cannot see: It compares the bounds with the referencePrice the team writes down; the tool does not know the price of the asset, and an asset with no referencePrice is not checked.
- What to change: Widen the bounds so that they hold the plausible price with room on both sides, or correct the referencePrice.
- The tool's own choice: comparing the bounds with a price the team writes down is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the pages leave the limits to each application.
- Points of the pages:
  - On most feeds minAnswer and maxAnswer no longer keep an application from reading the latest answer, so each application has to choose the range of answers it accepts and act on an answer outside it. (Chainlink: What are Chainlink Data Feeds?, https://docs.chain.link/data-feeds/overview)

## answer-checks-undeclared

- Level: warning
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: an asset read through latestRoundData whose configuration does not say which of its values the protocol checks (answerChecks).
- Cannot see: It reads only feeds of type chainlink, which are read through latestRoundData; other types have answer checks of their own that the tool does not know.
- What to change: List in answerChecks what the protocol checks on every read: updatedAt, answerPositive and, where it applies, roundComplete.
- The tool's own choice: asking the configuration to declare its answer checks is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the pages show the values of latestRoundData, not a list a protocol must write down.
- Points of the pages:
  - latestRoundData returns the round id, the answer, the start and update times of the round and answeredInRound, while latestAnswer gives the answer with no time to judge its freshness by. (Chainlink: Data Feeds API Reference, https://docs.chain.link/data-feeds/api-reference)

## answer-positive-unchecked

- Level: warning
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: the answer checks of an asset do not list answerPositive, so an answer of 0 or below would be used as a price.
- Cannot see: It reads the list of answer checks, not the contract.
- What to change: Revert on an answer of 0 or below, and list answerPositive in answerChecks.
- The tool's own choice: rejecting an answer of 0 or below is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the pages say what a feed that was shut down returns, not what a protocol must refuse.
- Points of the pages:
  - After a feed is shut down, latestAnswer gives 0 and a call to latestRoundData reverts. (Chainlink: Selecting Quality Data Feeds, https://docs.chain.link/data-feeds/selecting-data-feeds)

## address-malformed

- Level: error
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: a feed address or a sequencer feed address that is not 0x followed by 40 hex digits, or is the zero address.
- Cannot see: It checks the form of an address only; whether a contract lives at the address, whether it is a feed and whether it prices the pair of the asset are not seen, nor is the mixed case checksum of EIP-55.
- What to change: Write the address of the proxy as 0x and 40 hex digits, as the list of feed addresses of the network shows it.
- The tool's own choice: reading an address as 0x and 40 hex digits is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the pages show addresses in that form but set no rule for a configuration.
- Points of the pages: none; the check rests on the form of the value alone.

## feed-shared

- Level: warning
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: one feed address on one network prices two different assets, so one of them may get the price of the other.
- Cannot see: It compares addresses on one network without case; the same feed behind two different proxies, or a feed of the wrong pair used by one asset only, is not seen.
- What to change: Give each asset the feed of its own pair, or record that one asset is priced by the feed of the other on purpose, such as a wrapped asset by the feed of the asset under it.
- The tool's own choice: warning when two assets share one feed is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the pages treat pricing a wrapped asset by the feed of its underlying asset as a choice to weigh.
- Points of the pages:
  - Whether a wrapped or bridged asset is priced by its own feed or by the feed of the asset under it is a choice to make case by case, from the liquidity of both and the mechanism that keeps them together. (Chainlink: Selecting Quality Data Feeds, https://docs.chain.link/data-feeds/selecting-data-feeds)

## single-source-collateral

- Level: warning
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: an asset used as collateral with one price source and no fallback, or a fallback that is the same feed.
- Cannot see: It reads whether a fallback is given and whether it is the primary feed again; whether the fallback is independent of the primary, and what the protocol does when the two disagree, are not seen.
- What to change: Give the collateral a fallback of another kind (a second oracle or a time-weighted average price) and say what the protocol does when the two disagree, or record why one source is enough.
- The tool's own choice: asking for a second source on collateral is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the Chainlink page asks for a fallback on feeds of one source, and ethereum.org for many sources, not for a second oracle on every asset.
- Points of the pages:
  - Where a feed depends on one source or one provider, the page asks for bounds on the value, freshness checks, a fallback, comparison with independent references and a way to pause, above all when the feed values collateral or starts liquidations. (Chainlink: Selecting Quality Data Feeds, https://docs.chain.link/data-feeds/selecting-data-feeds)
  - The page names oracle manipulation as a risk: the spot price of one decentralized exchange can be pushed with a flash loan, and the advice is a decentralized oracle network that reads many sources, or a time-weighted average price. (ethereum.org: Smart contract security, Oracle manipulation, https://ethereum.org/en/developers/docs/smart-contracts/security/)

## pegged-price-hardcoded

- Level: error
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: an asset used as collateral whose price is fixed in the configuration (feed type fixed), such as a stablecoin valued at 1 whatever the market says.
- Cannot see: It reads the type of the feed; a price fixed in a contract, or a feed whose bounds hold the price at the peg, is not seen. A fixed price on an asset that is only borrowed is not reported.
- What to change: Price the asset from a feed, with an upper bound such as a ceiling for a stablecoin, so that a loss of the peg reaches the protocol.
- The tool's own choice: refusing a fixed price for collateral is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the Chainlink page warns that pegs break and asks for ceilings, but names no rule for a fixed price.
- Points of the pages:
  - Extreme events can pull stablecoins, synthetic assets and currencies off their peg, and the hack of a bridge can split a wrapped asset from the asset under it; the page advises circuit breakers for such events. (Chainlink: Selecting Quality Data Feeds, https://docs.chain.link/data-feeds/selecting-data-feeds)
  - For stablecoins the page asks protocols to weigh the risk of a price above the peg and to think about a ceiling on the value of each one, while still following a fall of the price in full. (Chainlink: Selecting Quality Data Feeds, https://docs.chain.link/data-feeds/selecting-data-feeds)

## network-not-in-table

- Level: info
- Kind: a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org
- Looks at: the network is not in the tool's table of networks, so whether it needs a sequencer uptime check was not judged.
- Cannot see: It only names a network it does not know; whether that network runs a sequencer, and how the protocol learns that it is down, is for the team to check.
- What to change: Check by hand whether the network runs a sequencer and how the protocol learns that it is down, or name the network as the table does (docs/inputs.md).
- The tool's own choice: keeping a short table of networks is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org; the Chainlink page lists the rollups that have a sequencer uptime feed, not every network.
- Points of the pages:
  - The page lists sequencer uptime feeds on Arbitrum, BASE, Celo, Mantle, MegaETH, Metis, OP, Scroll, Soneium, X Layer and ZKsync, and says the feeds will not be extended to more networks. (Chainlink: L2 Sequencer Uptime Feeds, https://docs.chain.link/data-feeds/l2-sequencer-feeds)
