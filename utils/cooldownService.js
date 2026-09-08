function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

async function tryAcquireCooldown(
  Model,
  {
    userId,
    guildId,
    durationMs
  }
) {
  const now = Date.now();
  const availableAt = now + durationMs;

  const updated = await Model.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [
        { cooldown: { $lte: now } },
        { cooldown: { $exists: false } }
      ]
    },
    {
      $set: {
        cooldown: availableAt
      }
    },
    {
      new: true
    }
  );

  if (updated) {
    return {
      acquired: true,
      availableAt
    };
  }

  try {
    await Model.create({
      userId,
      guildId,
      cooldown: availableAt
    });

    return {
      acquired: true,
      availableAt
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await Model.findOne({
      userId,
      guildId
    });

    return {
      acquired: false,
      availableAt:
        Number(existing?.cooldown) || availableAt
    };
  }
}

async function releaseCooldown(
  Model,
  {
    userId,
    guildId,
    availableAt
  }
) {
  await Model.updateOne(
    {
      userId,
      guildId,
      cooldown: availableAt
    },
    {
      $set: {
        cooldown: 0
      }
    }
  );
}

module.exports = {
  tryAcquireCooldown,
  releaseCooldown
};
