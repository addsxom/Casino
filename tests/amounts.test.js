const test = require('node:test');
const assert = require('node:assert/strict');

const parseAmount = require('../utils/parseAmount.js');
const {
  formatAmount,
  formatAmountPrecise,
  formatFullAmount
} = require('../utils/formatAmount.js');

test('parseAmount parses plain and compact amounts', () => {
  assert.equal(parseAmount('500'), 500);
  assert.equal(parseAmount('1k'), 1000);
  assert.equal(parseAmount('1.5k'), 1500);
  assert.equal(parseAmount('1,5k'), 1500);
  assert.equal(parseAmount('1k5'), 1500);
  assert.equal(parseAmount(' 2 M '), 2_000_000);
  assert.equal(parseAmount('3b'), 3_000_000_000);
});

test('parseAmount rejects invalid values', () => {
  assert.equal(Number.isNaN(parseAmount()), true);
  assert.equal(Number.isNaN(parseAmount('all')), true);
  assert.equal(Number.isNaN(parseAmount('-100')), true);
  assert.equal(Number.isNaN(parseAmount('1x')), true);
});

test('formatAmount uses compact readable values', () => {
  assert.equal(formatAmount(0), '0');
  assert.equal(formatAmount(999), '999');
  assert.equal(formatAmount(1000), '1K');
  assert.equal(formatAmount(1500), '1.5K');
  assert.equal(formatAmount(1_000_000), '1M');
  assert.equal(formatAmount(1_000_000_000), '1B');
});

test('precise and full amount formatters stay available', () => {
  assert.equal(formatAmountPrecise(1234), '1.234K');
  assert.match(
    formatFullAmount(1234567),
    /^1\D234\D567$/
  );
});
