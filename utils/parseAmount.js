function parseAmount(input) {
  if (input === undefined || input === null) return NaN;

  const value = String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const multipliers = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000
  };

  let match = value.match(/^(\d+)(?:[.,](\d+))?([kmb])$/);

  if (match) {
    const whole = match[1];
    const decimals = match[2] || '';
    const suffix = match[3];
    const number = Number(decimals ? whole + '.' + decimals : whole);

    return Math.floor(number * multipliers[suffix]);
  }

  match = value.match(/^(\d+)([kmb])(\d+)$/);

  if (match) {
    const whole = match[1];
    const suffix = match[2];
    const decimals = match[3];
    const number = Number(whole + '.' + decimals);

    return Math.floor(number * multipliers[suffix]);
  }

  return NaN;
}

module.exports = parseAmount;
