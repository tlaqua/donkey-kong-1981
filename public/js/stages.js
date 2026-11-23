// Logical Arcade Playfield Dimensions (3:4 Aspect Ratio)
export const PLAYFIELD_W = 480;
export const PLAYFIELD_H = 640;

export function getGirderYAt(girder, x) {
  const span = girder.x2 - girder.x1;
  if (span <= 0) return girder.y1;
  const t = Math.max(0, Math.min(1, (x - girder.x1) / span));
  return girder.y1 + t * (girder.y2 - girder.y1);
}

export function getStageConfig(stageIndex) {
  switch (stageIndex) {
    case 0:
      return build25mGirders();
    case 1:
      return build50mPieFactory();
    case 2:
      return build75mElevators();
    case 3:
    default:
      return build100mRivets();
  }
}

// ---------------------------------------------------------------------------
// STAGE 1: 25m GIRDERS
// ---------------------------------------------------------------------------
function build25mGirders() {
  const girders = [
    // Tier 0 (Bottom): left flat, right sloped up
    { id: 'g0a', x1: 20, y1: 604, x2: 240, y2: 604, type: 'steel' },
    { id: 'g0b', x1: 240, y1: 604, x2: 460, y2: 592, type: 'steel' },
    // Tier 1: slopes down to the right
    { id: 'g1', x1: 20, y1: 510, x2: 428, y2: 530, type: 'steel' },
    // Tier 2: slopes down to the left
    { id: 'g2', x1: 52, y1: 440, x2: 460, y2: 420, type: 'steel' },
    // Tier 3: slopes down to the right
    { id: 'g3', x1: 20, y1: 332, x2: 428, y2: 352, type: 'steel' },
    // Tier 4: slopes down to the left
    { id: 'g4', x1: 52, y1: 258, x2: 460, y2: 238, type: 'steel' },
    // Tier 5 (Top under Boss): slopes down to the right
    { id: 'g5', x1: 20, y1: 154, x2: 428, y2: 174, type: 'steel' },
    // Pauline Rescue Platform
    { id: 'top', x1: 175, y1: 92, x2: 290, y2: 92, type: 'steel' }
  ];

  const ladders = [
    { x: 386, topY: 528, bottomY: 596, broken: false },
    { x: 165, topY: 517, bottomY: 604, broken: true, gapTop: 550, gapBottom: 576 },
    { x: 92, topY: 438, bottomY: 514, broken: false },
    { x: 230, topY: 431, bottomY: 520, broken: false },
    { x: 150, topY: 338, bottomY: 435, broken: false },
    { x: 392, topY: 350, bottomY: 423, broken: false },
    { x: 295, topY: 345, bottomY: 428, broken: true, gapTop: 374, gapBottom: 400 },
    { x: 92, topY: 256, bottomY: 336, broken: false },
    { x: 250, topY: 248, bottomY: 343, broken: false },
    { x: 365, topY: 243, bottomY: 349, broken: true, gapTop: 280, gapBottom: 308 },
    { x: 392, topY: 172, bottomY: 241, broken: false },
    { x: 215, topY: 163, bottomY: 250, broken: true, gapTop: 192, gapBottom: 222 },
    { x: 268, topY: 92, bottomY: 166, broken: false }
  ];

  return {
    index: 0,
    code: '25m',
    name: 'GIRDERS',
    girders,
    ladders,
    elevators: [],
    rivets: [],
    oilDrums: [{ x: 48, y: 604, lit: true }],
    hammers: [
      { x: 64, y: 482, taken: false },
      { x: 344, y: 318, taken: false }
    ],
    bonuses: [
      { x: 424, y: 216, kind: 'purse', pts: 300, taken: false },
      { x: 78, y: 412, kind: 'umbrella', pts: 500, taken: false }
    ],
    playerSpawn: { x: 94, y: 604 },
    boss: { x: 82, y: 157, minX: 82, maxX: 82, patrolling: false },
    pauline: { x: 218, y: 92 },
    goalY: 96
  };
}

// ---------------------------------------------------------------------------
// STAGE 2: 50m PIE FACTORY (CEMENT FACTORY)
// ---------------------------------------------------------------------------
function build50mPieFactory() {
  const girders = [
    { id: 'g0', x1: 20, y1: 604, x2: 460, y2: 604, type: 'steel' },
    // Conveyor Tier 1
    { id: 'c1', x1: 20, y1: 502, x2: 460, y2: 502, type: 'conveyor', conveyorDir: 1 },
    // Middle Tier with Central Oil Drum
    { id: 'g2', x1: 20, y1: 400, x2: 460, y2: 400, type: 'steel' },
    // Conveyor Tier 3
    { id: 'c3', x1: 20, y1: 298, x2: 460, y2: 298, type: 'conveyor', conveyorDir: -1 },
    // Boss Tier
    { id: 'g4', x1: 20, y1: 196, x2: 460, y2: 196, type: 'steel' },
    // Pauline Platform
    { id: 'top', x1: 180, y1: 108, x2: 300, y2: 108, type: 'steel' }
  ];

  const ladders = [
    { x: 74, topY: 502, bottomY: 604, broken: false },
    { x: 240, topY: 502, bottomY: 604, broken: false },
    { x: 406, topY: 502, bottomY: 604, broken: false },

    { x: 124, topY: 400, bottomY: 502, broken: false },
    { x: 356, topY: 400, bottomY: 502, broken: false },

    { x: 74, topY: 298, bottomY: 400, broken: false },
    { x: 406, topY: 298, bottomY: 400, broken: false },

    // Two Retractable Ladders near the top
    { x: 112, topY: 196, bottomY: 298, broken: false, retractable: true, retractProgress: 1 },
    { x: 368, topY: 196, bottomY: 298, broken: false, retractable: true, retractProgress: 1 },

    { x: 240, topY: 108, bottomY: 196, broken: false }
  ];

  return {
    index: 1,
    code: '50m',
    name: 'PIE FACTORY',
    girders,
    ladders,
    elevators: [],
    rivets: [],
    oilDrums: [{ x: 240, y: 400, lit: true }],
    hammers: [
      { x: 158, y: 372, taken: false },
      { x: 322, y: 270, taken: false }
    ],
    bonuses: [
      { x: 428, y: 476, kind: 'hat', pts: 300, taken: false },
      { x: 52, y: 272, kind: 'purse', pts: 500, taken: false }
    ],
    playerSpawn: { x: 110, y: 604 },
    boss: { x: 240, y: 196, minX: 70, maxX: 410, patrolling: true },
    pauline: { x: 240, y: 108 },
    goalY: 112
  };
}

// ---------------------------------------------------------------------------
// STAGE 3: 75m ELEVATORS
// ---------------------------------------------------------------------------
function build75mElevators() {
  const girders = [
    // Left column
    { id: 'l0', x1: 20, y1: 604, x2: 120, y2: 604, type: 'steel' },
    { id: 'l1', x1: 20, y1: 420, x2: 120, y2: 420, type: 'steel' },
    { id: 'l2', x1: 20, y1: 210, x2: 132, y2: 210, type: 'steel' },
    // Center column
    { id: 'c0', x1: 212, y1: 520, x2: 292, y2: 520, type: 'steel' },
    { id: 'c1', x1: 212, y1: 370, x2: 292, y2: 370, type: 'steel' },
    { id: 'c2', x1: 212, y1: 240, x2: 292, y2: 240, type: 'steel' },
    // Right column
    { id: 'r0', x1: 388, y1: 560, x2: 460, y2: 560, type: 'steel' },
    { id: 'r1', x1: 388, y1: 440, x2: 460, y2: 440, type: 'steel' },
    { id: 'r2', x1: 388, y1: 320, x2: 460, y2: 320, type: 'steel' },
    { id: 'r3', x1: 388, y1: 224, x2: 460, y2: 224, type: 'steel' },
    // Top Girder (springs bounce across from left to right)
    { id: 'topBridge', x1: 148, y1: 156, x2: 460, y2: 156, type: 'steel' },
    // Pauline Platform
    { id: 'top', x1: 300, y1: 92, x2: 416, y2: 92, type: 'steel' }
  ];

  const ladders = [
    { x: 64, topY: 420, bottomY: 604, broken: false },
    { x: 234, topY: 370, bottomY: 520, broken: false },
    { x: 272, topY: 240, bottomY: 370, broken: false },
    { x: 424, topY: 440, bottomY: 560, broken: false },
    { x: 424, topY: 320, bottomY: 440, broken: false },
    { x: 424, topY: 224, bottomY: 320, broken: false },
    { x: 438, topY: 156, bottomY: 224, broken: false },
    { x: 356, topY: 92, bottomY: 156, broken: false }
  ];

  // Two vertical elevator shafts (Left goes UP, Right goes DOWN)
  const elevators = [
    { x: 142, w: 44, y: 240, dir: -1, speed: 64, minY: 180, maxY: 620 },
    { x: 142, w: 44, y: 460, dir: -1, speed: 64, minY: 180, maxY: 620 },
    { x: 318, w: 44, y: 220, dir: 1, speed: 64, minY: 180, maxY: 620 },
    { x: 318, w: 44, y: 440, dir: 1, speed: 64, minY: 180, maxY: 620 }
  ];

  return {
    index: 2,
    code: '75m',
    name: 'ELEVATORS',
    girders,
    ladders,
    elevators,
    rivets: [],
    oilDrums: [],
    hammers: [],
    bonuses: [
      { x: 56, y: 394, kind: 'umbrella', pts: 500, taken: false },
      { x: 252, y: 494, kind: 'purse', pts: 300, taken: false },
      { x: 424, y: 534, kind: 'hat', pts: 800, taken: false }
    ],
    playerSpawn: { x: 64, y: 604 },
    boss: { x: 76, y: 210, minX: 76, maxX: 76, patrolling: false },
    pauline: { x: 332, y: 92 },
    goalY: 96
  };
}

// ---------------------------------------------------------------------------
// STAGE 4: 100m RIVETS
// ---------------------------------------------------------------------------
function build100mRivets() {
  // Each upper tier is split at its 2 rivet gaps; intact rivets bridge those gaps.
  const girders = [
    // Tier 0 (Bottom, solid)
    { id: 'r0', x1: 20, y1: 604, x2: 460, y2: 604, type: 'steel' },

    // Tier 1 (gaps at x=120..144 and x=336..360)
    { id: 'r1a', x1: 36, y1: 504, x2: 120, y2: 504, type: 'steel' },
    { id: 'r1b', x1: 144, y1: 504, x2: 336, y2: 504, type: 'steel' },
    { id: 'r1c', x1: 360, y1: 504, x2: 444, y2: 504, type: 'steel' },

    // Tier 2 (gaps at x=130..154 and x=326..350)
    { id: 'r2a', x1: 52, y1: 404, x2: 130, y2: 404, type: 'steel' },
    { id: 'r2b', x1: 154, y1: 404, x2: 326, y2: 404, type: 'steel' },
    { id: 'r2c', x1: 350, y1: 404, x2: 428, y2: 404, type: 'steel' },

    // Tier 3 (gaps at x=140..164 and x=316..340)
    { id: 'r3a', x1: 68, y1: 304, x2: 140, y2: 304, type: 'steel' },
    { id: 'r3b', x1: 164, y1: 304, x2: 316, y2: 304, type: 'steel' },
    { id: 'r3c', x1: 340, y1: 304, x2: 412, y2: 304, type: 'steel' },

    // Tier 4 (gaps at x=150..174 and x=306..330)
    { id: 'r4a', x1: 84, y1: 204, x2: 150, y2: 204, type: 'steel' },
    { id: 'r4b', x1: 174, y1: 204, x2: 306, y2: 204, type: 'steel' },
    { id: 'r4c', x1: 330, y1: 204, x2: 396, y2: 204, type: 'steel' },

    // Pauline Platform
    { id: 'top', x1: 185, y1: 104, x2: 295, y2: 104, type: 'steel' }
  ];

  const rivets = [
    { id: 0, x: 132, y: 504, x1: 120, x2: 144, removed: false },
    { id: 1, x: 348, y: 504, x1: 336, x2: 360, removed: false },
    { id: 2, x: 142, y: 404, x1: 130, x2: 154, removed: false },
    { id: 3, x: 338, y: 404, x1: 326, x2: 350, removed: false },
    { id: 4, x: 152, y: 304, x1: 140, x2: 164, removed: false },
    { id: 5, x: 328, y: 304, x1: 316, x2: 340, removed: false },
    { id: 6, x: 162, y: 204, x1: 150, x2: 174, removed: false },
    { id: 7, x: 318, y: 204, x1: 306, x2: 330, removed: false }
  ];

  const ladders = [
    { x: 64, topY: 504, bottomY: 604, broken: false },
    { x: 240, topY: 504, bottomY: 604, broken: false },
    { x: 416, topY: 504, bottomY: 604, broken: false },

    { x: 80, topY: 404, bottomY: 504, broken: false },
    { x: 196, topY: 404, bottomY: 504, broken: false },
    { x: 284, topY: 404, bottomY: 504, broken: false },
    { x: 400, topY: 404, bottomY: 504, broken: false },

    { x: 96, topY: 304, bottomY: 404, broken: false },
    { x: 240, topY: 304, bottomY: 404, broken: false },
    { x: 384, topY: 304, bottomY: 404, broken: false },

    { x: 112, topY: 204, bottomY: 304, broken: false },
    { x: 202, topY: 204, bottomY: 304, broken: false },
    { x: 278, topY: 204, bottomY: 304, broken: false },
    { x: 368, topY: 204, bottomY: 304, broken: false }
  ];

  return {
    index: 3,
    code: '100m',
    name: 'RIVETS',
    girders,
    ladders,
    elevators: [],
    rivets,
    oilDrums: [],
    hammers: [
      { x: 240, y: 476, taken: false },
      { x: 240, y: 276, taken: false }
    ],
    bonuses: [
      { x: 92, y: 478, kind: 'purse', pts: 300, taken: false },
      { x: 388, y: 378, kind: 'umbrella', pts: 500, taken: false },
      { x: 368, y: 178, kind: 'hat', pts: 800, taken: false }
    ],
    playerSpawn: { x: 240, y: 604 },
    boss: { x: 240, y: 204, minX: 240, maxX: 240, patrolling: false },
    pauline: { x: 240, y: 104 },
    goalY: 108
  };
}
