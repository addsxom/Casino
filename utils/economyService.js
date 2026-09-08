const mongoose = require('mongoose');
const UserCoins = require('../Models/UserCoins.js');

class InsufficientFundsError extends Error {
  constructor(source = 'coins') {
    super('Insufficient funds');
    this.name = 'InsufficientFundsError';
    this.code = 'INSUFFICIENT_FUNDS';
    this.source = source;
  }
}

function validateAmount(amount, { allowZero = false } = {}) {
  const number = Number(amount);
  const validMinimum = allowZero ? number >= 0 : number > 0;

  if (
    !Number.isFinite(number) ||
    !Number.isSafeInteger(number) ||
    !validMinimum
  ) {
    throw new TypeError('Amount must be a safe positive integer.');
  }

  return number;
}

function validateSource(source) {
  if (source !== 'coins' && source !== 'bank') {
    throw new TypeError('Invalid balance source.');
  }

  return source;
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

async function ensureAccount(userId, guildId) {
  try {
    return await UserCoins.findOneAndUpdate(
      { userId, guildId },
      {
        $setOnInsert: {
          userId,
          guildId
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    return UserCoins.findOne({ userId, guildId });
  }
}

async function getAccount(userId, guildId, options = {}) {
  return UserCoins.findOne({ userId, guildId })
    .session(options.session || null);
}

async function debitBalance({
  userId,
  guildId,
  source = 'coins',
  amount,
  session = null
}) {
  source = validateSource(source);
  amount = validateAmount(amount);

  return UserCoins.findOneAndUpdate(
    {
      userId,
      guildId,
      [source]: { $gte: amount }
    },
    {
      $inc: {
        [source]: -amount
      }
    },
    {
      new: true,
      session
    }
  );
}

async function creditBalance({
  userId,
  guildId,
  target = 'coins',
  amount,
  session = null
}) {
  target = validateSource(target);
  amount = validateAmount(amount, { allowZero: true });

  if (amount === 0) {
    return session
      ? getAccount(userId, guildId, { session })
      : ensureAccount(userId, guildId);
  }

  const update = {
    $inc: {
      [target]: amount
    }
  };

  if (session) {
    return UserCoins.findOneAndUpdate(
      { userId, guildId },
      update,
      {
        new: true,
        session
      }
    );
  }

  try {
    return await UserCoins.findOneAndUpdate(
      { userId, guildId },
      {
        ...update,
        $setOnInsert: {
          userId,
          guildId
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    return UserCoins.findOneAndUpdate(
      { userId, guildId },
      update,
      { new: true }
    );
  }
}

async function moveBalance({
  userId,
  guildId,
  from,
  to,
  amount
}) {
  from = validateSource(from);
  to = validateSource(to);
  amount = validateAmount(amount);

  if (from === to) {
    throw new TypeError('Source and destination must be different.');
  }

  return UserCoins.findOneAndUpdate(
    {
      userId,
      guildId,
      [from]: { $gte: amount }
    },
    {
      $inc: {
        [from]: -amount,
        [to]: amount
      }
    },
    {
      new: true
    }
  );
}

async function moveAllBalance({
  userId,
  guildId,
  from,
  to
}) {
  from = validateSource(from);
  to = validateSource(to);

  if (from === to) {
    throw new TypeError('Source and destination must be different.');
  }

  const before = await UserCoins.findOneAndUpdate(
    {
      userId,
      guildId,
      [from]: { $gt: 0 }
    },
    [
      {
        $set: {
          [to]: {
            $add: [
              { $ifNull: [`$${to}`, 0] },
              `$${from}`
            ]
          },
          [from]: 0
        }
      }
    ],
    {
      new: false
    }
  );

  if (!before) return null;

  const amount = Number(before[from]) || 0;

  return {
    amount,
    before,
    after: {
      coins:
        from === 'coins'
          ? 0
          : (Number(before.coins) || 0) + amount,
      bank:
        from === 'bank'
          ? 0
          : (Number(before.bank) || 0) + amount
    }
  };
}

async function drainPocket(userId, guildId) {
  const before = await UserCoins.findOneAndUpdate(
    {
      userId,
      guildId,
      coins: { $gt: 0 }
    },
    {
      $set: {
        coins: 0
      }
    },
    {
      new: false
    }
  );

  if (!before) return null;

  return {
    amount: Number(before.coins) || 0,
    before,
    after: {
      coins: 0,
      bank: Number(before.bank) || 0
    }
  };
}

async function transferCoins({
  guildId,
  senderId,
  recipientId,
  source = 'coins',
  amount
}) {
  source = validateSource(source);
  amount = validateAmount(amount);

  if (!senderId || !recipientId || senderId === recipientId) {
    throw new TypeError('Invalid transfer participants.');
  }

  await ensureAccount(recipientId, guildId);

  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const senderAfter = await debitBalance({
        userId: senderId,
        guildId,
        source,
        amount,
        session
      });

      if (!senderAfter) {
        throw new InsufficientFundsError(source);
      }

      const recipientAfter = await creditBalance({
        userId: recipientId,
        guildId,
        target: 'coins',
        amount,
        session
      });

      if (!recipientAfter) {
        throw new Error('Unable to credit recipient.');
      }

      result = {
        senderBefore: senderAfter[source] + amount,
        senderAfter: senderAfter[source],
        recipientBefore: recipientAfter.coins - amount,
        recipientAfter: recipientAfter.coins,
        senderDocument: senderAfter,
        recipientDocument: recipientAfter
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

function validateAccountField(field) {
  if (!['coins', 'bank', 'rep', 'messages'].includes(field)) {
    throw new TypeError('Invalid account field.');
  }

  return field;
}

async function incrementAccountField({
  userId,
  guildId,
  field,
  amount,
  session = null
}) {
  field = validateAccountField(field);
  amount = validateAmount(amount);

  const update = {
    $inc: { [field]: amount }
  };

  if (session) {
    return UserCoins.findOneAndUpdate(
      { userId, guildId },
      update,
      {
        new: true,
        session
      }
    );
  }

  try {
    return await UserCoins.findOneAndUpdate(
      { userId, guildId },
      {
        ...update,
        $setOnInsert: {
          userId,
          guildId
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    return UserCoins.findOneAndUpdate(
      { userId, guildId },
      update,
      { new: true }
    );
  }
}

async function removeUpTo({
  userId,
  guildId,
  field,
  amount
}) {
  field = validateAccountField(field);
  amount = validateAmount(amount);

  const before = await UserCoins.findOneAndUpdate(
    { userId, guildId },
    [
      {
        $set: {
          [field]: {
            $max: [
              0,
              {
                $subtract: [
                  { $ifNull: [`$${field}`, 0] },
                  amount
                ]
              }
            ]
          }
        }
      }
    ],
    { new: false }
  );

  if (!before) return null;

  const previousValue = Number(before[field]) || 0;
  const removed = Math.min(amount, previousValue);

  return {
    removed,
    before,
    after: {
      coins:
        field === 'coins'
          ? previousValue - removed
          : Number(before.coins) || 0,
      bank:
        field === 'bank'
          ? previousValue - removed
          : Number(before.bank) || 0,
      rep:
        field === 'rep'
          ? previousValue - removed
          : Number(before.rep) || 0,
      messages:
        field === 'messages'
          ? previousValue - removed
          : Number(before.messages) || 0
    }
  };
}

async function resetAccount(userId, guildId) {
  const before = await UserCoins.findOneAndUpdate(
    { userId, guildId },
    {
      $set: {
        coins: 0,
        bank: 0,
        rep: 0
      }
    },
    { new: false }
  );

  if (!before) return null;

  return {
    before,
    removedCoins:
      (Number(before.coins) || 0) +
      (Number(before.bank) || 0)
  };
}

module.exports = {
  InsufficientFundsError,
  getAccount,
  ensureAccount,
  debitBalance,
  creditBalance,
  moveBalance,
  moveAllBalance,
  drainPocket,
  transferCoins,
  incrementAccountField,
  removeUpTo,
  resetAccount
};
