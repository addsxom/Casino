const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K'
];

function createDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }

  return deck;
}

function shuffleDeck(
  deck,
  random = Math.random
) {
  const shuffled = [...deck];

  for (
    let index = shuffled.length - 1;
    index > 0;
    index--
  ) {
    const target = Math.floor(
      random() * (index + 1)
    );

    [
      shuffled[index],
      shuffled[target]
    ] = [
      shuffled[target],
      shuffled[index]
    ];
  }

  return shuffled;
}

function createShuffledDeck(
  random = Math.random
) {
  return shuffleDeck(
    createDeck(),
    random
  );
}

function drawCard(deck) {
  const card = deck.pop();

  if (!card) {
    throw new Error(
      'BLACKJACK_DECK_EMPTY'
    );
  }

  return card;
}

function getRankValue(rank) {
  if (rank === 'A') return 1;

  if (
    rank === 'J' ||
    rank === 'Q' ||
    rank === 'K'
  ) {
    return 10;
  }

  return Number(rank);
}

function getHandValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    total += getRankValue(card.rank);

    if (card.rank === 'A') {
      aces++;
    }
  }

  let soft = false;

  if (
    aces > 0 &&
    total + 10 <= 21
  ) {
    total += 10;
    soft = true;
  }

  return {
    total,
    soft,
    bust: total > 21
  };
}

function isNaturalBlackjack(hand) {
  return (
    hand.length === 2 &&
    getHandValue(hand).total === 21
  );
}

function shouldDealerHit(hand) {
  return getHandValue(hand).total < 17;
}

function resolveOutcome({
  player,
  dealer,
  bet
}) {
  const playerValue =
    getHandValue(player);
  const dealerValue =
    getHandValue(dealer);
  const playerNatural =
    isNaturalBlackjack(player);
  const dealerNatural =
    isNaturalBlackjack(dealer);

  let status;
  let payout = 0;

  if (playerValue.bust) {
    status = 'player_bust';
  } else if (
    playerNatural &&
    dealerNatural
  ) {
    status = 'push';
    payout = bet;
  } else if (playerNatural) {
    status = 'blackjack';
    payout = Math.floor(
      bet * 2.5
    );
  } else if (dealerNatural) {
    status = 'dealer_blackjack';
  } else if (dealerValue.bust) {
    status = 'dealer_bust';
    payout = bet * 2;
  } else if (
    playerValue.total >
    dealerValue.total
  ) {
    status = 'win';
    payout = bet * 2;
  } else if (
    playerValue.total <
    dealerValue.total
  ) {
    status = 'loss';
  } else {
    status = 'push';
    payout = bet;
  }

  return {
    status,
    payout,
    playerValue,
    dealerValue,
    playerNatural,
    dealerNatural
  };
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffleDeck,
  createShuffledDeck,
  drawCard,
  getHandValue,
  isNaturalBlackjack,
  shouldDealerHit,
  resolveOutcome
};
