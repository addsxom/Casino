const zlib = require('zlib');
const { formatAmount } = require('../formatAmount.js');
const { getHandValue } = require('./gameRules.js');

const WIDTH = 1000;
const HEIGHT = 620;

const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  0:['01110','10001','10011','10101','11001','10001','01110'],1:['00100','01100','00100','00100','00100','00100','01110'],2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],'-':['00000','00000','00000','11111','00000','00000','00000'],':':['00000','00100','00100','00000','00100','00100','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],'/':['00001','00010','00100','01000','10000','00000','00000'],' ':['00000','00000','00000','00000','00000','00000','00000']
};

const SUIT_GLYPHS = {
  '♥':['0110110','1111111','1111111','0111110','0011100','0001000','0000000'],
  '♦':['0001000','0011100','0111110','1111111','0111110','0011100','0001000'],
  '♣':['0011100','0111110','0011100','1111111','1111111','0011100','0011100'],
  '♠':['0001000','0011100','0111110','1111111','1011101','0011100','0011100']
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9+\-:./ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function numberToColor(color) {
  const value = Number.isInteger(color)
    ? color
    : 0x6b6de6;

  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
    255
  ];
}

function setPixel(data, x, y, r, g, b, a = 255) {
  x = Math.round(x);
  y = Math.round(y);

  if (
    x < 0 || x >= WIDTH ||
    y < 0 || y >= HEIGHT
  ) {
    return;
  }

  const index = (y * WIDTH + x) * 4;

  if (a >= 255) {
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = 255;
    return;
  }

  const inverse = 255 - a;

  data[index] = Math.round(
    (r * a + data[index] * inverse) / 255
  );
  data[index + 1] = Math.round(
    (g * a + data[index + 1] * inverse) / 255
  );
  data[index + 2] = Math.round(
    (b * a + data[index + 2] * inverse) / 255
  );
  data[index + 3] = 255;
}

function fillRect(data, x, y, width, height, color) {
  const [r, g, b, a = 255] = color;

  for (let yy = y; yy < y + height; yy++) {
    for (let xx = x; xx < x + width; xx++) {
      setPixel(data, xx, yy, r, g, b, a);
    }
  }
}

function fillCircle(data, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) {
        setPixel(
          data,
          cx + x,
          cy + y,
          ...color
        );
      }
    }
  }
}

function fillRoundedRect(
  data,
  x,
  y,
  width,
  height,
  radius,
  color
) {
  const r = Math.max(
    0,
    Math.min(
      Math.round(radius),
      Math.floor(width / 2),
      Math.floor(height / 2)
    )
  );

  if (!r) {
    fillRect(data, x, y, width, height, color);
    return;
  }

  fillRect(
    data,
    x + r,
    y,
    width - r * 2,
    height,
    color
  );
  fillRect(
    data,
    x,
    y + r,
    width,
    height - r * 2,
    color
  );

  fillCircle(data, x + r, y + r, r, color);
  fillCircle(data, x + width - r - 1, y + r, r, color);
  fillCircle(data, x + r, y + height - r - 1, r, color);
  fillCircle(
    data,
    x + width - r - 1,
    y + height - r - 1,
    r,
    color
  );
}

function drawPanel(
  data,
  x,
  y,
  width,
  height,
  {
    fill = [13, 11, 17, 235],
    border = [207, 165, 86, 255],
    borderSize = 2,
    radius = 12
  } = {}
) {
  fillRoundedRect(
    data,
    x,
    y,
    width,
    height,
    radius,
    border
  );
  fillRoundedRect(
    data,
    x + borderSize,
    y + borderSize,
    width - borderSize * 2,
    height - borderSize * 2,
    Math.max(0, radius - borderSize),
    fill
  );
}

function verticalGradient(
  data,
  x,
  y,
  width,
  height,
  top,
  bottom
) {
  for (let yy = 0; yy < height; yy++) {
    const ratio = yy / Math.max(1, height - 1);
    const color = [
      Math.round(top[0] * (1 - ratio) + bottom[0] * ratio),
      Math.round(top[1] * (1 - ratio) + bottom[1] * ratio),
      Math.round(top[2] * (1 - ratio) + bottom[2] * ratio),
      255
    ];

    fillRect(data, x, y + yy, width, 1, color);
  }
}

function drawGlyph(data, character, x, y, scale, color) {
  const glyph = FONT[character] || FONT[' '];

  for (let gy = 0; gy < 7; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      if (glyph[gy][gx] === '1') {
        fillRect(
          data,
          x + gx * scale,
          y + gy * scale,
          scale,
          scale,
          color
        );
      }
    }
  }
}

function measureText(text, scale) {
  return Math.max(
    0,
    normalizeText(text).length * (6 * scale) - scale
  );
}

function drawText(data, text, x, y, scale, color) {
  const normalized = normalizeText(text);

  for (const character of normalized) {
    drawGlyph(
      data,
      character,
      x,
      y,
      scale,
      color
    );

    x += 6 * scale;
  }
}

function drawCenteredText(
  data,
  text,
  centerX,
  y,
  scale,
  color,
  maxWidth = Infinity
) {
  const normalized = normalizeText(text);
  let resolvedScale = scale;

  while (
    resolvedScale > 1 &&
    measureText(normalized, resolvedScale) > maxWidth
  ) {
    resolvedScale--;
  }

  drawText(
    data,
    normalized,
    Math.round(
      centerX -
      measureText(normalized, resolvedScale) / 2
    ),
    y,
    resolvedScale,
    color
  );
}

function drawSuit(
  data,
  suit,
  centerX,
  centerY,
  size,
  color
) {
  const glyph =
    SUIT_GLYPHS[suit] ||
    SUIT_GLYPHS['♠'];
  const scale = Math.max(
    1,
    Math.floor(size / 7)
  );
  const x0 = Math.round(
    centerX - (7 * scale) / 2
  );
  const y0 = Math.round(
    centerY - (7 * scale) / 2
  );

  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if (glyph[y][x] === '1') {
        fillRect(
          data,
          x0 + x * scale,
          y0 + y * scale,
          scale,
          scale,
          color
        );
      }
    }
  }
}

function drawChip(data, cx, cy, radius, accent) {
  fillCircle(
    data,
    cx + 3,
    cy + 4,
    radius,
    [0, 0, 0, 90]
  );
  fillCircle(
    data,
    cx,
    cy,
    radius,
    accent
  );
  fillCircle(
    data,
    cx,
    cy,
    Math.max(2, radius - 5),
    [33, 18, 44, 255]
  );
  fillCircle(
    data,
    cx,
    cy,
    Math.max(1, radius - 9),
    [207, 165, 86, 255]
  );
  fillCircle(
    data,
    cx,
    cy,
    Math.max(1, radius - 12),
    [48, 25, 61, 255]
  );
}

function drawCard(
  data,
  card,
  x,
  y,
  width = 76,
  height = 108,
  hidden = false
) {
  fillRoundedRect(
    data,
    x + 5,
    y + 7,
    width,
    height,
    10,
    [0, 0, 0, 80]
  );

  if (hidden) {
    fillRoundedRect(
      data,
      x,
      y,
      width,
      height,
      10,
      [207, 165, 86, 255]
    );
    fillRoundedRect(
      data,
      x + 2,
      y + 2,
      width - 4,
      height - 4,
      9,
      [35, 17, 51, 255]
    );
    fillRoundedRect(
      data,
      x + 9,
      y + 9,
      width - 18,
      height - 18,
      6,
      [70, 34, 96, 255]
    );

    for (let yy = y + 16; yy < y + height - 14; yy += 12) {
      for (let xx = x + 16; xx < x + width - 12; xx += 12) {
        fillCircle(
          data,
          xx,
          yy,
          2,
          [214, 170, 93, 255]
        );
      }
    }

    drawCenteredText(
      data,
      'F',
      x + width / 2,
      y + 42,
      3,
      [247, 222, 160, 255],
      width - 18
    );

    return;
  }

  fillRoundedRect(
    data,
    x,
    y,
    width,
    height,
    10,
    [224, 211, 183, 255]
  );
  fillRoundedRect(
    data,
    x + 2,
    y + 2,
    width - 4,
    height - 4,
    9,
    [249, 246, 238, 255]
  );

  const red =
    card?.suit === '♥' ||
    card?.suit === '♦';
  const cardColor = red
    ? [188, 43, 56, 255]
    : [22, 21, 25, 255];

  drawText(
    data,
    card?.rank || '?',
    x + 8,
    y + 8,
    2,
    cardColor
  );

  drawSuit(
    data,
    card?.suit || '♠',
    x + width / 2,
    y + height / 2 + 6,
    30,
    cardColor
  );

  drawCenteredText(
    data,
    card?.rank || '?',
    x + width - 17,
    y + height - 25,
    1,
    cardColor,
    26
  );
}

function layoutCards(
  data,
  hand,
  {
    y,
    centerX,
    maxWidth,
    hideHoleCard = false
  }
) {
  if (!hand?.length) return;

  const width = 76;
  const count = hand.length;
  const spacing = count <= 4
    ? 88
    : Math.max(
        40,
        Math.floor(
          (maxWidth - width) /
          Math.max(1, count - 1)
        )
      );
  const totalWidth =
    width +
    (count - 1) * spacing;
  const startX = Math.round(
    centerX - totalWidth / 2
  );

  hand.forEach((card, index) => {
    drawCard(
      data,
      card,
      startX + index * spacing,
      y,
      width,
      108,
      hideHoleCard && index === 1
    );
  });
}

function splitLines(text, maxLength = 50) {
  const words =
    normalizeText(text)
      .split(' ')
      .filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line
      ? `${line} ${word}`
      : word;

    if (
      next.length > maxLength &&
      line
    ) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  return lines.slice(0, 2);
}

function drawHeader(data, accent) {
  const gold = [222, 178, 91, 255];
  const light = [247, 235, 208, 255];

  drawPanel(
    data,
    36,
    22,
    928,
    70,
    {
      fill: [12, 9, 17, 248],
      border: gold,
      borderSize: 2,
      radius: 16
    }
  );

  drawSuit(
    data,
    '♠',
    82,
    57,
    27,
    gold
  );
  drawSuit(
    data,
    '♥',
    918,
    57,
    27,
    accent
  );

  drawCenteredText(
    data,
    'BLACKJACK',
    500,
    36,
    4,
    light,
    380
  );
  drawCenteredText(
    data,
    'FORTUNA LOUNGE',
    500,
    69,
    1,
    gold,
    260
  );
}

function drawTable(data) {
  const gold = [179, 128, 54, 255];

  fillRoundedRect(
    data,
    40,
    106,
    920,
    420,
    28,
    [80, 49, 22, 255]
  );
  fillRoundedRect(
    data,
    46,
    112,
    908,
    408,
    24,
    gold
  );

  verticalGradient(
    data,
    50,
    116,
    900,
    400,
    [13, 92, 68],
    [5, 55, 42]
  );

  fillRoundedRect(
    data,
    54,
    120,
    892,
    392,
    20,
    [7, 72, 53, 215]
  );

  fillRoundedRect(
    data,
    70,
    136,
    860,
    360,
    16,
    [9, 84, 61, 155]
  );

  fillRect(
    data,
    102,
    304,
    796,
    1,
    [224, 190, 111, 135]
  );

  drawCenteredText(
    data,
    'FORTUNA',
    500,
    284,
    3,
    [223, 194, 122, 50],
    280
  );
}

function drawSidePanel(
  data,
  {
    x,
    y,
    width,
    height,
    title,
    lines,
    accent,
    chip = false
  }
) {
  const gold = [222, 178, 91, 255];
  const light = [244, 235, 216, 255];

  drawPanel(
    data,
    x,
    y,
    width,
    height,
    {
      fill: [9, 9, 13, 224],
      border: [183, 136, 64, 255],
      borderSize: 2,
      radius: 12
    }
  );

  drawCenteredText(
    data,
    title,
    x + width / 2,
    y + 12,
    2,
    gold,
    width - 20
  );

  if (chip) {
    drawChip(
      data,
      x + 38,
      y + height - 34,
      16,
      accent
    );
  }

  lines.slice(0, 3).forEach((line, index) => {
    drawCenteredText(
      data,
      line,
      x + width / 2 + (chip ? 16 : 0),
      y + 42 + index * 23,
      index === 0 ? 2 : 1,
      index === 0 ? light : [211, 201, 183, 255],
      width - (chip ? 62 : 20)
    );
  });
}

function drawStatusPanel(
  data,
  {
    status,
    subtext,
    accent
  }
) {
  const light = [247, 238, 219, 255];

  drawPanel(
    data,
    120,
    542,
    760,
    58,
    {
      fill: [11, 9, 15, 246],
      border: accent,
      borderSize: 2,
      radius: 14
    }
  );

  const mainLines = splitLines(status, 62);

  if (mainLines.length === 1) {
    drawCenteredText(
      data,
      mainLines[0],
      500,
      subtext ? 552 : 561,
      subtext ? 2 : 3,
      light,
      700
    );
  } else {
    drawCenteredText(
      data,
      mainLines[0],
      500,
      551,
      1,
      light,
      700
    );
    drawCenteredText(
      data,
      mainLines[1],
      500,
      565,
      1,
      light,
      700
    );
  }

  if (subtext) {
    drawCenteredText(
      data,
      subtext,
      500,
      580,
      1,
      accent,
      690
    );
  }
}

function drawPlayerLabel(
  data,
  text,
  x,
  y,
  width,
  accent
) {
  drawPanel(
    data,
    x,
    y,
    width,
    32,
    {
      fill: [10, 9, 14, 220],
      border: accent,
      borderSize: 1,
      radius: 8
    }
  );

  drawCenteredText(
    data,
    text,
    x + width / 2,
    y + 10,
    1,
    [245, 234, 211, 255],
    width - 18
  );
}

function drawScene(
  data,
  message,
  state,
  {
    revealDealer,
    statusText,
    visualStatus,
    visualSubtext,
    color
  }
) {
  const accent = numberToColor(color);
  const gold = [222, 178, 91, 255];
  const light = [247, 238, 219, 255];

  verticalGradient(
    data,
    0,
    0,
    WIDTH,
    HEIGHT,
    [10, 7, 15],
    [24, 11, 31]
  );

  fillCircle(
    data,
    105,
    90,
    72,
    [93, 42, 129, 35]
  );
  fillCircle(
    data,
    905,
    90,
    80,
    [123, 62, 153, 28]
  );

  drawHeader(data, accent);
  drawTable(data);

  const dealerVisible = revealDealer
    ? state.dealer
    : state.dealer.filter((_, index) => index !== 1);
  const dealerTotal = dealerVisible.length
    ? getHandValue(dealerVisible).total
    : '-';
  const playerTotal = state.player.length
    ? getHandValue(state.player).total
    : '-';
  const playerName = normalizeText(
    message.member?.displayName ||
    message.author.username ||
    'JOUEUR'
  ).slice(0, 18);

  drawSidePanel(
    data,
    {
      x: 76,
      y: 150,
      width: 210,
      height: 108,
      title: 'MISE',
      lines: [
        `${formatAmount(state.bet)} COINS`,
        state.doubled
          ? 'MISE DOUBLEE'
          : 'BLACKJACK 3:2'
      ],
      accent,
      chip: true
    }
  );

  drawSidePanel(
    data,
    {
      x: 714,
      y: 150,
      width: 210,
      height: 108,
      title: 'REGLES',
      lines: [
        'CROUPIER RESTE A 17',
        'DOUBLER = 1 CARTE',
        'BLACKJACK PAIE 3:2'
      ],
      accent,
      chip: false
    }
  );

  drawPlayerLabel(
    data,
    'CROUPIER',
    400,
    126,
    200,
    gold
  );

  layoutCards(
    data,
    state.dealer,
    {
      y: 166,
      centerX: 500,
      maxWidth: 390,
      hideHoleCard: !revealDealer
    }
  );

  drawCenteredText(
    data,
    `TOTAL ${dealerTotal}`,
    500,
    278,
    2,
    light,
    240
  );

  drawPlayerLabel(
    data,
    playerName || 'JOUEUR',
    390,
    316,
    220,
    accent
  );

  layoutCards(
    data,
    state.player,
    {
      y: 354,
      centerX: 500,
      maxWidth: 520
    }
  );

  drawCenteredText(
    data,
    `TOTAL ${playerTotal}`,
    500,
    470,
    2,
    light,
    240
  );

  const status =
    visualStatus ||
    statusText ||
    'A TOI DE JOUER';

  drawStatusPanel(
    data,
    {
      status,
      subtext: visualSubtext,
      accent
    }
  );
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^
        (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(
    crc32(
      Buffer.concat([
        typeBuffer,
        data
      ])
    ),
    0
  );

  return Buffer.concat([
    lengthBuffer,
    typeBuffer,
    data,
    crcBuffer
  ]);
}

function encodePng(rgba) {
  const signature = Buffer.from([
    137, 80, 78, 71,
    13, 10, 26, 10
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = WIDTH * 4;
  const raw = Buffer.alloc(
    (rowSize + 1) * HEIGHT
  );

  for (let y = 0; y < HEIGHT; y++) {
    const target = y * (rowSize + 1);
    raw[target] = 0;

    rgba.copy(
      raw,
      target + 1,
      y * rowSize,
      (y + 1) * rowSize
    );
  }

  const compressed = zlib.deflateSync(
    raw,
    {
      level: 7
    }
  );

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function renderBlackjackTable(
  message,
  state,
  {
    revealDealer = false,
    statusText = 'À toi de jouer.',
    visualStatus = null,
    visualSubtext = null,
    color = 0x6b6de6
  } = {}
) {
  const pixels = Buffer.alloc(
    WIDTH * HEIGHT * 4
  );

  drawScene(
    pixels,
    message,
    state,
    {
      revealDealer,
      statusText,
      visualStatus,
      visualSubtext,
      color
    }
  );

  return encodePng(pixels);
}

module.exports = {
  renderBlackjackTable
};
