import { PLAYFIELD_W, PLAYFIELD_H, getGirderYAt } from './stages.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.skylineBuildings = this._generateSkyline();
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.floor(this.viewW * this.dpr);
    this.canvas.height = Math.floor(this.viewH * this.dpr);
  }

  _generateSkyline() {
    const buildings = [];
    let x = -200;
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    while (x < 2200) {
      const w = 38 + rand() * 68;
      const h = 110 + rand() * 290;
      const windows = [];
      for (let wy = 18; wy < h - 20; wy += 18) {
        for (let wx = 8; wx < w - 10; wx += 14) {
          if (rand() > 0.62) {
            windows.push({
              x: wx,
              y: wy,
              color: rand() > 0.35 ? 'rgba(255, 190, 90, 0.16)' : 'rgba(90, 210, 255, 0.14)'
            });
          }
        }
      }
      buildings.push({ x, w, h, windows });
      x += w + 6 + rand() * 14;
    }
    return buildings;
  }

  render(state) {
    const ctx = this.ctx;
    const { viewW, viewH, dpr } = this;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Deep Obsidian Background
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, viewW, viewH);

    // Compute centered 3:4 playfield transform
    const scale = Math.min(viewW / PLAYFIELD_W, viewH / PLAYFIELD_H);
    const pfX = (viewW - PLAYFIELD_W * scale) * 0.5;
    const pfY = (viewH - PLAYFIELD_H * scale) * 0.5;

    // Parallax offset rises smoothly as player climbs stages 25m -> 100m
    const climbProgress = state.stageIndex + (state.transitioning ? state.transitionProgress : 0);
    const skylineOffsetY = climbProgress * 46;

    // 2. Widescreen Parallax City Skyline & Distant Scaffolding
    this._drawWidescreenBackdrop(ctx, viewW, viewH, pfX, pfY, scale, skylineOffsetY, state.time);

    // 3. Playfield Transform + Micro Screen Shake
    ctx.save();
    const shakeX = state.shakeTimer > 0 ? (Math.random() - 0.5) * state.shakeMag * 2 : 0;
    const shakeY = state.shakeTimer > 0 ? (Math.random() - 0.5) * state.shakeMag * 2 : 0;
    ctx.translate(pfX + shakeX * scale, pfY + shakeY * scale);
    ctx.scale(scale, scale);

    // Subtle ambient tower aura behind the playfield
    const towerGlow = ctx.createRadialGradient(
      PLAYFIELD_W / 2, PLAYFIELD_H / 2, 40,
      PLAYFIELD_W / 2, PLAYFIELD_H / 2, 420
    );
    towerGlow.addColorStop(0, 'rgba(30, 42, 72, 0.18)');
    towerGlow.addColorStop(1, 'rgba(6, 7, 10, 0)');
    ctx.fillStyle = towerGlow;
    ctx.fillRect(-120, -40, PLAYFIELD_W + 240, PLAYFIELD_H + 80);

    // 4. Seamless Skyscraper Camera Pan During Stage Transitions
    if (state.transitioning && state.nextStage) {
      const p = this._easeInOutCubic(state.transitionProgress);
      const panY = p * PLAYFIELD_H;

      ctx.save();
      ctx.beginPath();
      ctx.rect(-30, 52, PLAYFIELD_W + 60, PLAYFIELD_H - 52);
      ctx.clip();

      ctx.save();
      ctx.translate(0, panY);
      this._drawStageWorld(ctx, state.stage, state, false);
      ctx.restore();

      ctx.save();
      ctx.translate(0, panY - PLAYFIELD_H);
      this._drawStageWorld(ctx, state.nextStage, state, true);
      ctx.restore();

      ctx.restore();
    } else {
      this._drawStageWorld(ctx, state.stage, state, false);
    }

    // 5. Minimalist Glowing Industrial LED HUD (top 52px)
    this._drawHUD(ctx, state);

    // 6. Overlays (Title, Stage Intro, Pause, Game Over, Victory)
    this._drawOverlays(ctx, state);

    ctx.restore();
    ctx.restore();
  }

  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  _drawWidescreenBackdrop(ctx, viewW, viewH, pfX, pfY, scale, skylineOffsetY, time) {
    // Subtle horizon glow
    const horizon = ctx.createLinearGradient(0, viewH * 0.35, 0, viewH);
    horizon.addColorStop(0, 'rgba(10, 14, 24, 0)');
    horizon.addColorStop(1, 'rgba(20, 28, 48, 0.32)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, viewW, viewH);

    // Distant City Skyline
    ctx.save();
    const baseY = viewH + skylineOffsetY * 0.55;
    for (const b of this.skylineBuildings) {
      const bx = (b.x / 1800) * viewW;
      const bw = (b.w / 1800) * viewW;
      const bh = (b.h / 900) * viewH;
      const by = baseY - bh;

      ctx.fillStyle = '#090c14';
      ctx.fillRect(bx, by, bw, bh + 200);

      for (const win of b.windows) {
        ctx.fillStyle = win.color;
        ctx.fillRect(bx + (win.x / b.w) * bw, by + (win.y / b.h) * bh, 3, 4);
      }
    }
    ctx.restore();

    // Subtle side scaffolding silhouettes in widescreen wings
    ctx.save();
    ctx.strokeStyle = 'rgba(35, 45, 68, 0.28)';
    ctx.lineWidth = 1.5;
    const step = 48 * scale;
    const leftEdge = pfX - 10;
    const rightEdge = pfX + PLAYFIELD_W * scale + 10;

    if (leftEdge > 24) {
      for (let y = (skylineOffsetY % 48); y < viewH; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(leftEdge, y);
        ctx.moveTo(leftEdge - step, y);
        ctx.lineTo(leftEdge, y + step);
        ctx.stroke();
      }
    }
    if (viewW - rightEdge > 24) {
      for (let y = (skylineOffsetY % 48); y < viewH; y += step) {
        ctx.beginPath();
        ctx.moveTo(rightEdge, y);
        ctx.lineTo(viewW, y);
        ctx.moveTo(rightEdge, y);
        ctx.lineTo(rightEdge + step, y + step);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Subtle scanline vignette at edges
    const vig = ctx.createRadialGradient(
      viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.35,
      viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2, 3, 6, 0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  _drawStageWorld(ctx, stage, state, isPreview) {
    const time = state.time;

    // Gather dynamic light sources for metallic girder specular reaction
    const lights = [];
    for (const d of stage.oilDrums) {
      if (d.lit) {
        const flicker = 0.85 + Math.sin(time * 18) * 0.1 + Math.cos(time * 29) * 0.05;
        lights.push({ x: d.x, y: d.y - 18, r: 135 * flicker, color: '255, 130, 35', alpha: 0.42 });
      }
    }
    for (const h of stage.hammers) {
      if (!h.taken) {
        lights.push({ x: h.x, y: h.y, r: 64, color: '255, 215, 70', alpha: 0.28 });
      }
    }
    for (const r of stage.rivets) {
      if (!r.removed) {
        lights.push({ x: r.x, y: r.y, r: 44, color: '255, 175, 45', alpha: 0.24 });
      }
    }
    if (!isPreview) {
      for (const fb of state.fireballs) {
        lights.push({ x: fb.x, y: fb.y - 8, r: 78, color: '0, 225, 255', alpha: 0.35 });
      }
      for (const b of state.barrels) {
        if (b.blue) {
          lights.push({ x: b.x, y: b.y - 8, r: 75, color: '65, 185, 255', alpha: 0.35 });
        }
      }
      for (const sp of state.springs) {
        lights.push({ x: sp.x, y: sp.y - 8, r: 65, color: '255, 60, 210', alpha: 0.34 });
      }
      if (state.player && state.player.hammerTimer > 0) {
        lights.push({ x: state.player.x, y: state.player.y - 16, r: 95, color: '255, 200, 60', alpha: 0.36 });
      }
    }

    // Pauline overhead spotlight
    lights.push({ x: stage.pauline.x, y: stage.pauline.y - 24, r: 105, color: '255, 220, 235', alpha: 0.22 });

    // Girder stomp vibration offset
    const girderVib = state.girderShake > 0 ? Math.sin(time * 65) * 1.5 : 0;

    // 1. Elevator shafts & cables (Stage 3)
    if (stage.elevators.length > 0) {
      this._drawElevatorShafts(ctx, stage, time);
    }

    // 2. Girders (with metallic specular highlights reacting to lights)
    for (const g of stage.girders) {
      this._drawGirder(ctx, g, lights, state.conveyorDir, time, girderVib);
    }

    // 3. Rivets (Stage 4)
    for (const r of stage.rivets) {
      if (!r.removed) {
        this._drawRivet(ctx, r, time);
      }
    }

    // 4. Ladders
    for (const l of stage.ladders) {
      this._drawLadder(ctx, l);
    }

    // 5. Elevators
    for (const el of stage.elevators) {
      this._drawElevatorCar(ctx, el, time);
    }

    // 6. Oil Drums
    for (const d of stage.oilDrums) {
      this._drawOilDrum(ctx, d, time);
    }

    // 7. Hammers & Bonus Items
    for (const h of stage.hammers) {
      if (!h.taken) this._drawHammer(ctx, h, time);
    }
    for (const b of stage.bonuses) {
      if (!b.taken) this._drawBonusItem(ctx, b, time);
    }

    // 8. Pauline & Boss
    this._drawPauline(ctx, stage.pauline, time, state.paulineHelpTimer);
    if (!isPreview) {
      this._drawBoss(ctx, state.boss, time);
    } else {
      this._drawBoss(ctx, { x: stage.boss.x, y: stage.boss.y, animState: 'idle', facing: 1 }, time);
    }

    // 9. Hazards & Player (skip in preview during pan)
    if (!isPreview) {
      for (const b of state.barrels) this._drawBarrel(ctx, b, time);
      for (const p of state.pies) this._drawPie(ctx, p);
      for (const sp of state.springs) this._drawSpring(ctx, sp);
      for (const fb of state.fireballs) this._drawFireball(ctx, fb, time);

      if (state.player && !state.player.dead) {
        this._drawPlayer(ctx, state.player, time);
      } else if (state.player && state.player.dead) {
        this._drawPlayerDeath(ctx, state.player, state.deathTimer);
      }

      // Particles & Floating Scores
      this._drawParticles(ctx, state.particles);
      this._drawFloatingTexts(ctx, state.floatingTexts);
    }

    // 10. Dynamic 2D Additive Lighting Layer
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const grad = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
      grad.addColorStop(0, `rgba(${l.color}, ${l.alpha})`);
      grad.addColorStop(0.45, `rgba(${l.color}, ${l.alpha * 0.35})`);
      grad.addColorStop(1, `rgba(${l.color}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pauline overhead spotlight cone
    const px = stage.pauline.x;
    const py = stage.pauline.y;
    const cone = ctx.createLinearGradient(px, py - 80, px, py + 10);
    cone.addColorStop(0, 'rgba(255, 220, 240, 0.16)');
    cone.addColorStop(1, 'rgba(255, 190, 220, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(px - 14, py - 78);
    ctx.lineTo(px + 14, py - 78);
    ctx.lineTo(px + 46, py + 6);
    ctx.lineTo(px - 46, py + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawGirder(ctx, g, lights, conveyorDir, time, vibY) {
    const x1 = g.x1;
    const y1 = g.y1 + vibY;
    const x2 = g.x2;
    const y2 = g.y2 + vibY;
    const h = 11;

    ctx.save();
    // Base steel body
    ctx.fillStyle = g.type === 'conveyor' ? '#1e293b' : '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 + h);
    ctx.lineTo(x1, y1 + h);
    ctx.closePath();
    ctx.fill();

    // Truss diagonal struts inside girder
    ctx.strokeStyle = g.type === 'conveyor' ? '#334155' : '#991b1b';
    ctx.lineWidth = 1.5;
    const segs = Math.max(4, Math.floor((x2 - x1) / 14));
    ctx.beginPath();
    for (let i = 0; i < segs; i++) {
      const tx1 = x1 + ((x2 - x1) * i) / segs;
      const tx2 = x1 + ((x2 - x1) * (i + 1)) / segs;
      const ty1 = getGirderYAt(g, tx1) + vibY;
      const ty2 = getGirderYAt(g, tx2) + vibY;
      ctx.moveTo(tx1, ty1 + 2);
      ctx.lineTo(tx2, ty2 + h - 2);
      ctx.moveTo(tx2, ty2 + 2);
      ctx.lineTo(tx1, ty1 + h - 2);
    }
    ctx.stroke();

    // Top flange highlight
    ctx.strokeStyle = g.type === 'conveyor' ? '#64748b' : '#ef4444';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + 1);
    ctx.lineTo(x2, y2 + 1);
    ctx.stroke();

    // Bottom flange shadow
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + h);
    ctx.lineTo(x2, y2 + h);
    ctx.stroke();

    // Dynamic specular highlight from nearby lights
    for (const l of lights) {
      if (l.x >= x1 - l.r && l.x <= x2 + l.r) {
        const gy = getGirderYAt(g, Math.max(x1, Math.min(x2, l.x))) + vibY;
        const dy = Math.abs(l.y - gy);
        if (dy < l.r) {
          const strength = (1 - dy / l.r) * 0.55;
          const sx1 = Math.max(x1, l.x - l.r * 0.65);
          const sx2 = Math.min(x2, l.x + l.r * 0.65);
          const grad = ctx.createLinearGradient(sx1, gy, sx2, gy);
          grad.addColorStop(0, `rgba(${l.color}, 0)`);
          grad.addColorStop(0.5, `rgba(${l.color}, ${strength})`);
          grad.addColorStop(1, `rgba(${l.color}, 0)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(sx1, getGirderYAt(g, sx1) + vibY + 1);
          ctx.lineTo(sx2, getGirderYAt(g, sx2) + vibY + 1);
          ctx.stroke();
        }
      }
    }

    // Conveyor Belt Glowing Directional Chevrons & End Pulleys
    if (g.type === 'conveyor') {
      const dir = conveyorDir * g.conveyorDir;
      const offset = ((time * 42 * dir) % 24 + 24) % 24;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 1.8;
      for (let cx = x1 + 14 + offset; cx < x2 - 14; cx += 24) {
        ctx.beginPath();
        ctx.moveTo(cx - 4 * dir, y1 + 3);
        ctx.lineTo(cx + 3 * dir, y1 + 5.5);
        ctx.lineTo(cx - 4 * dir, y1 + 8);
        ctx.stroke();
      }
      // Pulley wheels
      for (const px of [x1 + 6, x2 - 6]) {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(px, y1 + 5.5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(px, y1 + 5.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawLadder(ctx, l) {
    ctx.save();
    const effectiveTop = l.retractable
      ? l.bottomY - (l.bottomY - l.topY) * l.retractProgress
      : l.topY;

    const color = l.retractable ? '#38bdf8' : '#38bdf8';
    ctx.strokeStyle = l.retractable ? 'rgba(56, 189, 248, 0.9)' : 'rgba(125, 211, 252, 0.78)';
    ctx.lineWidth = 2;

    const halfW = 7;
    const drawSegment = (yStart, yEnd) => {
      if (yEnd <= yStart) return;
      ctx.beginPath();
      ctx.moveTo(l.x - halfW, yStart);
      ctx.lineTo(l.x - halfW, yEnd);
      ctx.moveTo(l.x + halfW, yStart);
      ctx.lineTo(l.x + halfW, yEnd);
      for (let ry = yStart + 6; ry < yEnd; ry += 9) {
        ctx.moveTo(l.x - halfW, ry);
        ctx.lineTo(l.x + halfW, ry);
      }
      ctx.stroke();
    };

    if (l.broken) {
      drawSegment(effectiveTop, l.gapTop);
      drawSegment(l.gapBottom, l.bottomY);
    } else {
      drawSegment(effectiveTop, l.bottomY);
    }

    // Subtle glow on retractable ladders
    if (l.retractable) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(l.x - halfW, effectiveTop);
      ctx.lineTo(l.x - halfW, l.bottomY);
      ctx.moveTo(l.x + halfW, effectiveTop);
      ctx.lineTo(l.x + halfW, l.bottomY);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawElevatorShafts(ctx, stage, time) {
    ctx.save();
    const shafts = [164, 340];
    for (const sx of shafts) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(sx, 170);
      ctx.lineTo(sx, 624);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  _drawElevatorCar(ctx, el, time) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(el.x, el.y, el.w, 10);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(el.x, el.y, el.w, 10);
    // Glow strip
    ctx.fillStyle = `rgba(56, 189, 248, ${0.45 + Math.sin(time * 8) * 0.15})`;
    ctx.fillRect(el.x + 4, el.y + 3, el.w - 8, 4);
    ctx.restore();
  }

  _drawRivet(ctx, r, time) {
    ctx.save();
    const pulse = 0.75 + Math.sin(time * 6 + r.id) * 0.25;
    // Hot glowing bolt bridging the gap
    ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
    ctx.fillRect(r.x1, r.y, r.x2 - r.x1, 10);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(r.x - 5, r.y - 3, 10, 5);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x - 5, r.y - 3, 10, 5);
    ctx.restore();
  }

  _drawOilDrum(ctx, d, time) {
    ctx.save();
    const x = d.x;
    const y = d.y;
    // Drum body
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(x - 12, y - 24, 24, 24);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 12, y - 24, 24, 24);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OIL', x, y - 9);

    // Flickering flames
    if (d.lit) {
      for (let i = 0; i < 3; i++) {
        const fx = x - 6 + i * 6 + Math.sin(time * 22 + i * 2) * 2;
        const fh = 12 + Math.sin(time * 26 + i * 3) * 5;
        ctx.fillStyle = i === 1 ? '#fef08a' : '#f97316';
        ctx.beginPath();
        ctx.moveTo(fx - 4, y - 24);
        ctx.lineTo(fx, y - 24 - fh);
        ctx.lineTo(fx + 4, y - 24);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawHammer(ctx, h, time) {
    ctx.save();
    const bob = Math.sin(time * 5) * 2.5;
    ctx.translate(h.x, h.y + bob);
    // Handle
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-2, -2, 4, 15);
    // Mallet head
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-9, -10, 18, 9);
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-9, -10, 18, 9);
    ctx.restore();
  }

  _drawBonusItem(ctx, b, time) {
    ctx.save();
    const bob = Math.sin(time * 4 + b.x) * 2;
    ctx.translate(b.x, b.y + bob);
    if (b.kind === 'purse') {
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(-7, -8, 14, 10);
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -8, 4, Math.PI, 0);
      ctx.stroke();
    } else if (b.kind === 'umbrella') {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 6);
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, -5, 9, Math.PI, 0);
      ctx.fill();
    } else {
      // Hat
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-9, -4, 18, 4);
      ctx.fillRect(-6, -11, 12, 7);
    }
    ctx.restore();
  }

  _drawPauline(ctx, p, time, helpTimer) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // Dress
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.lineTo(4, -18);
    ctx.lineTo(-4, -18);
    ctx.closePath();
    ctx.fill();
    // Head & Hair
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -23, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-6, -28, 12, 5);
    // Waving arms
    const wave = Math.sin(time * 8) * 3;
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -15);
    ctx.lineTo(-10, -20 + wave);
    ctx.moveTo(4, -15);
    ctx.lineTo(10, -20 - wave);
    ctx.stroke();

    if (helpTimer > 0) {
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HELP!', 0, -35);
    }
    ctx.restore();
  }

  _drawBoss(ctx, boss, time) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const beat = boss.animState === 'stomp' ? Math.sin(time * 24) * 3 : Math.sin(time * 4) * 1.5;

    // Legs
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-16, -12, 11, 12);
    ctx.fillRect(5, -12, 11, 12);
    // Torso
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-18, -34 + beat * 0.4, 36, 24);
    // Chest
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-11, -30 + beat * 0.4, 22, 14);
    // Arms
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-25, -32 + beat, 8, 22);
    ctx.fillRect(17, -32 - beat, 8, 22);
    // Head
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-12, -46 + beat * 0.3, 24, 15);
    // Face & Brow
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-8, -42 + beat * 0.3, 16, 8);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -41 + beat * 0.3, 4, 3);
    ctx.fillRect(2, -41 + beat * 0.3, 4, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(-5, -40 + beat * 0.3, 2, 2);
    ctx.fillRect(3, -40 + beat * 0.3, 2, 2);
    ctx.restore();
  }

  _drawBarrel(ctx, b, time) {
    ctx.save();
    ctx.translate(b.x, b.y - 9);
    ctx.rotate(b.rot);
    ctx.fillStyle = b.blue ? '#0284c7' : '#b45309';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.blue ? '#7dd3fc' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Stave lines
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  }

  _drawPie(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y - 6);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-10, -5, 20, 10);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(-8, -7, 16, 3);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-10, -5, 20, 10);
    ctx.restore();
  }

  _drawSpring(ctx, sp) {
    ctx.save();
    // Neon-magenta trail
    if (sp.trail.length > 1) {
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      sp.trail.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y - 8);
        else ctx.lineTo(pt.x, pt.y - 8);
      });
      ctx.stroke();
    }

    ctx.translate(sp.x, sp.y - 8);
    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(7, -3);
    ctx.lineTo(-7, 1);
    ctx.lineTo(7, 5);
    ctx.lineTo(-7, 8);
    ctx.stroke();
    ctx.restore();
  }

  _drawFireball(ctx, fb, time) {
    ctx.save();
    ctx.translate(fb.x, fb.y - 9);
    const flicker = Math.sin(time * 24 + fb.seed) * 2;
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    // Flame crown
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(0, -13 + flicker);
    ctx.lineTo(6, -2);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4, -2, 2.5, 3);
    ctx.fillRect(1.5, -2, 2.5, 3);
    ctx.restore();
  }

  _drawPlayer(ctx, p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.facing * p.scaleX, p.scaleY);

    const walkBob = p.onGround && Math.abs(p.vx) > 5 ? Math.sin(p.animTimer * 2) * 2 : 0;

    // Legs
    ctx.fillStyle = '#2563eb';
    if (!p.onGround && !p.onLadder) {
      ctx.fillRect(-7, -9, 6, 8);
      ctx.fillRect(2, -11, 6, 8);
    } else {
      ctx.fillRect(-6, -9 + walkBob, 5, 9 - walkBob);
      ctx.fillRect(1, -9 - walkBob, 5, 9 + walkBob);
    }

    // Overalls & Shirt
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-7, -18, 14, 10);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(-6, -15, 12, 7);

    // Head
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-5, -26, 11, 9);
    // Cap
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-6, -29, 13, 4);
    ctx.fillRect(2, -26, 6, 2);
    // Mustache
    ctx.fillStyle = '#451a03';
    ctx.fillRect(1, -20, 6, 2);

    // Active Hammer Swing
    if (p.hammerTimer > 0) {
      const swing = Math.sin(time * 28) > 0 ? -0.9 : 0.25;
      ctx.save();
      ctx.translate(4, -15);
      ctx.rotate(swing);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, -18, 3, 18);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-6, -26, 15, 9);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawPlayerDeath(ctx, p, timer) {
    ctx.save();
    ctx.translate(p.x, p.y - 12);
    ctx.rotate(timer * 14);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-8, -10, 16, 20);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-5, -14, 10, 8);
    ctx.restore();
  }

  _drawParticles(ctx, particles) {
    ctx.save();
    for (const pt of particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color.replace('ALPHA', alpha.toFixed(2));
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.restore();
  }

  _drawFloatingTexts(ctx, texts) {
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    for (const ft of texts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  _drawHUD(ctx, state) {
    ctx.save();
    // Sleek dark glass LED header bar
    ctx.fillStyle = 'rgba(6, 7, 10, 0.88)';
    ctx.fillRect(0, 0, PLAYFIELD_W, 50);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 50);
    ctx.lineTo(PLAYFIELD_W - 10, 50);
    ctx.stroke();

    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f87171';
    ctx.fillText('1UP', 16, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(String(state.score).padStart(6, '0'), 16, 34);

    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('HIGH SCORE', 170, 16);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(String(state.highScore).padStart(6, '0'), 170, 34);

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('BONUS', 286, 16);
    ctx.fillStyle = state.bonusTimer <= 1000 ? '#f87171' : '#e0f2fe';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(String(state.bonusTimer).padStart(4, '0'), 286, 34);

    ctx.textAlign = 'right';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(`L=${state.level}  ${state.stage.code}`, PLAYFIELD_W - 16, 16);

    // Lives icons
    for (let i = 0; i < Math.max(0, state.lives); i++) {
      const lx = PLAYFIELD_W - 22 - i * 16;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(lx - 4, 24, 8, 8);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(lx - 3, 21, 6, 4);
    }

    ctx.restore();
  }

  _drawOverlays(ctx, state) {
    ctx.save();
    if (state.mode === 'title') {
      ctx.fillStyle = 'rgba(6, 7, 10, 0.78)';
      ctx.fillRect(0, 50, PLAYFIELD_W, PLAYFIELD_H - 50);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 38px monospace';
      ctx.fillText('DONKEY KONG', PLAYFIELD_W / 2, 180);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('1981 ARCADE EDITION  //  DYNAMIC LIGHTING', PLAYFIELD_W / 2, 210);

      // Stage Select Box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(72, 260, PLAYFIELD_W - 144, 175);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(72, 260, PLAYFIELD_W - 144, 175);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('SELECT STARTING STAGE (KEYS 1-4)', PLAYFIELD_W / 2, 288);

      const stages = ['1. 25m GIRDERS', '2. 50m PIE FACTORY', '3. 75m ELEVATORS', '4. 100m RIVETS'];
      stages.forEach((label, idx) => {
        const selected = state.selectedStartStage === idx;
        ctx.fillStyle = selected ? '#fef08a' : '#94a3b8';
        ctx.font = selected ? 'bold 15px monospace' : '14px monospace';
        ctx.fillText((selected ? '▶ ' : '  ') + label, PLAYFIELD_W / 2, 322 + idx * 26);
      });

      if (Math.floor(state.time * 2.5) % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('PRESS SPACE OR TAP TO START', PLAYFIELD_W / 2, 495);
      }

      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.fillText('ARROWS / WASD: MOVE & CLIMB   SPACE: JUMP', PLAYFIELD_W / 2, 548);
      ctx.fillText('P: PAUSE   M: MUTE   1-4: STAGE SELECT', PLAYFIELD_W / 2, 568);
    } else if (state.mode === 'paused') {
      ctx.fillStyle = 'rgba(6, 7, 10, 0.72)';
      ctx.fillRect(0, 50, PLAYFIELD_W, PLAYFIELD_H - 50);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('PAUSED', PLAYFIELD_W / 2, 320);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px monospace';
      ctx.fillText('PRESS P TO RESUME', PLAYFIELD_W / 2, 355);
    } else if (state.mode === 'stageIntro') {
      ctx.fillStyle = 'rgba(6, 7, 10, 0.55)';
      ctx.fillRect(90, 270, PLAYFIELD_W - 180, 96);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(90, 270, PLAYFIELD_W - 180, 96);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`STAGE ${state.stage.code}`, PLAYFIELD_W / 2, 304);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(state.stage.name, PLAYFIELD_W / 2, 336);
    } else if (state.mode === 'gameover') {
      ctx.fillStyle = 'rgba(6, 7, 10, 0.82)';
      ctx.fillRect(0, 50, PLAYFIELD_W, PLAYFIELD_H - 50);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 34px monospace';
      ctx.fillText('GAME OVER', PLAYFIELD_W / 2, 290);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`FINAL SCORE: ${state.score}`, PLAYFIELD_W / 2, 332);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px monospace';
      ctx.fillText('PRESS SPACE OR TAP TO CONTINUE', PLAYFIELD_W / 2, 390);
    } else if (state.mode === 'victory') {
      ctx.fillStyle = 'rgba(6, 7, 10, 0.55)';
      ctx.fillRect(70, 250, PLAYFIELD_W - 140, 110);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(70, 250, PLAYFIELD_W - 140, 110);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('ALL RIVETS REMOVED!', PLAYFIELD_W / 2, 290);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`ADVANCING TO LEVEL ${state.level + 1}...`, PLAYFIELD_W / 2, 326);
    }
    ctx.restore();
  }
}
