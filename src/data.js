// The public pages the checks rest on, and the points of each page that the reports show, written in this project's own
// words. A page is named by its address; a copy of its text, read before it was listed, is kept under research/sources.
// research/sources.md lists every page with a note, docs/rules-and-sources.md lists every rule with its points, and
// test/data.test.js checks the three against each other.

export const LEVELS = ['info', 'warning', 'error'];

export const NOT_A = 'not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail';

export const NOTICE = `This report is an input to a review before the protocol is deployed: ${NOT_A}.`;

const CL = 'https://docs.chain.link';

export const SOURCES = [
  { id: 'chainlink-overview', title: 'Chainlink: What are Chainlink Data Feeds?', url: `${CL}/data-feeds/overview`, file: 'research/sources/chainlink-data-feeds-overview.txt' },
  { id: 'chainlink-model', title: 'Chainlink: Decentralized Data Model', url: `${CL}/architecture-overview/architecture-decentralized-model`, file: 'research/sources/chainlink-decentralized-data-model.txt' },
  { id: 'chainlink-api', title: 'Chainlink: Data Feeds API Reference', url: `${CL}/data-feeds/api-reference`, file: 'research/sources/chainlink-data-feeds-api-reference.txt' },
  { id: 'chainlink-using', title: 'Chainlink: Using Data Feeds on EVM Chains', url: `${CL}/data-feeds/using-data-feeds`, file: 'research/sources/chainlink-using-data-feeds.txt' },
  { id: 'chainlink-l2', title: 'Chainlink: L2 Sequencer Uptime Feeds', url: `${CL}/data-feeds/l2-sequencer-feeds`, file: 'research/sources/chainlink-l2-sequencer-uptime-feeds.txt' },
  { id: 'chainlink-selecting', title: 'Chainlink: Selecting Quality Data Feeds', url: `${CL}/data-feeds/selecting-data-feeds`, file: 'research/sources/chainlink-selecting-quality-data-feeds.txt' },
  { id: 'ethereum-security', title: 'ethereum.org: Smart contract security, Oracle manipulation', url: 'https://ethereum.org/en/developers/docs/smart-contracts/security/', file: 'research/sources/ethereum-org-smart-contract-security-oracle-manipulation.txt' }
];

// Points: id -> { source, text }.
export const POINTS = {
  'overview-updated-at': { source: 'chainlink-overview', text: 'An application is told to compare the updatedAt time that latestRoundData returns with the heartbeat, or with a limit it sets for itself, and to pause or move to another mode when the answer is older than that.' },
  'overview-heartbeat': { source: 'chainlink-overview', text: 'Feeds do not stream prices: the answer changes when the price moves past the deviation threshold or when the heartbeat has run out, a heartbeat can last several hours, and the round it starts may reach the chain a little after it.' },
  'overview-per-chain': { source: 'chainlink-overview', text: 'The heartbeat and the deviation threshold belong to one feed on one chain: a wrapped or liquid staking asset may have its own, and the same asset may have other values on another chain.' },
  'overview-limits': { source: 'chainlink-overview', text: 'On most feeds minAnswer and maxAnswer no longer keep an application from reading the latest answer, so each application has to choose the range of answers it accepts and act on an answer outside it.' },
  'model-triggers': { source: 'chainlink-model', text: 'A new answer is written only when a round is started by the deviation threshold (the offchain value has moved far enough from the onchain one) or by the heartbeat threshold (a set time has passed since the last update), whichever comes first.' },
  'api-decimals': { source: 'chainlink-api', text: 'The decimals function of AggregatorV3Interface returns how many decimals the answer carries; answers are kept as fixed-point numbers.' },
  'api-latest-round-data': { source: 'chainlink-api', text: 'latestRoundData returns the round id, the answer, the start and update times of the round and answeredInRound, while latestAnswer gives the answer with no time to judge its freshness by.' },
  'api-answered-in-round': { source: 'chainlink-api', text: 'The API reference marks answeredInRound as deprecated: it served when one answer could take several rounds to compute.' },
  'api-min-max': { source: 'chainlink-api', text: 'The reference says the minAnswer and maxAnswer values of the aggregator are not used on most feeds any more, and that each application should judge whether it needs a circuit breaker of its own.' },
  'using-l2': { source: 'chainlink-using', text: 'The example consumer of the guide says that a contract reading feeds on an L2 network has to read the L2 Sequencer Uptime Feed as well, so that its data holds up when the sequencer is down.' },
  'l2-outage': { source: 'chainlink-l2', text: 'While the sequencer of a rollup is down, most users cannot send transactions but some can still reach the chain through L1, which can distort liquidations; the uptime feed answers 0 when the sequencer is up and 1 when it is down.' },
  'l2-grace': { source: 'chainlink-l2', text: 'Once the sequencer is back, an application should wait for a grace period, counted from the startedAt time of the uptime feed, before it takes answers from a data feed; the example contract of the page waits 3600 seconds.' },
  'l2-networks': { source: 'chainlink-l2', text: 'The page lists sequencer uptime feeds on Arbitrum, BASE, Celo, Mantle, MegaETH, Metis, OP, Scroll, Soneium, X Layer and ZKsync, and says the feeds will not be extended to more networks.' },
  'selecting-single-source': { source: 'chainlink-selecting', text: 'Where a feed depends on one source or one provider, the page asks for bounds on the value, freshness checks, a fallback, comparison with independent references and a way to pause, above all when the feed values collateral or starts liquidations.' },
  'selecting-depeg': { source: 'chainlink-selecting', text: 'Extreme events can pull stablecoins, synthetic assets and currencies off their peg, and the hack of a bridge can split a wrapped asset from the asset under it; the page advises circuit breakers for such events.' },
  'selecting-stablecoin': { source: 'chainlink-selecting', text: 'For stablecoins the page asks protocols to weigh the risk of a price above the peg and to think about a ceiling on the value of each one, while still following a fall of the price in full.' },
  'selecting-wrapped': { source: 'chainlink-selecting', text: 'Whether a wrapped or bridged asset is priced by its own feed or by the feed of the asset under it is a choice to make case by case, from the liquidity of both and the mechanism that keeps them together.' },
  'selecting-shutdown': { source: 'chainlink-selecting', text: 'After a feed is shut down, latestAnswer gives 0 and a call to latestRoundData reverts.' },
  'ethereum-oracle': { source: 'ethereum-security', text: 'The page names oracle manipulation as a risk: the spot price of one decentralized exchange can be pushed with a flash loan, and the advice is a decentralized oracle network that reads many sources, or a time-weighted average price.' }
};

export const source = (id) => SOURCES.find((s) => s.id === id);
export const pointPage = (id) => source(POINTS[id].source);
