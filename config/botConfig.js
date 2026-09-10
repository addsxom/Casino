module.exports = {
  guildId: '1546311652830351450',

  channels: {
    botVoice: {
      id: '1546360551503044658',
      name: '╰・BOT STATUT'
    },
    welcome: '1546311653388189718',
    memberCount: '1546311653388189716',
    rewards: '1547030803303637072',
    afkFarm: '1547368687579955290',
    voiceFarm: [],
    botGuildEvents: '1132784655817519225',

    games: {
      slots: '1546311653564620897',
      mines: '1546311653564620899'
    },

    staffLogs: {
      warn: {
        id: '1546311653933580418',
        name: 'warn'
      },
      economy: {
        id: '1546959903271157851',
        name: 'economy-logs'
      },
      bank: {
        id: '1546959947395371089',
        name: 'bank-logs'
      },
      transaction: {
        id: '1546959992207450193',
        name: 'transaction-logs'
      },
      message: {
        id: '1546960057168691291',
        name: 'message-logs'
      },
      server: {
        id: '1546960115914121276',
        name: 'server-logs'
      },
      voice: {
        id: '1546960169374720081',
        name: 'voice-logs'
      },
      moderation: {
        id: '1546960328502546484',
        name: 'moderation-logs'
      }
    }
  },

  rewards: {
    messages: {
      minimumCharacters: 3,
      milestones: [
        { threshold: 10, coins: 100 },
        { threshold: 25, coins: 250 },
        { threshold: 50, coins: 500 },
        { threshold: 100, coins: 1000 },
        { threshold: 250, coins: 2500 },
        { threshold: 500, coins: 5000 },
        { threshold: 1000, coins: 10000 },
        { threshold: 2500, coins: 20000 },
        { threshold: 5000, coins: 35000 },
        { threshold: 10000, coins: 60000 }
      ]
    },

    voice: {
      minimumHumans: 2,
      rewardMinMs: 15 * 60 * 1000,
      rewardMaxMs: 20 * 60 * 1000,
      rewardCoins: 1000,
      activityBonusPercent: 50,
      muteGraceRewards: 2
    },

    afk: {
      rewardMinMs: 30 * 60 * 1000,
      rewardMaxMs: 40 * 60 * 1000,
      rewardCoins: 250
    }
  },

  games: {
    slots: {
      winChance: 0.485,
      megaPotMinBet: 1000,
      sevenOnWinChance: 0.02,
      animationStepMs: 120,
      spinDurationMs: 6 * 1000,
      resultDisplayMs: 1800,
      sessionIdleMs: 2 * 60 * 1000
    },

    mines: {
      bonusChance: 0.10,
      revealCostPercent: 0.20,
      revealCooldownMs: 2 * 60 * 1000
    },

    crash: {
      houseEdge: 0.03,
      maxCrash: 100,
      liveUpdateMs: 900
    }
  },

  system: {
    memberCountResyncMs: 10 * 60 * 1000,
    memberCountRenameIntervalMs:
      5 * 60 * 1000 + 5000
  }
};
