function formatAmount(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value);

  const units = [
    { value: 1_000_000_000_000, suffix: 'T' },
    { value: 1_000_000_000, suffix: 'B' },
    { value: 1_000_000, suffix: 'M' },
    { value: 1_000, suffix: 'K' }
  ];

  for (const unit of units) {
    if (abs >= unit.value) {
      const compact = value / unit.value;
      const decimals =
        Math.abs(compact) >= 100 ? 0 :
        Math.abs(compact) >= 10 ? 1 : 2;

      return `${Number(compact.toFixed(decimals))}${unit.suffix}`;
    }
  }

  return Math.floor(value).toLocaleString('fr-FR');
}

function formatAmountPrecise(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value);

  const units = [
    { value: 1_000_000_000_000, suffix: 'T' },
    { value: 1_000_000_000, suffix: 'B' },
    { value: 1_000_000, suffix: 'M' },
    { value: 1_000, suffix: 'K' }
  ];

  for (const unit of units) {
    if (abs >= unit.value) {
      const compact = value / unit.value;
      return `${Number(compact.toFixed(3))}${unit.suffix}`;
    }
  }

  return Math.floor(value).toLocaleString('fr-FR');
}

function formatFullAmount(amount) {
  return Math.floor(Number(amount) || 0).toLocaleString('fr-FR');
}

module.exports = {
  formatAmount,
  formatAmountPrecise,
  formatFullAmount
};
