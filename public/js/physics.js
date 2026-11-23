import { getGirderYAt, PLAYFIELD_W } from './stages.js';

export const GRAVITY = 780;
export const JUMP_VEL = -282;
export const WALK_SPEED = 112;
export const CLIMB_SPEED = 86;
export const MAX_SAFE_FALL = 96;

// Find supporting surface (girder, intact rivet bridge, or elevator) under (x, y)
export function findSupportBelow(x, y, prevY, stage) {
  let best = null;
  let bestY = Infinity;

  // 1. Girders
  for (const g of stage.girders) {
    if (x >= g.x1 - 4 && x <= g.x2 + 4) {
      const gy = getGirderYAt(g, x);
      if (prevY <= gy + 8 && gy >= y - 10 && gy < bestY) {
        bestY = gy;
        best = { y: gy, girder: g, elevator: null };
      }
    }
  }

  // 2. Intact Rivets (act as solid girder bridges in 100m)
  for (const r of stage.rivets) {
    if (!r.removed && x >= r.x1 - 3 && x <= r.x2 + 3) {
      if (prevY <= r.y + 8 && r.y >= y - 10 && r.y < bestY) {
        bestY = r.y;
        best = { y: r.y, girder: { type: 'steel', y1: r.y, y2: r.y, x1: r.x1, x2: r.x2 }, elevator: null };
      }
    }
  }

  // 3. Elevators (75m)
  for (const el of stage.elevators) {
    if (x >= el.x - 4 && x <= el.x + el.w + 4) {
      if (prevY <= el.y + 10 && el.y >= y - 10 && el.y < bestY) {
        bestY = el.y;
        best = { y: el.y, girder: null, elevator: el };
      }
    }
  }

  return best;
}

// Find climbable ladder near player
export function findLadder(x, y, wantDir, stage) {
  for (const l of stage.ladders) {
    if (l.retractable && l.retractProgress < 0.72) continue;

    const dx = Math.abs(x - l.x);
    if (dx > 13) continue;

    if (wantDir < 0) {
      // Climbing UP: player feet must be between topY + 2 and bottomY + 6
      if (l.broken && y <= l.gapBottom + 4 && y >= l.gapTop) continue;
      if (y <= l.bottomY + 8 && y >= l.topY + 2) {
        return l;
      }
    } else if (wantDir > 0) {
      // Climbing DOWN: player feet near topY or along ladder
      if (l.broken && y >= l.gapTop - 4 && y <= l.gapBottom) continue;
      if (y >= l.topY - 8 && y <= l.bottomY - 2) {
        return l;
      }
    }
  }
  return null;
}

// Forgiving AABB overlap check (~20% inset hitboxes)
export function boxOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return (
    Math.abs(ax - bx) * 2 < aw + bw &&
    Math.abs(ay - by) * 2 < ah + bh
  );
}

export function updatePlayerPhysics(player, input, stage, dt, conveyorDirGlobal, callbacks) {
  if (player.dead) return;

  const prevY = player.y;

  // Recover squash & stretch smoothly
  player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 16);
  player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 16);

  // Jump input buffer countdown
  if (input.jumpPressed) {
    player.jumpBuffer = 4;
  } else if (player.jumpBuffer > 0) {
    player.jumpBuffer--;
  }

  // Hammer timer
  if (player.hammerTimer > 0) {
    player.hammerTimer = Math.max(0, player.hammerTimer - dt);
  }

  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  // -------------------------------------------------------------------------
  // CLIMBING STATE
  // -------------------------------------------------------------------------
  if (player.onLadder) {
    const l = player.currentLadder;
    if (!l || (l.retractable && l.retractProgress < 0.72)) {
      player.onLadder = false;
      player.currentLadder = null;
      player.fallStartY = player.y;
      return;
    }

    // Ladder Magnetism: smoothly pull player onto ladder centerline
    const diff = l.x - player.x;
    player.x += Math.sign(diff) * Math.min(Math.abs(diff), 3.5);

    player.vx = 0;
    player.vy = moveY * CLIMB_SPEED;
    player.y += player.vy * dt;

    if (moveY !== 0) {
      player.animTimer += dt * 10;
      callbacks.onClimb();
    }

    // Prevent climbing past broken ladder gap
    if (l.broken) {
      if (moveY < 0 && player.y < l.gapBottom + 2) {
        player.y = l.gapBottom + 2;
      }
    }

    // Reached top of ladder
    if (player.y <= l.topY) {
      player.y = l.topY;
      player.onLadder = false;
      player.onGround = true;
      player.currentLadder = null;
      player.fallStartY = player.y;
    } else if (player.y >= l.bottomY) {
      player.y = l.bottomY;
      player.onLadder = false;
      player.onGround = true;
      player.currentLadder = null;
      player.fallStartY = player.y;
    }
    return;
  }

  // -------------------------------------------------------------------------
  // ATTEMPT TO GRAB LADDER (only when not wielding hammer and not mid-jump)
  // -------------------------------------------------------------------------
  if (player.hammerTimer <= 0 && moveY !== 0 && (player.onGround || Math.abs(player.vy) < 40)) {
    const ladder = findLadder(player.x, player.y, moveY, stage);
    if (ladder) {
      player.onLadder = true;
      player.onGround = false;
      player.currentLadder = ladder;
      player.currentElevator = null;
      player.vx = 0;
      player.vy = 0;
      // Nudge onto ladder immediately
      const diff = ladder.x - player.x;
      player.x += Math.sign(diff) * Math.min(Math.abs(diff), 4);
      if (moveY > 0 && player.y < ladder.topY + 4) {
        player.y = ladder.topY + 4;
      }
      return;
    }
  }

  // -------------------------------------------------------------------------
  // GROUNDED MOVEMENT & JUMP INITIATION
  // -------------------------------------------------------------------------
  if (player.onGround) {
    player.vx = moveX * WALK_SPEED;
    if (moveX !== 0) {
      player.facing = moveX;
      player.animTimer += dt * 12;
      callbacks.onFootstep();
    }

    // Conveyor belt push (Stage 2)
    let beltPush = 0;
    if (player.currentGirder && player.currentGirder.type === 'conveyor') {
      beltPush = conveyorDirGlobal * player.currentGirder.conveyorDir * 44;
    }

    player.x += (player.vx + beltPush) * dt;
    player.x = Math.max(22, Math.min(PLAYFIELD_W - 22, player.x));

    // Ride elevator vertically if standing on one
    if (player.currentElevator) {
      player.y = player.currentElevator.y;
      player.fallStartY = player.y;
      if (
        player.x < player.currentElevator.x - 4 ||
        player.x > player.currentElevator.x + player.currentElevator.w + 4
      ) {
        player.onGround = false;
        player.currentElevator = null;
        player.fallStartY = player.y;
      }
    }

    // Committed Jump (with 4-frame input buffer!)
    if (player.jumpBuffer > 0 && player.hammerTimer <= 0) {
      player.jumpBuffer = 0;
      player.onGround = false;
      player.currentElevator = null;
      player.currentGirder = null;
      player.vy = JUMP_VEL;
      player.vx = moveX * WALK_SPEED; // Locked horizontal velocity
      player.fallStartY = player.y;
      player.scaleX = 0.82;
      player.scaleY = 1.22;
      player.jumpedHazards.clear();
      callbacks.onJump();
      return;
    }

    // Re-snap to girder if still grounded
    if (player.onGround && !player.currentElevator) {
      const sup = findSupportBelow(player.x, player.y, prevY, stage);
      if (sup && Math.abs(sup.y - player.y) <= 10) {
        player.y = sup.y;
        player.currentGirder = sup.girder;
        player.fallStartY = player.y;
      } else {
        player.onGround = false;
        player.currentGirder = null;
        player.fallStartY = player.y;
      }
    }
  } else {
    // -----------------------------------------------------------------------
    // AIRBORNE (COMMITTED JUMP ARC - NO MID-AIR STEERING)
    // -----------------------------------------------------------------------
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Wall bounds
    if (player.x < 22) {
      player.x = 22;
      player.vx = 0;
    } else if (player.x > PLAYFIELD_W - 22) {
      player.x = PLAYFIELD_W - 22;
      player.vx = 0;
    }

    // Landing check (only when descending)
    if (player.vy >= 0) {
      const sup = findSupportBelow(player.x, player.y, prevY, stage);
      if (sup) {
        const fallDist = sup.y - player.fallStartY;
        player.y = sup.y;
        player.vy = 0;
        player.vx = 0;
        player.onGround = true;
        player.currentGirder = sup.girder;
        player.currentElevator = sup.elevator;
        player.scaleX = 1.22;
        player.scaleY = 0.80;

        if (fallDist > MAX_SAFE_FALL && !sup.elevator) {
          callbacks.onFallDeath();
          return;
        }
        callbacks.onLand();
        return;
      }
    }

    // Fell off bottom of tower
    if (player.y > 632) {
      callbacks.onFallDeath();
    }
  }
}
