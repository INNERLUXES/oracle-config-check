// A run: read the file, look for keys and seeds, read the configuration, run the checks and build the report object
// that the formats write.

import { DEFAULT_HEARTBEAT_MARGIN, analyzeConfig } from './analyze.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, InputError, displayPath, locateConfig, readConfigText } from './files.js';
import { JsonError, readJson } from './json.js';
import { readConfig } from './config.js';
import { RULES, decide, ruleById } from './rules.js';
import { findSecrets } from './secrets.js';
import { safeText } from './text.js';

export const LIMITS = { ...FILE_LIMITS };

export { InputError };

const clean = (t, max = 900) => safeText(t, max);

const ORDER = { error: 0, warning: 1, info: 2 };

// The basis of a rule: the points with their pages.
function basisOf(rule) {
  return rule.basis.map((id) => {
    const page = pointPage(id);
    return { text: POINTS[id].text, source: page.title, url: page.url };
  });
}

// The findings of a text, with no file system: { config, analysis, findings, notes }. config is null when the text is not
// a JSON object, and findings then holds one config-unreadable finding with its line.
export function checkText(text, options = {}) {
  let root;
  try {
    root = readJson(text);
  } catch (error) {
    if (!(error instanceof JsonError)) throw error;
    return { config: null, analysis: null, findings: [{ id: 'config-unreadable', line: error.line, column: error.column, message: `The file is not JSON the reader can follow: ${error.message}. Nothing in the file was checked.` }], notes: ['the configuration was not checked, because the file is not JSON the reader can follow'] };
  }
  const secrets = findSecrets(root);
  const read = readConfig(root);
  if (!read.config) return { config: null, analysis: null, findings: [...secrets, ...read.findings], notes: ['the configuration was not checked, because the file holds no configuration object'] };
  const analysis = analyzeConfig(read.config, options);
  return { config: read.config, analysis, findings: [...secrets, ...read.findings, ...analysis.findings], notes: [...read.notes, ...analysis.notes] };
}

const lineCount = (text) => {
  const parts = text === '' ? [] : text.split(/\r\n|\r|\n/);
  return parts.length > 0 && parts.at(-1) === '' ? parts.length - 1 : parts.length;
};

// The protocol and its assets as the report shows them.
function protocolOf(config) {
  if (!config) return null;
  const networks = [...new Set(config.assets.map((a) => (a.network ? a.network.id : a.networkText)).filter((n) => n !== null))];
  const collateral = config.assets.filter((a) => a.role === 'collateral' || a.role === 'both').length;
  return { name: config.protocol === null ? null : clean(config.protocol, 200), assets: config.assets.length, collateral, networks: networks.map((n) => clean(n.trim(), 80)) };
}

// The table of assets.
function tableOf(analysis) {
  if (!analysis) return null;
  return analysis.rows.map((r) => ({
    asset: clean(r.asset, 120),
    network: r.network === null ? null : clean(r.network.trim(), 80),
    role: r.role,
    feed: r.feed,
    fallback: r.fallback,
    heartbeat: r.heartbeat,
    maxStaleness: r.maxStaleness,
    decimals: r.decimals,
    scaleDecimals: r.scaleDecimals,
    bounds: r.bounds,
    sequencer: r.sequencer
  }));
}

// The report object for the findings of a file.
export function buildReport({ file, checked, version, minSeverity = 'info', failOn = 'error', heartbeatMargin = DEFAULT_HEARTBEAT_MARGIN }) {
  const all = checked.findings.map((f) => {
    const rule = ruleById(f.id);
    return {
      id: f.id,
      severity: rule.severity,
      message: clean(f.message),
      file: file.file,
      line: f.line,
      column: f.column,
      at: `${file.file}:${f.line}`,
      entry: f.entry == null ? null : clean(f.entry, 200),
      fix: rule.fix,
      kind: rule.kind,
      basis: basisOf(rule),
      own: rule.own ?? null
    };
  });
  all.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.line - b.line || a.column - b.column || a.id.localeCompare(b.id, 'en'));
  const shown = all.filter((f) => LEVELS.indexOf(f.severity) >= LEVELS.indexOf(minSeverity));
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.severity] += 1;
  const allByLevel = { error: 0, warning: 0, info: 0 };
  for (const f of all) allByLevel[f.severity] += 1;
  return {
    tool: 'oracle-config-check',
    version,
    input: { file: file.file, bytes: file.bytes, lines: file.lines },
    protocol: protocolOf(checked.config),
    totals: { findings: shown.length, byLevel, hidden: all.length - shown.length },
    rules: RULES.map((r) => ({ id: r.id, level: r.severity, kind: r.kind, findings: shown.filter((f) => f.id === r.id).length })),
    config: { minSeverity, failOn, heartbeatMargin },
    findings: shown,
    table: tableOf(checked.analysis),
    notes: checked.notes.map((n) => clean(n)),
    notice: NOTICE,
    result: decide(allByLevel, failOn)
  };
}

export async function checkFile({ path, minSeverity = 'info', failOn = 'error', heartbeatMargin = DEFAULT_HEARTBEAT_MARGIN, version, limits = LIMITS, base = process.cwd() }) {
  const absolute = await locateConfig(path, base);
  const { text, bytes } = await readConfigText(absolute, base, limits);
  const checked = checkText(text, { heartbeatMargin });
  const file = { file: displayPath(absolute, base), bytes, lines: lineCount(text) };
  return buildReport({ file, checked, version, minSeverity, failOn, heartbeatMargin });
}
