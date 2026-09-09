const SlotMegaPot =
  require('../../Models/SlotMegaPot.js');

function normalizeAmount(value) {
  const amount = Math.floor(
    Number(value) || 0
  );

  return Math.max(0, amount);
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

async function getMegaPot(guildId) {
  try {
    const doc =
      await SlotMegaPot.findOneAndUpdate(
        { guildId },
        {
          $setOnInsert: {
            guildId,
            amount: 0
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

    return normalizeAmount(
      doc?.amount
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const doc =
      await SlotMegaPot.findOne({
        guildId
      });

    return normalizeAmount(
      doc?.amount
    );
  }
}

async function addToMegaPot(
  guildId,
  amount
) {
  amount = normalizeAmount(amount);

  if (amount <= 0) {
    return getMegaPot(guildId);
  }

  try {
    const doc =
      await SlotMegaPot.findOneAndUpdate(
        { guildId },
        {
          $inc: {
            amount
          },
          $setOnInsert: {
            guildId
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

    return normalizeAmount(
      doc?.amount
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const doc =
      await SlotMegaPot.findOneAndUpdate(
        { guildId },
        {
          $inc: {
            amount
          }
        },
        {
          new: true
        }
      );

    return normalizeAmount(
      doc?.amount
    );
  }
}

async function claimMegaPot(guildId) {
  const before =
    await SlotMegaPot.findOneAndUpdate(
      {
        guildId,
        amount: {
          $gte: 0
        }
      },
      {
        $set: {
          amount: 0
        }
      },
      {
        new: false
      }
    );

  return normalizeAmount(
    before?.amount
  );
}

module.exports = {
  getMegaPot,
  addToMegaPot,
  claimMegaPot
};
