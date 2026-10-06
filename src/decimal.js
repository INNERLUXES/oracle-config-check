// Prices, percents and bounds as the configuration writes them: decimal numbers read from the characters of the file
// into a whole number and a scale, compared with BigInt and never through a floating point number, so that a bound of
// 0.999 and a price of 1 compare as written. A number with an exponent, a sign or more digits than the limit is not
// read.

export const DECIMAL_LIMITS = { maxDigits: 40 };

const PLAIN = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

// The value of a plain decimal text: { int, scale } with value = int / 10^scale, or null when the text is not a plain
// decimal of at most maxDigits digits before and after the point.
export function parseDecimal(raw, limits = DECIMAL_LIMITS) {
  const m = PLAIN.exec(raw);
  if (!m) return null;
  const whole = m[1];
  const frac = m[2] ?? '';
  if (whole.length > limits.maxDigits || frac.length > limits.maxDigits) return null;
  return { int: BigInt(`${whole}${frac}`), scale: frac.length };
}

// -1, 0 or 1 as a is below, equal to or above b.
export function compareDecimal(a, b) {
  const left = a.int * 10n ** BigInt(b.scale);
  const right = b.int * 10n ** BigInt(a.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}

export const isZero = (d) => d.int === 0n;

// A decimal in its shortest form: no trailing zeros after the point, and no point when nothing follows it.
export function formatDecimal(d) {
  const s = d.int.toString().padStart(d.scale + 1, '0');
  if (d.scale === 0) return s;
  const whole = s.slice(0, s.length - d.scale);
  const frac = s.slice(s.length - d.scale).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}
