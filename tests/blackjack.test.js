const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDeck,
  getHandValue,
  isNaturalBlackjack,
  shouldDealerHit,
  resolveOutcome
} = require('../utils/blackjack/gameRules.js');
const {
  renderBlackjackTable
} = require('../utils/blackjack/tableRenderer.js');

function card(rank, suit = '♠') {
  return { rank, suit };
}

test('blackjack deck contains 52 unique cards', () => {
  const deck = createDeck();
  const keys = new Set(
    deck.map(item =>
      `${item.rank}${item.suit}`
    )
  );

  assert.equal(deck.length, 52);
  assert.equal(keys.size, 52);
});

test('aces switch from 11 to 1 when needed', () => {
  assert.equal(
    getHandValue([
      card('A'),
      card('7', '♥')
    ]).total,
    18
  );

  assert.equal(
    getHandValue([
      card('A'),
      card('7', '♥'),
      card('9', '♦')
    ]).total,
    17
  );
});

test('dealer stands on soft 17', () => {
  assert.equal(
    shouldDealerHit([
      card('A'),
      card('6', '♥')
    ]),
    false
  );

  assert.equal(
    shouldDealerHit([
      card('10'),
      card('6', '♥')
    ]),
    true
  );
});

test('natural blackjack pays 3 to 2', () => {
  const player = [
    card('A'),
    card('K', '♥')
  ];
  const dealer = [
    card('10'),
    card('9', '♦')
  ];

  assert.equal(
    isNaturalBlackjack(player),
    true
  );

  const outcome = resolveOutcome({
    player,
    dealer,
    bet: 1000
  });

  assert.equal(outcome.status, 'blackjack');
  assert.equal(outcome.payout, 2500);
});

test('push returns the complete stake', () => {
  const outcome = resolveOutcome({
    player: [
      card('10'),
      card('8', '♥')
    ],
    dealer: [
      card('J'),
      card('8', '♦')
    ],
    bet: 2000
  });

  assert.equal(outcome.status, 'push');
  assert.equal(outcome.payout, 2000);
});

test('blackjack visual renderer creates a PNG table', () => {
  const image = renderBlackjackTable(
    {
      author: { username: 'Tester' },
      member: { displayName: 'Tester' }
    },
    {
      bet: 1000,
      doubled: false,
      dealer: [
        card('9', '♦'),
        card('K', '♣')
      ],
      player: [
        card('A'),
        card('7', '♥')
      ]
    },
    {
      revealDealer: false,
      statusText: 'À toi de jouer.'
    }
  );

  assert.ok(Buffer.isBuffer(image));
  assert.ok(image.length > 1000);
  assert.deepEqual(
    [...image.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]
  );
});
