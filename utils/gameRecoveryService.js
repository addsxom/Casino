const mongoose = require('mongoose');
const ActiveGameSession =
  require('../Models/ActiveGameSession.js');

const {
  debitBalance,
  drainPocket,
  creditBalance,
  getAccount
} = require('./economyService.js');

function normalizeAmount(
  value,
  { allowZero = true } = {}
) {
  const amount =
    Math.floor(Number(value));

  const valid =
    Number.isSafeInteger(amount) &&
    (
      allowZero
        ? amount >= 0
        : amount > 0
    );

  if (!valid) {
    throw new TypeError(
      'Invalid game recovery amount.'
    );
  }

  return amount;
}

async function reserveGameFunds({
  userId,
  guildId,
  game,
  amount = null,
  allIn = false
}) {
  const mongoSession =
    await mongoose.startSession();

  let result = null;

  try {
    await mongoSession.withTransaction(
      async () => {
        let reservedAmount;
        let account;

        if (allIn) {
          const drained =
            await drainPocket(
              userId,
              guildId,
              {
                session:
                  mongoSession
              }
            );

          if (
            !drained ||
            drained.amount <= 0
          ) {
            return;
          }

          reservedAmount =
            normalizeAmount(
              drained.amount,
              { allowZero: false }
            );

          account =
            await getAccount(
              userId,
              guildId,
              {
                session:
                  mongoSession
              }
            );
        } else {
          reservedAmount =
            normalizeAmount(
              amount,
              { allowZero: false }
            );

          account =
            await debitBalance({
              userId,
              guildId,
              source: 'coins',
              amount:
                reservedAmount,
              session:
                mongoSession
            });

          if (!account) {
            return;
          }
        }

        if (!account) {
          throw new Error(
            'GAME_ACCOUNT_UNAVAILABLE'
          );
        }

        await ActiveGameSession.create(
          [{
            userId,
            guildId,
            game,
            refundableAmount:
              reservedAmount,
            originalAmount:
              reservedAmount
          }],
          {
            session:
              mongoSession
          }
        );

        result = {
          amount:
            reservedAmount,
          account
        };
      }
    );

    return result;
  } catch (error) {
    if (error?.code === 11000) {
      error.code =
        'ACTIVE_GAME_SESSION_EXISTS';
    }

    throw error;
  } finally {
    await mongoSession.endSession();
  }
}

async function updateGameRefundAmount({
  userId,
  guildId,
  amount
}) {
  amount = normalizeAmount(amount);

  const updated =
    await ActiveGameSession
      .findOneAndUpdate(
        {
          userId,
          guildId
        },
        {
          $set: {
            refundableAmount:
              amount
          }
        },
        {
          new: true
        }
      );

  return updated || null;
}

async function settleGameSession({
  userId,
  guildId,
  payout = 0
}) {
  payout = normalizeAmount(payout);

  const mongoSession =
    await mongoose.startSession();

  let result = null;

  try {
    await mongoSession.withTransaction(
      async () => {
        const recovery =
          await ActiveGameSession
            .findOne({
              userId,
              guildId
            })
            .session(mongoSession);

        if (!recovery) {
          return;
        }

        let account;

        if (payout > 0) {
          account =
            await creditBalance({
              userId,
              guildId,
              target: 'coins',
              amount: payout,
              session:
                mongoSession
            });
        } else {
          account =
            await getAccount(
              userId,
              guildId,
              {
                session:
                  mongoSession
              }
            );
        }

        if (!account) {
          throw new Error(
            'GAME_ACCOUNT_UNAVAILABLE'
          );
        }

        await ActiveGameSession
          .deleteOne(
            {
              _id:
                recovery._id
            },
            {
              session:
                mongoSession
            }
          );

        result = {
          account,
          game:
            recovery.game,
          originalAmount:
            Number(
              recovery.originalAmount
            ) || 0,
          refundableAmount:
            Number(
              recovery.refundableAmount
            ) || 0,
          payout
        };
      }
    );

    return result;
  } finally {
    await mongoSession.endSession();
  }
}

async function refundGameSession({
  userId = null,
  guildId = null,
  sessionId = null
}) {
  const mongoSession =
    await mongoose.startSession();

  let result = null;

  try {
    await mongoSession.withTransaction(
      async () => {
        const filter =
          sessionId
            ? { _id: sessionId }
            : {
                userId,
                guildId
              };

        const recovery =
          await ActiveGameSession
            .findOne(filter)
            .session(mongoSession);

        if (!recovery) {
          return;
        }

        const refundedAmount =
          normalizeAmount(
            recovery.refundableAmount
          );

        let account;

        if (refundedAmount > 0) {
          account =
            await creditBalance({
              userId:
                recovery.userId,
              guildId:
                recovery.guildId,
              target: 'coins',
              amount:
                refundedAmount,
              session:
                mongoSession
            });
        } else {
          account =
            await getAccount(
              recovery.userId,
              recovery.guildId,
              {
                session:
                  mongoSession
              }
            );
        }

        if (!account) {
          throw new Error(
            'GAME_ACCOUNT_UNAVAILABLE'
          );
        }

        await ActiveGameSession
          .deleteOne(
            {
              _id:
                recovery._id
            },
            {
              session:
                mongoSession
            }
          );

        result = {
          userId:
            recovery.userId,
          guildId:
            recovery.guildId,
          game:
            recovery.game,
          refundedAmount,
          account
        };
      }
    );

    return result;
  } finally {
    await mongoSession.endSession();
  }
}

async function refundInterruptedGameSessions() {
  const interrupted =
    await ActiveGameSession
      .find({})
      .select(
        '_id userId guildId game'
      )
      .lean();

  const refunded = [];

  for (const recovery of interrupted) {
    try {
      const result =
        await refundGameSession({
          sessionId:
            recovery._id
        });

      if (result) {
        refunded.push(result);
      }
    } catch (error) {
      console.error(
        'Erreur remboursement partie interrompue :',
        recovery._id,
        error?.message ||
          error
      );
    }
  }

  return refunded;
}

module.exports = {
  reserveGameFunds,
  updateGameRefundAmount,
  settleGameSession,
  refundGameSession,
  refundInterruptedGameSessions
};
