// The networks the tool knows. A rollup in the table is one for which the saved copy of the page on L2 Sequencer
// Uptime Feeds (research/sources/chainlink-l2-sequencer-uptime-feeds.txt) lists a sequencer uptime feed, and
// test/data.test.js checks every rollup of the table against that copy. The other networks are chains that run no
// sequencer of their own; which chains those are is the tool's own table. A network out of the table is a note, and the
// sequencer checks are not made for it.

// kind: 'rollup' an L2 whose sequencer uptime feed the page lists; 'chain' a chain with no sequencer uptime feed to read.
// title: the name as the heading of the page writes it, for a rollup.
export const NETWORKS = [
  { id: 'ethereum', aliases: ['mainnet', 'ethereum-mainnet'], kind: 'chain', title: 'Ethereum' },
  { id: 'polygon', aliases: ['polygon-pos', 'matic'], kind: 'chain', title: 'Polygon PoS' },
  { id: 'bnb', aliases: ['bsc', 'bnb-chain', 'binance-smart-chain'], kind: 'chain', title: 'BNB Chain' },
  { id: 'avalanche', aliases: ['avalanche-c', 'avax'], kind: 'chain', title: 'Avalanche C-Chain' },
  { id: 'gnosis', aliases: ['xdai'], kind: 'chain', title: 'Gnosis Chain' },
  { id: 'arbitrum', aliases: ['arbitrum-one'], kind: 'rollup', title: 'Arbitrum' },
  { id: 'base', aliases: [], kind: 'rollup', title: 'BASE' },
  { id: 'celo', aliases: [], kind: 'rollup', title: 'Celo' },
  { id: 'mantle', aliases: [], kind: 'rollup', title: 'Mantle' },
  { id: 'megaeth', aliases: [], kind: 'rollup', title: 'MegaETH' },
  { id: 'metis', aliases: ['metis-andromeda', 'andromeda'], kind: 'rollup', title: 'Metis' },
  { id: 'optimism', aliases: ['op', 'op-mainnet'], kind: 'rollup', title: 'OP' },
  { id: 'scroll', aliases: [], kind: 'rollup', title: 'Scroll' },
  { id: 'soneium', aliases: [], kind: 'rollup', title: 'Soneium' },
  { id: 'x-layer', aliases: ['xlayer'], kind: 'rollup', title: 'X Layer' },
  { id: 'zksync', aliases: ['zksync-era'], kind: 'rollup', title: 'ZKsync' }
];

const norm = (text) => text.trim().toLowerCase();

// The network of the table a name stands for, by its id or an alias, in any case, or null.
export const networkOf = (text) => NETWORKS.find((n) => n.id === norm(text) || n.aliases.includes(norm(text))) ?? null;

// The ids of the rollups of the table.
export const ROLLUPS = NETWORKS.filter((n) => n.kind === 'rollup').map((n) => n.id);
