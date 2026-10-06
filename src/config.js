// Reading an oracle configuration from the nodes of the JSON reader. Every field is read with the line and column of its
// key, so a finding can point at it. A field that is missing, of the wrong type or unknown is a finding of its own, and
// the value is left out of the checks that need it; nothing that was not read is taken for a value that is fine. Keys of
// the file are only compared with the names below; no object is built with a key from the file. A value that
// src/secrets.js marked as a seed or a key is left out as if it were not there, and never shown.

import { isArray, isNumber, isObject, isString } from './json.js';
import { parseDecimal, compareDecimal } from './decimal.js';
import { networkOf } from './networks.js';

export const CONFIG_LIMITS = { maxAssets: 1000, maxSeconds: 100000000, maxDecimals: 36, maxAnswerChecks: 20 };

export const TOP_KEYS = ['protocol', 'assets', 'notes'];
export const ASSET_KEYS = ['name', 'network', 'role', 'feed', 'fallback', 'maxStaleness', 'minPrice', 'maxPrice', 'referencePrice', 'scaleDecimals', 'sequencer', 'answerChecks', 'notes'];
export const FEED_KEYS = ['type', 'pair', 'address', 'heartbeat', 'deviation', 'decimals', 'window', 'price', 'notes'];
export const SEQUENCER_KEYS = ['checked', 'feed', 'gracePeriod', 'notes'];
export const ROLES = ['collateral', 'borrowable', 'both'];
export const ANSWER_CHECKS = ['updatedAt', 'answerPositive', 'roundComplete', 'answeredInRound'];

// The feed types: the fields each needs and the fields it takes besides type, pair and notes.
//   chainlink  an AggregatorV3Interface proxy, read through latestRoundData
//   custom     another oracle contract with an interface of its own
//   twap       a time-weighted average price read from a pool
//   fixed      a price written in the configuration, read from no contract
export const FEED_TYPES = [
  { id: 'chainlink', needs: ['address', 'heartbeat', 'decimals'], takes: ['deviation'] },
  { id: 'custom', needs: ['address', 'decimals'], takes: ['heartbeat', 'deviation'] },
  { id: 'twap', needs: ['address', 'window'], takes: ['decimals'] },
  { id: 'fixed', needs: ['price'], takes: [] }
];

const where = (e) => ({ line: e.line, column: e.column });

// A text from the file as a message names it: cut at a length, so that a long value does not fill a report.
export const cut = (text, max = 120) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// A known key that an unknown one is probably meant to be: the same letters in another case, or one that starts with the
// other.
export function suggestKey(key, known) {
  const k = key.toLowerCase();
  if (k.length < 3) return null;
  return known.find((n) => n.toLowerCase() === k) ?? known.find((n) => n.toLowerCase().startsWith(k) || k.startsWith(n.toLowerCase())) ?? null;
}

export const describe = (node) => (node.secret ? 'a value that is not shown' : node.kind === 'object' ? 'an object' : node.kind === 'array' ? 'a list' : node.kind === 'null' ? 'null' : node.kind === 'boolean' ? `${node.value}` : node.kind === 'number' ? `the number ${node.raw.length > 40 ? `${node.raw.slice(0, 37)}...` : node.raw}` : 'text');

const SECONDS = /^(?:0|[1-9][0-9]{0,8})$/;
const SMALL = /^(?:0|[1-9][0-9]?)$/;
const HUNDRED = parseDecimal('100');

// Reads the configuration from the root node: { config, findings, notes }.
export function readConfig(root, limits = CONFIG_LIMITS) {
  const findings = [];
  const notes = [];
  const add = (id, at, message, extra = {}) => findings.push({ id, line: at.line, column: at.column, message, ...extra });

  // The entries of an object, with a field-unknown finding for each key that is not in known, and the first entry of each
  // known key in a map. A key that names a seed or a key was reported by src/secrets.js and is passed over.
  function fields(obj, known, label) {
    const map = new Map();
    for (const e of obj.entries) {
      if (e.secret) continue;
      if (known.includes(e.key)) map.set(e.key, e);
      else {
        const near = suggestKey(e.key, known);
        add('field-unknown', where(e), `The key "${cut(e.key)}" of ${label} is not one the tool reads, so its value was left out of every check.${near ? ` Did you mean "${near}"?` : ''} The keys of ${label} are ${known.join(', ')}.`);
      }
    }
    return map;
  }

  // A text field: null when it is missing, empty, of another type or marked as a secret.
  function text(map, key, at, Label, required, of) {
    const e = map.get(key);
    if (!e) {
      if (required) add('field-missing', at, `${Label} has no ${key}.`);
      return { value: null, entry: null };
    }
    if (e.value.secret) return { value: null, entry: e };
    if (!isString(e.value)) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be text.`);
      return { value: null, entry: e };
    }
    if (e.value.value.trim() === '') {
      add('field-invalid', where(e), `The ${key} of ${of} is empty.`);
      return { value: null, entry: e };
    }
    return { value: e.value.value, entry: e };
  }

  // A whole number of seconds: null when it is missing or invalid; a missing field is not a finding here.
  function seconds(map, key, of) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null };
    if (!isNumber(e.value) || !SECONDS.test(e.value.raw) || Number(e.value.raw) > limits.maxSeconds) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a whole number of seconds from 0 to ${limits.maxSeconds}, written as a number.`);
      return { value: null, entry: e };
    }
    return { value: Number(e.value.raw), entry: e };
  }

  // A count of decimals from 0 to maxDecimals.
  function decimals(map, key, of) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null };
    if (!isNumber(e.value) || !SMALL.test(e.value.raw) || Number(e.value.raw) > limits.maxDecimals) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a whole number of decimals from 0 to ${limits.maxDecimals}.`);
      return { value: null, entry: e };
    }
    return { value: Number(e.value.raw), entry: e };
  }

  // A plain decimal number, such as 1500 or 0.98: { value: { int, scale }, raw }.
  function decimal(map, key, of, what = 'a price') {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null };
    const d = isNumber(e.value) ? parseDecimal(e.value.raw) : null;
    if (!d) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; ${what} must be a plain decimal number of up to 40 digits on each side of the point, written as a number with no sign and no exponent, such as 1500 or 0.98.`);
      return { value: null, entry: e };
    }
    return { value: d, entry: e };
  }

  // A feed object: the primary feed or the fallback of an asset.
  function readFeed(node, of) {
    const label = `the ${of}`;
    const map = fields(node, FEED_KEYS, label);
    const at = where(node);
    const Label = `The ${of}`;
    const feed = { line: node.line, column: node.column, type: null, typeEntry: null, pair: null, address: null, addressEntry: null, heartbeat: null, heartbeatEntry: null, deviation: null, deviationEntry: null, decimals: null, decimalsEntry: null, window: null, windowEntry: null, price: null, priceEntry: null };
    const type = text(map, 'type', at, Label, true, label);
    feed.typeEntry = type.entry;
    let spec = null;
    if (type.value !== null) {
      spec = FEED_TYPES.find((t) => t.id === type.value.trim().toLowerCase()) ?? null;
      if (spec) feed.type = spec.id;
      else add('field-invalid', where(type.entry), `The type of ${label} is "${cut(type.value)}", not one the tool knows; it must be one of ${FEED_TYPES.map((t) => t.id).join(', ')}.`);
    }
    feed.pair = text(map, 'pair', at, Label, false, label).value;
    const address = text(map, 'address', at, Label, false, label);
    feed.address = address.value;
    feed.addressEntry = address.entry;
    for (const [key, read] of [['heartbeat', seconds], ['window', seconds], ['decimals', decimals]]) {
      const r = read(map, key, label);
      feed[key] = r.value;
      feed[`${key}Entry`] = r.entry;
    }
    const deviation = decimal(map, 'deviation', label, 'a deviation threshold in percent');
    if (deviation.value && (deviation.value.int === 0n || compareDecimal(deviation.value, HUNDRED) > 0)) {
      add('field-invalid', where(deviation.entry), `The deviation of ${label} is ${deviation.entry.value.raw}; it must be a percent above 0 and up to 100.`);
      feed.deviationEntry = deviation.entry;
    } else {
      feed.deviation = deviation.value;
      feed.deviationEntry = deviation.entry;
    }
    const price = decimal(map, 'price', label);
    feed.price = price.value;
    feed.priceEntry = price.entry;
    if (spec) {
      const missing = spec.needs.filter((k) => !map.has(k));
      if (missing.length) add('field-missing', at, `${Label} is of type ${spec.id}, which needs ${spec.needs.join(', ')}; the configuration has no ${missing.join(' and no ')}.`);
      for (const k of ['address', 'heartbeat', 'deviation', 'decimals', 'window', 'price']) {
        const e = map.get(k);
        if (e && !spec.needs.includes(k) && !spec.takes.includes(k)) {
          add('field-invalid', where(e), `${Label} is of type ${spec.id}, which takes no ${k}; the value was left out of every check.`);
          feed[k] = null;
        }
      }
    }
    return feed;
  }

  function readSequencer(node, of) {
    const label = `the sequencer check of ${of}`;
    const map = fields(node, SEQUENCER_KEYS, label);
    const at = where(node);
    const seq = { line: node.line, column: node.column, checked: null, checkedEntry: map.get('checked') ?? null, feed: null, feedEntry: null, gracePeriod: null, gracePeriodEntry: null };
    const c = seq.checkedEntry;
    if (!c) add('field-missing', at, `The sequencer check of ${of} has no checked; write true when the protocol reads the sequencer uptime feed and false when it does not.`);
    else if (!c.value.secret) {
      if (c.value.kind !== 'boolean') add('field-invalid', where(c), `The checked of ${label} is ${describe(c.value)}; it must be true or false.`);
      else seq.checked = c.value.value;
    }
    const feed = text(map, 'feed', at, `The sequencer check of ${of}`, seq.checked === true, label);
    seq.feed = feed.value;
    seq.feedEntry = feed.entry;
    const grace = seconds(map, 'gracePeriod', label);
    seq.gracePeriod = grace.value;
    seq.gracePeriodEntry = grace.entry;
    return seq;
  }

  function readAsset(node, index) {
    const label = `asset ${index + 1}`;
    const map = fields(node, ASSET_KEYS, label);
    const at = where(node);
    const Label = `Asset ${index + 1}`;
    const name = text(map, 'name', at, Label, true, label);
    const asset = { index, name: name.value, nameEntry: name.entry, line: node.line, column: node.column };
    const network = text(map, 'network', at, Label, true, `asset ${name.value === null ? index + 1 : cut(name.value)}`);
    asset.networkText = network.value;
    asset.networkEntry = network.entry;
    asset.network = network.value === null ? null : networkOf(network.value);
    asset.title = `${name.value === null ? label : cut(name.value)}${network.value === null ? '' : ` on ${cut(network.value.trim(), 60)}`}`;
    const of = `asset ${asset.title}`;

    const role = text(map, 'role', at, Label, true, of);
    asset.roleEntry = role.entry;
    asset.role = null;
    if (role.value !== null) {
      const v = role.value.trim().toLowerCase();
      if (ROLES.includes(v)) asset.role = v;
      else add('field-invalid', where(role.entry), `The role of ${of} is "${cut(role.value)}"; it must be ${ROLES.slice(0, -1).join(', ')} or ${ROLES.at(-1)}.`);
    }

    for (const key of ['feed', 'fallback']) {
      const e = map.get(key);
      asset[`${key}Entry`] = e ?? null;
      asset[key] = null;
      if (!e) {
        if (key === 'feed') add('field-missing', at, `${Label} has no feed.`);
        continue;
      }
      if (e.value.secret) continue;
      if (!isObject(e.value)) add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be an object with a type and the fields of that type.`);
      else asset[key] = readFeed(e.value, `${key === 'feed' ? 'feed' : 'fallback'} of ${of}`);
    }

    const stale = seconds(map, 'maxStaleness', of);
    asset.maxStaleness = stale.value;
    asset.maxStalenessEntry = stale.entry;
    for (const key of ['minPrice', 'maxPrice', 'referencePrice']) {
      const r = decimal(map, key, of);
      asset[key] = r.value;
      asset[`${key}Entry`] = r.entry;
    }

    asset.scaleEntry = map.get('scaleDecimals') ?? null;
    asset.scaleDecimals = null;
    const s = asset.scaleEntry;
    if (!s) add('field-missing', at, `${Label} has no scaleDecimals; give the decimals the protocol scales the answer by, or "feed" when it reads decimals() from the feed.`);
    else if (!s.value.secret) {
      if (isString(s.value) && s.value.value.trim().toLowerCase() === 'feed') asset.scaleDecimals = 'feed';
      else if (isNumber(s.value) && SMALL.test(s.value.raw) && Number(s.value.raw) <= limits.maxDecimals) asset.scaleDecimals = Number(s.value.raw);
      else add('field-invalid', where(s), `The scaleDecimals of ${of} is ${isString(s.value) ? `"${cut(s.value.value)}"` : describe(s.value)}; it must be a whole number of decimals from 0 to ${limits.maxDecimals}, or "feed".`);
    }

    const sq = map.get('sequencer');
    asset.sequencerEntry = sq ?? null;
    asset.sequencer = null;
    if (sq && !sq.value.secret) {
      if (!isObject(sq.value)) add('field-invalid', where(sq), `The sequencer of ${of} is ${describe(sq.value)}; it must be an object with checked, feed and gracePeriod.`);
      else asset.sequencer = readSequencer(sq.value, of);
    }

    const ac = map.get('answerChecks');
    asset.answerChecksEntry = ac ?? null;
    asset.answerChecks = null;
    if (ac && !ac.value.secret) {
      if (!isArray(ac.value)) add('field-invalid', where(ac), `The answerChecks of ${of} are ${describe(ac.value)}; they must be a list of ${ANSWER_CHECKS.join(', ')}.`);
      else if (ac.value.items.length > limits.maxAnswerChecks) add('field-invalid', where(ac), `The answerChecks of ${of} hold ${ac.value.items.length} values, more than the limit of ${limits.maxAnswerChecks}.`);
      else {
        asset.answerChecks = [];
        for (const item of ac.value.items) {
          if (item.secret) continue;
          const known = isString(item) ? ANSWER_CHECKS.find((k) => k.toLowerCase() === item.value.trim().toLowerCase()) : undefined;
          if (known) asset.answerChecks.push({ value: known, line: item.line, column: item.column });
          else add('field-invalid', where(item), `An answer check of ${of} is ${isString(item) ? `"${cut(item.value)}"` : describe(item)}; the answer checks are ${ANSWER_CHECKS.join(', ')}.`);
        }
      }
    }

    const notesEntry = map.get('notes');
    if (notesEntry && !notesEntry.value.secret && !isString(notesEntry.value)) add('field-invalid', where(notesEntry), `The notes of ${of} are ${describe(notesEntry.value)}; they must be text.`);
    return asset;
  }

  if (!isObject(root)) {
    add('config-unreadable', root, `The file holds ${describe(root)}, not an oracle configuration; a configuration is one JSON object (docs/inputs.md). Nothing in the file was checked.`);
    return { config: null, findings, notes };
  }

  const top = fields(root, TOP_KEYS, 'the configuration');
  const start = where(root);
  const protocol = text(top, 'protocol', start, 'The configuration', true, 'the configuration');
  const config = { protocol: protocol.value, assets: [], line: root.line, column: root.column };
  const notesEntry = top.get('notes');
  if (notesEntry && !notesEntry.value.secret && !isString(notesEntry.value)) add('field-invalid', where(notesEntry), `The notes of the configuration are ${describe(notesEntry.value)}; they must be text.`);

  const ae = top.get('assets');
  if (!ae) add('field-missing', start, 'The configuration has no assets; give the list of the assets the protocol prices (docs/inputs.md).');
  else if (ae.value.secret) {
    // Reported by src/secrets.js.
  } else if (!isArray(ae.value)) add('field-invalid', where(ae), `The assets of the configuration are ${describe(ae.value)}; they must be a list of objects.`);
  else if (ae.value.items.length === 0) add('field-missing', where(ae), 'The assets of the configuration are an empty list; give at least one asset.');
  else {
    const items = ae.value.items;
    if (items.length > limits.maxAssets) add('field-invalid', where(ae), `The configuration has ${items.length} assets, more than the limit of ${limits.maxAssets}; only the first ${limits.maxAssets} were read.`);
    const seen = new Map();
    items.slice(0, limits.maxAssets).forEach((node, index) => {
      if (!isObject(node)) {
        add('field-invalid', node, `Asset ${index + 1} of the assets is ${describe(node)}; an asset is an object with a name, a network, a role, a feed and scaleDecimals.`);
        return;
      }
      const asset = readAsset(node, index);
      if (asset.name !== null) {
        const key = `${asset.name.trim().toLowerCase()} ${asset.network ? asset.network.id : (asset.networkText ?? '').trim().toLowerCase()}`;
        const first = seen.get(key);
        if (first) add('asset-duplicate', where(asset.nameEntry), `Asset ${index + 1} is ${asset.title}, as is asset ${first.index + 1} at line ${first.nameEntry.line}; a finding cannot be traced to one of them.`, { entry: asset.title });
        else seen.set(key, asset);
      }
      config.assets.push(asset);
    });
  }
  return { config, findings, notes };
}
