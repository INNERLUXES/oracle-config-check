// The checks on a configuration that was read: the staleness threshold of each asset against the heartbeat of its feed,
// the bounds, the decimals, the sequencer check on a rollup, the answer checks, the addresses, a fixed price and a
// single source on collateral, and then the assets against each other for a feed that prices two of them. Each finding
// names the line of the field it is about.

import { compareDecimal, formatDecimal, isZero } from './decimal.js';
import { NETWORKS } from './networks.js';
import { BEST } from './rules.js';
import { grouped, listText } from './size.js';

const BP = `This is ${BEST}.`;
const at = (e) => ({ line: e.line, column: e.column });

// The margin, in percent of the heartbeat, that maxStaleness may pass the heartbeat by.
export const DEFAULT_HEARTBEAT_MARGIN = 10;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = /^0x0{40}$/;

// What is wrong with an address, or null when it is 0x and 40 hex digits and not the zero address.
export function addressProblem(text) {
  const v = text.trim();
  if (v !== text) return 'has spaces around it';
  if (!v.startsWith('0x')) return 'does not start with 0x';
  if (v.length !== 42) return `has ${v.length - 2} characters after 0x, not 40`;
  if (!ADDRESS.test(v)) return 'holds a character that is not a hex digit';
  if (ZERO.test(v)) return 'is the zero address';
  return null;
}

// A number of seconds as a report writes it: "86,400 seconds (24 hours)", "1,260 seconds (21 minutes)", or the seconds
// alone when they are not a whole number of hours, or of minutes below two hours.
export function duration(s) {
  const unit = s >= 3600 && s % 3600 === 0 ? [s / 3600, 'hour'] : s >= 60 && s < 7200 && s % 60 === 0 ? [s / 60, 'minute'] : null;
  const base = `${grouped(s)} ${s === 1 ? 'second' : 'seconds'}`;
  return unit ? `${base} (${grouped(unit[0])} ${unit[0] === 1 ? unit[1] : `${unit[1]}s`})` : base;
}

const reads = (feed) => feed !== null && feed.type !== null && feed.type !== 'fixed';

// The checks of a configuration: { findings, notes, rows }. rows holds each asset as the table of the report shows it.
export function analyzeConfig(config, { heartbeatMargin = DEFAULT_HEARTBEAT_MARGIN } = {}) {
  const findings = [];
  const notes = [];
  const add = (id, where, message, asset) => findings.push({ id, line: where.line, column: where.column, message, entry: asset?.title ?? null });
  const unread = [];

  for (const a of config.assets) {
    const of = `asset ${a.title}`;
    const Of = `Asset ${a.title}`;
    const feed = a.feed;
    if (feed === null || feed.type === null) unread.push(a.title);

    // Addresses of the feed, the fallback and the sequencer uptime feed.
    const addresses = [[feed, 'the feed'], [a.fallback, 'the fallback']].filter(([f]) => f && f.address !== null).map(([f, what]) => [f.address, f.addressEntry, what]);
    if (a.sequencer && a.sequencer.feed !== null) addresses.push([a.sequencer.feed, a.sequencer.feedEntry, 'the sequencer uptime feed']);
    for (const [text, entry, what] of addresses) {
      const problem = addressProblem(text);
      if (problem) add('address-malformed', at(entry), `The address of ${what} of ${of} is "${text.length > 60 ? `${text.slice(0, 57)}...` : text}", which ${problem}; an address is 0x followed by 40 hex digits. ${BP}`, a);
    }

    if (a.network === null && a.networkText !== null) {
      add('network-not-in-table', at(a.networkEntry), `The network "${a.networkText.length > 60 ? `${a.networkText.slice(0, 57)}...` : a.networkText}" of ${of} is not in the tool's table (${NETWORKS.map((n) => n.id).join(', ')}), so whether it runs a sequencer that needs an uptime check was not judged. ${BP}`, a);
    }

    if (feed === null || feed.type === null) continue;
    const collateral = a.role === 'collateral' || a.role === 'both';

    if (feed.type === 'fixed') {
      if (collateral) {
        const price = feed.price ? ` at ${formatDecimal(feed.price)}` : '';
        add('pegged-price-hardcoded', at(feed.typeEntry), `The price of ${of} is fixed in the configuration${price}, and the asset is used as ${a.role === 'both' ? 'collateral and borrowed' : 'collateral'}: if it loses its peg, the protocol still values it${price}, lends against it at that value and does not liquidate the loans it backs. The Chainlink page on selecting feeds warns that stablecoins and wrapped assets can lose their peg. ${BP}`, a);
      }
      continue;
    }

    // Staleness, for feeds that carry a heartbeat.
    const heartbeat = feed.heartbeat;
    const staleKnown = feed.type === 'chainlink' || (feed.type === 'custom' && heartbeat !== null);
    if (staleKnown) {
      const missingUpdatedAt = a.answerChecks !== null && !a.answerChecks.some((c) => c.value === 'updatedAt');
      if (a.maxStalenessEntry === null) {
        add('staleness-missing', at(a), `${Of} has no maxStaleness, so the protocol takes an answer of any age${heartbeat !== null ? `; its feed has a heartbeat of ${duration(heartbeat)}, and an answer older than that means the feed has stopped or lags` : ''}. The Chainlink overview asks an application to compare updatedAt with the heartbeat and to pause when the answer is older.`, a);
      } else if (missingUpdatedAt) {
        add('staleness-missing', at(a.answerChecksEntry), `The answer checks of ${of} do not list updatedAt, so the maxStaleness of the configuration is never compared with the age of the answer. The Chainlink overview asks an application to compare updatedAt with the heartbeat and to pause when the answer is older.`, a);
      } else if (a.maxStaleness !== null && heartbeat !== null) {
        const limit = Math.floor((heartbeat * (100 + heartbeatMargin)) / 100);
        if (a.maxStaleness * 100 > heartbeat * (100 + heartbeatMargin)) {
          add('staleness-too-long', at(a.maxStalenessEntry), `${Of} accepts answers up to ${duration(a.maxStaleness)} old, but the configuration gives its feed a heartbeat of ${duration(heartbeat)}; with the margin of ${heartbeatMargin} percent the limit is ${duration(limit)}. An answer older than that is one the feed should already have replaced, and liquidations and borrows go on at a price that may be gone.`, a);
        } else if (a.maxStaleness <= heartbeat) {
          const same = a.maxStaleness === heartbeat ? 'equal to the heartbeat of its feed' : `shorter than the heartbeat of its feed, ${duration(heartbeat)}`;
          add('staleness-below-heartbeat', at(a.maxStalenessEntry), `${Of} accepts answers up to ${duration(a.maxStaleness)} old, ${same}. In a calm market the feed is written only when the heartbeat runs out, and the round can reach the chain a little after it, so reads revert ${a.maxStaleness === heartbeat ? 'for a while before every heartbeat round' : 'for part of every heartbeat'} and liquidations and repayments stop with them.`, a);
        }
      }
    }

    // Bounds.
    const low = a.minPrice;
    const high = a.maxPrice;
    const missing = [a.minPriceEntry === null ? 'no minPrice' : null, a.maxPriceEntry === null ? 'no maxPrice' : null].filter(Boolean);
    if (missing.length) {
      add('bounds-missing', at(a), `${Of} has ${missing.join(' and ')}, so an answer far outside any price the asset can have is used as it is. On most feeds minAnswer and maxAnswer no longer stop such an answer; the Chainlink pages leave the limits to the application.`, a);
    } else if (low && isZero(low)) {
      add('bounds-missing', at(a.minPriceEntry), `The minPrice of ${of} is 0, so an answer of 0, the answer of a feed that was shut down or broke, passes the bounds. On most feeds minAnswer and maxAnswer no longer stop such an answer; the Chainlink pages leave the limits to the application.`, a);
    }
    if (low && high && compareDecimal(low, high) >= 0) {
      add('bounds-inverted', at(a.maxPriceEntry), `The maxPrice of ${of} is ${formatDecimal(high)}, ${compareDecimal(low, high) === 0 ? 'equal to' : 'below'} its minPrice of ${formatDecimal(low)}, so ${compareDecimal(low, high) === 0 ? 'only one price passes' : 'no price passes'} the bounds and every read reverts or falls back. ${BP}`, a);
    } else if (a.referencePrice) {
      const ref = a.referencePrice;
      const below = low && compareDecimal(ref, low) < 0;
      const above = high && compareDecimal(ref, high) > 0;
      if (below || above) {
        add('bounds-exclude-reference', at(a.referencePriceEntry), `The referencePrice of ${of} is ${formatDecimal(ref)}, ${below ? `below its minPrice of ${formatDecimal(low)}` : `above its maxPrice of ${formatDecimal(high)}`}: the bounds reject a price the configuration itself calls plausible, so reads revert or fall back at that price. ${BP}`, a);
      }
    }

    // Decimals.
    if (typeof a.scaleDecimals === 'number' && feed.decimals !== null && a.scaleDecimals !== feed.decimals) {
      const factor = 10n ** BigInt(Math.abs(feed.decimals - a.scaleDecimals));
      add('decimals-mismatch', at(a.scaleEntry), `${Of} scales the answer by ${a.scaleDecimals} decimals, but its feed answers with ${feed.decimals}: every price is ${feed.decimals > a.scaleDecimals ? 'too high' : 'too low'} by a factor of ${grouped(factor)}, which lets ${feed.decimals > a.scaleDecimals ? 'borrowers take far more than their collateral is worth' : 'positions be liquidated at once'}. The Chainlink API reference says decimals() gives the decimals of the answer.`, a);
    }

    // The values of latestRoundData that are checked.
    if (feed.type === 'chainlink') {
      if (a.answerChecksEntry === null) {
        add('answer-checks-undeclared', at(a), `${Of} is read through latestRoundData, but its configuration has no answerChecks, so it does not say whether the protocol checks the time of the answer, that the answer is above 0, or that the round is complete. ${BP}`, a);
      } else if (a.answerChecks !== null) {
        if (!a.answerChecks.some((c) => c.value === 'answerPositive')) add('answer-positive-unchecked', at(a.answerChecksEntry), `The answer checks of ${of} do not list answerPositive, so an answer of 0 or below would be used as a price; a feed that was shut down gives 0 from latestAnswer. ${BP}`, a);
        for (const c of a.answerChecks.filter((x) => x.value === 'answeredInRound')) add('answered-in-round-deprecated', at(c), `The answer checks of ${of} list answeredInRound, which the Chainlink API reference marks as deprecated; it says nothing of the age of the answer, which updatedAt and maxStaleness do.`, a);
      }
    }

    // The sequencer of a rollup.
    if (a.network && a.network.kind === 'rollup') {
      const seq = a.sequencer;
      if (a.sequencerEntry === null || (seq && seq.checked === false)) {
        add('sequencer-check-missing', at(seq ? seq.checkedEntry : a.networkEntry), `${Of} is priced on ${a.network.title}, a rollup with a sequencer uptime feed, but the configuration ${seq ? 'turns the sequencer check off' : 'declares no sequencer check'}. While the sequencer is down, most users cannot add collateral or repay, while some can still reach the chain through L1, and stale prices drive liquidations when it comes back.`, a);
      } else if (seq && seq.checked === true && seq.gracePeriodEntry === null) {
        add('sequencer-grace-missing', at(a.sequencerEntry), `The sequencer check of ${of} has no gracePeriod, so prices are used the moment the sequencer is back, before users who could not reach the chain had a chance to add collateral or repay. The Chainlink page asks for a grace period, and its example waits 3600 seconds.`, a);
      } else if (seq && seq.checked === true && seq.gracePeriod === 0) {
        add('sequencer-grace-missing', at(seq.gracePeriodEntry), `The sequencer check of ${of} has a gracePeriod of 0, so prices are used the moment the sequencer is back, before users who could not reach the chain had a chance to add collateral or repay. The Chainlink page asks for a grace period, and its example waits 3600 seconds.`, a);
      }
    }

    // One source on collateral.
    if (collateral) {
      const fb = a.fallback;
      const same = fb && fb.address !== null && feed.address !== null && fb.address.trim().toLowerCase() === feed.address.trim().toLowerCase();
      if (a.fallbackEntry === null || same) {
        add('single-source-collateral', at(same ? fb.addressEntry : a.feedEntry), `${Of} is used as ${a.role === 'both' ? 'collateral and borrowed' : 'collateral'} and ${same ? 'its fallback is the same feed as its primary feed' : 'has one price source and no fallback'}, so a feed that stops, lags or is pushed off the market moves every loan it backs at once, and the protocol has nothing to compare it with. ${BP}`, a);
      }
    }
  }

  // One feed address on one network for two assets: each asset against the ones before it, reported once at the later one.
  const used = new Map();
  for (const a of config.assets) {
    if (!a.network && a.networkText === null) continue;
    const net = a.network ? a.network.id : a.networkText.trim().toLowerCase();
    const name = (a.name ?? a.title).trim().toLowerCase();
    let reported = false;
    for (const [f, what] of [[a.feed, 'feed'], [a.fallback, 'fallback']]) {
      if (!reads(f) || f.address === null || addressProblem(f.address)) continue;
      const key = `${net} ${f.address.toLowerCase()}`;
      const first = used.get(key);
      if (first && first.name !== name && !reported) {
        add('feed-shared', at(f.addressEntry), `The ${what} of asset ${a.title} has the address of the ${first.what} of asset ${first.asset.title} at line ${first.entry.line}, on the same network, so the two assets get one price. When one of them is a wrapped asset priced by the feed of the asset under it, record that choice; otherwise one of them has the wrong feed. ${BP}`, a);
        reported = true;
      } else if (!first) used.set(key, { name, asset: a, entry: f.addressEntry, what });
    }
  }

  if (unread.length) notes.push(`the feed of ${listText(unread)} could not be read, so ${unread.length === 1 ? 'it was' : 'they were'} not checked for staleness, bounds, decimals or answer checks, and not compared with the other assets`);

  const rows = config.assets.map((a) => ({
    asset: a.name ?? a.title,
    network: a.network ? a.network.id : a.networkText,
    role: a.role,
    feed: a.feed ? a.feed.type : null,
    fallback: a.fallback ? a.fallback.type : null,
    heartbeat: a.feed && a.feed.type !== 'fixed' ? a.feed.heartbeat : null,
    maxStaleness: a.maxStaleness,
    decimals: a.feed ? a.feed.decimals : null,
    scaleDecimals: a.scaleDecimals,
    bounds: a.minPrice || a.maxPrice ? `${a.minPrice ? formatDecimal(a.minPrice) : '-'}..${a.maxPrice ? formatDecimal(a.maxPrice) : '-'}` : null,
    sequencer: a.sequencer === null ? null : a.sequencer.checked === true ? (a.sequencer.gracePeriod === null ? 'on' : `on, ${a.sequencer.gracePeriod}s`) : a.sequencer.checked === false ? 'off' : null
  }));
  return { findings, notes, rows };
}

