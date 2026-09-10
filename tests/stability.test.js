const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT =
  path.resolve(
    __dirname,
    '..'
  );

function source(relativePath) {
  return fs.readFileSync(
    path.join(
      ROOT,
      relativePath
    ),
    'utf8'
  );
}

test(
  'critical channel routing stays configured',
  () => {
    const config =
      require('../config/botConfig.js');

    assert.equal(
      config.channels.games.crash,
      '1546311653564620900'
    );

    assert.equal(
      config.channels.staffLogs.ticket.id,
      '1547428665611255818'
    );

    assert.equal(
      config.system.progressPersistIntervalMs,
      15 * 1000
    );
  }
);

test(
  'casino games use persistent recovery sessions',
  () => {
    const recovery =
      require('../utils/gameRecoveryService.js');

    assert.equal(
      typeof recovery.reserveGameFunds,
      'function'
    );
    assert.equal(
      typeof recovery.settleGameSession,
      'function'
    );
    assert.equal(
      typeof recovery.refundInterruptedGameSessions,
      'function'
    );

    const slot =
      source(
        'Commands/Jeux/slot.js'
      );
    const crash =
      source(
        'Commands/Jeux/crash.js'
      );
    const mines =
      source(
        'utils/mines/gameSession.js'
      );

    assert.match(
      slot,
      /reserveGameFunds/
    );
    assert.match(
      slot,
      /updateGameRefundAmount/
    );
    assert.match(
      slot,
      /settleGameSession/
    );

    assert.match(
      crash,
      /reserveGameFunds/
    );
    assert.match(
      crash,
      /settleGameSession/
    );
    assert.match(
      crash,
      /getConfiguredChannelId\(\s*['"]crash['"]/
    );

    assert.match(
      mines,
      /reserveGameFunds/
    );
    assert.match(
      mines,
      /settleGameSession/
    );
  }
);

test(
  'voice mute limit survives leave and restart',
  () => {
    const tracker =
      source(
        'utils/voiceRewardTracker.js'
      );
    const model =
      source(
        'Models/VoiceRewardProgress.js'
      );

    assert.doesNotMatch(
      tracker,
      /VoiceRewardProgress\.deleteOne/
    );

    assert.match(
      tracker,
      /PROGRESS_PERSIST_INTERVAL_MS/
    );

    assert.match(
      model,
      /mutedRewards/
    );

    assert.match(
      model,
      /statusMessageId/
    );

    assert.doesNotMatch(
      model,
      /mutedMs/
    );
  }
);

test(
  'ticket transcripts are archived before closure',
  () => {
    const transcript =
      source(
        'utils/ticketTranscript.js'
      );

    assert.match(
      transcript,
      /archiveTicketTranscript/
    );

    assert.match(
      transcript,
      /ticketlogs/
    );

    assert.match(
      transcript,
      /TICKET_ARCHIVE_FAILED/
    );
  }
);

test(
  'category clear requires confirmation',
  () => {
    const clear =
      source(
        'Commands/Owner/clear.js'
      );

    assert.match(
      clear,
      /clearctg_confirm/
    );

    assert.match(
      clear,
      /confirmCategoryClear/
    );
  }
);
