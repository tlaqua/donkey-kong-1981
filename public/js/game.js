import { SoundEngine } from './audio.js';
import { getStageConfig, PLAYFIELD_W } from './stages.js';
import { updatePlayerPhysics, findSupportBelow, boxOverlap, GRAVITY } from './physics.js';
import { Renderer } from './renderer.js';

const HIGH_SCORE_KEY = 'dk1981_high_score';

class DonkeyKongGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(this.canvas);
    this.audio = new SoundEngine();

    this.keys = new Set();
    this.jumpEdge = false;

    this.state = {
      mode: 'title', // title | stageIntro | playing | paused | dying | stageClear | gameover | victory
      selectedStartStage: 0,
      stageIndex: 0,
      level: 1,
      score: 0,
      highScore: Number(localStorage.getItem(HIGH_SCORE_KEY)) || 10000,
      lives: 3,
      bonusTimer: 5000,
      bonusTick: 0,
      time: 0,

      stage: getStageConfig(0),
      nextStage: null,
      transitioning: false,
      transitionProgress: 0,

      player: null,
      boss: null,
      barrels: [],
      pies: [],
      springs: [],
      fireballs: [],
      particles: [],
      floatingTexts: [],

      conveyorDir: 1,
      conveyorTimer: 0,
      retractTimer: 0,
      barrelSpawnTimer: 0,
      pieSpawnTimer: 0,
      springSpawnTimer: 0,
      fireballSpawnTimer: 0,

      hitStopFrames: 0,
      shakeTimer: 0,
      shakeMag: 0,
      girderShake: 0,
      deathTimer: 0,
      introTimer: 0,
      clearTimer: 0,
      paulineHelpTimer: 0,
      hazardIdCounter: 1
    };

    this._initStageEntities();
    this._bindEvents();
    this.lastFrame = performance.now();
    this.accumulator = 0;
    requestAnimationFrame((t) => this._loop(t));
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.renderer.resize());

    window.addEventListener('keydown', (e) => {
      this.audio.init();
      const code = e.code;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        e.preventDefault();
      }

      if (!this.keys.has(code)) {
        if (code === 'Space') this.jumpEdge = true;
      }
      this.keys.add(code);

      if (code === 'KeyM') {
        this._toggleMute();
        return;
      }

      if (code === 'KeyP') {
        if (this.state.mode === 'playing') this.state.mode = 'paused';
        else if (this.state.mode === 'paused') this.state.mode = 'playing';
        return;
      }

      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) {
        const idx = Number(code.replace('Digit', '')) - 1;
        if (this.state.mode === 'title') {
          this.state.selectedStartStage = idx;
        } else if (this.state.mode === 'playing' || this.state.mode === 'stageIntro') {
          this._loadStage(idx, true);
        }
        return;
      }

      if (this.state.mode === 'title') {
        if (code === 'ArrowUp' || code === 'KeyW') {
          this.state.selectedStartStage = (this.state.selectedStartStage + 3) % 4;
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          this.state.selectedStartStage = (this.state.selectedStartStage + 1) % 4;
        } else if (code === 'Space' || code === 'Enter') {
          this.startNewGame();
        }
      } else if (this.state.mode === 'gameover' && (code === 'Space' || code === 'Enter')) {
        this.state.mode = 'title';
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    document.getElementById('btnMute').addEventListener('click', () => {
      this.audio.init();
      this._toggleMute();
    });

    document.getElementById('btnPause').addEventListener('click', () => {
      this.audio.init();
      if (this.state.mode === 'playing') this.state.mode = 'paused';
      else if (this.state.mode === 'paused') this.state.mode = 'playing';
    });

    this.canvas.addEventListener('pointerdown', () => {
      this.audio.init();
      if (this.state.mode === 'title') {
        this.startNewGame();
      } else if (this.state.mode === 'gameover') {
        this.state.mode = 'title';
      }
    });

    document.querySelectorAll('.t-btn').forEach((btn) => {
      const key = btn.dataset.key;
      const press = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.init();
        if (!this.keys.has(key) && key === 'Space') this.jumpEdge = true;
        this.keys.add(key);
        btn.classList.add('active');
      };
      const release = (e) => {
        e.preventDefault();
        this.keys.delete(key);
        btn.classList.remove('active');
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    });
  }

  _toggleMute() {
    const muted = this.audio.toggleMute();
    const btn = document.getElementById('btnMute');
    btn.textContent = muted ? '🔇' : '🔊';
    btn.classList.toggle('muted', muted);
  }

  startNewGame() {
    this.state.score = 0;
    this.state.lives = 3;
    this.state.level = 1;
    this._loadStage(this.state.selectedStartStage, true);
  }

  _loadStage(stageIndex, showIntro = true) {
    this.state.stageIndex = stageIndex;
    this.state.stage = getStageConfig(stageIndex);
    this._initStageEntities();

    if (showIntro) {
      this.state.mode = 'stageIntro';
      this.state.introTimer = 1.4;
    } else {
      this.state.mode = 'playing';
    }
  }

  _initStageEntities() {
    const st = this.state.stage;

    // Reset bonus timer and any active screen-shake/hit-stop on every spawn
    this.state.bonusTimer = Math.min(8000, 5000 + (this.state.level - 1) * 500);
    this.state.bonusTick = 0;
    this.state.hitStopFrames = 0;
    this.state.shakeTimer = 0;
    this.state.shakeMag = 0;
    this.state.girderShake = 0;

    this.state.player = {
      x: st.playerSpawn.x,
      y: st.playerSpawn.y,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      onLadder: false,
      currentLadder: null,
      currentGirder: st.girders[0],
      currentElevator: null,
      fallStartY: st.playerSpawn.y,
      jumpBuffer: 0,
      hammerTimer: 0,
      animTimer: 0,
      scaleX: 1,
      scaleY: 1,
      dead: false,
      jumpedHazards: new Set()
    };

    this.state.boss = {
      x: st.boss.x,
      y: st.boss.y,
      dir: 1,
      animState: 'idle',
      throwTimer: 1.0
    };

    this.state.barrels = [];
    this.state.pies = [];
    this.state.springs = [];
    this.state.fireballs = [];
    this.state.particles = [];
    this.state.floatingTexts = [];

    this.state.barrelSpawnTimer = 1.1;
    this.state.pieSpawnTimer = 1.2;
    this.state.springSpawnTimer = 1.0;
    this.state.fireballSpawnTimer = 2.0;

    if (st.index === 2) {
      this._spawnFireball(250, 370);
    } else if (st.index === 3) {
      this._spawnFireball(80, 504);
      this._spawnFireball(380, 304);
    }
  }

  _addScore(pts, x, y, showText = true) {
    this.state.score += pts;
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.state.highScore));
    }
    if (showText && x !== undefined && y !== undefined) {
      this.state.floatingTexts.push({
        x,
        y: y - 12,
        text: `+${pts}`,
        life: 0.85,
        maxLife: 0.85
      });
    }
  }

  _spawnParticles(x, y, colorTemplate, count = 10, speed = 110) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 45,
        size: 2 + Math.random() * 2.5,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color: colorTemplate
      });
    }
  }

  _triggerShake(mag = 2.5, dur = 0.14) {
    this.state.shakeMag = mag;
    this.state.shakeTimer = dur;
  }

  _loop(now) {
    const rawDt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.accumulator += rawDt;

    const FIXED_DT = 1 / 60;
    while (this.accumulator >= FIXED_DT) {
      this._update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    this.renderer.render(this.state);
    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    const st = this.state;
    st.time += dt;

    if (st.shakeTimer > 0) st.shakeTimer = Math.max(0, st.shakeTimer - dt);
    if (st.girderShake > 0) st.girderShake = Math.max(0, st.girderShake - dt);
    if (st.paulineHelpTimer > 0) st.paulineHelpTimer -= dt;
    else if (Math.random() < 0.008) st.paulineHelpTimer = 1.1;

    for (let i = st.particles.length - 1; i >= 0; i--) {
      const p = st.particles[i];
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) st.particles.splice(i, 1);
    }
    for (let i = st.floatingTexts.length - 1; i >= 0; i--) {
      const ft = st.floatingTexts[i];
      ft.y -= 26 * dt;
      ft.life -= dt;
      if (ft.life <= 0) st.floatingTexts.splice(i, 1);
    }

    if (st.mode === 'title' || st.mode === 'paused' || st.mode === 'gameover') {
      this.jumpEdge = false;
      return;
    }

    if (st.transitioning) {
      st.transitionProgress += dt * 0.9;
      if (st.transitionProgress >= 1) {
        st.transitioning = false;
        st.transitionProgress = 0;
        const nextIdx = st.nextStage.index;
        st.nextStage = null;
        this._loadStage(nextIdx, true);
      }
      this.jumpEdge = false;
      return;
    }

    if (st.mode === 'stageIntro') {
      st.introTimer -= dt;
      if (st.introTimer <= 0) {
        st.mode = 'playing';
      }
      this.jumpEdge = false;
      return;
    }

    if (st.mode === 'dying') {
      st.deathTimer += dt;
      if (st.deathTimer >= 1.5) {
        st.lives--;
        if (st.lives <= 0) {
          st.mode = 'gameover';
        } else {
          this._initStageEntities();
          st.mode = 'playing';
        }
      }
      this.jumpEdge = false;
      return;
    }

    if (st.mode === 'stageClear' || st.mode === 'victory') {
      st.clearTimer -= dt;
      if (st.clearTimer <= 0) {
        if (st.stageIndex === 3) {
          st.level++;
          st.nextStage = getStageConfig(0);
          st.transitioning = true;
          st.transitionProgress = 0;
        } else {
          st.nextStage = getStageConfig(st.stageIndex + 1);
          st.transitioning = true;
          st.transitionProgress = 0;
        }
      }
      this.jumpEdge = false;
      return;
    }

    if (st.hitStopFrames > 0) {
      st.hitStopFrames--;
      this.jumpEdge = false;
      return;
    }

    const speedMult = 1 + (st.level - 1) * 0.14;

    // Bonus Timer decay (100 pts every 1.5s)
    st.bonusTick += dt;
    if (st.bonusTick >= 1.5) {
      st.bonusTick -= 1.5;
      st.bonusTimer = Math.max(0, st.bonusTimer - 100);
      if (st.bonusTimer === 0) {
        this._killPlayer();
        return;
      }
    }

    this.audio.updateMusic(dt, true, st.player.hammerTimer > 0);
    this.audio.playStageAmbient(st.stageIndex);

    const input = {
      left: this.keys.has('ArrowLeft') || this.keys.has('KeyA'),
      right: this.keys.has('ArrowRight') || this.keys.has('KeyD'),
      up: this.keys.has('ArrowUp') || this.keys.has('KeyW'),
      down: this.keys.has('ArrowDown') || this.keys.has('KeyS'),
      jumpPressed: this.jumpEdge
    };
    this.jumpEdge = false;

    this._updateStageMechanics(dt, speedMult);

    updatePlayerPhysics(st.player, input, st.stage, dt, st.conveyorDir, {
      onFootstep: () => this.audio.playFootstep(),
      onClimb: () => this.audio.playClimb(),
      onJump: () => this.audio.playJump(),
      onLand: () => this.audio.playLand(),
      onFallDeath: () => this._killPlayer()
    });

    if (st.player.dead) return;

    this._updateBossAndSpawners(dt, speedMult);
    this._updateBarrels(dt, speedMult);
    this._updatePies(dt, speedMult);
    this._updateSprings(dt, speedMult);
    this._updateFireballs(dt, speedMult);

    this._checkPickupsAndRivets();
    this._checkJumpOverHazards();
    this._checkCollisions();
    this._checkGoal();
  }

  _updateStageMechanics(dt, speedMult) {
    const st = this.state;
    const stage = st.stage;

    if (stage.index === 1) {
      st.conveyorTimer += dt;
      if (st.conveyorTimer >= 5.5) {
        st.conveyorTimer = 0;
        st.conveyorDir *= -1;
      }

      st.retractTimer += dt;
      const cycle = st.retractTimer % 7.0;
      const targetProgress = cycle < 4.2 ? 1.0 : 0.0;
      for (const l of stage.ladders) {
        if (l.retractable) {
          l.retractProgress += (targetProgress - l.retractProgress) * Math.min(1, dt * 6);
        }
      }

      if (Math.random() < 0.08) {
        const y = Math.random() < 0.5 ? 507 : 303;
        const x = Math.random() < 0.5 ? 26 : PLAYFIELD_W - 26;
        this._spawnParticles(x, y, 'rgba(251, 191, 36, ALPHA)', 2, 45);
      }
    }

    for (const el of stage.elevators) {
      el.y += el.dir * el.speed * speedMult * dt;
      if (el.dir < 0 && el.y < el.minY) el.y = el.maxY;
      if (el.dir > 0 && el.y > el.maxY) el.y = el.minY;
    }
  }

  _updateBossAndSpawners(dt, speedMult) {
    const st = this.state;
    const stage = st.stage;
    const boss = st.boss;

    if (stage.boss.patrolling) {
      boss.x += boss.dir * 42 * dt;
      if (boss.x < stage.boss.minX) {
        boss.x = stage.boss.minX;
        boss.dir = 1;
      } else if (boss.x > stage.boss.maxX) {
        boss.x = stage.boss.maxX;
        boss.dir = -1;
      }
    }

    if (stage.index === 0) {
      st.barrelSpawnTimer -= dt * speedMult;
      if (st.barrelSpawnTimer <= 0) {
        st.barrelSpawnTimer = Math.max(1.35, 2.55 - (st.level - 1) * 0.2) + Math.random() * 0.6;
        const isBlue = Math.random() < 0.22;
        boss.animState = 'stomp';
        st.girderShake = 0.16;
        this.audio.playBossStomp();

        st.barrels.push({
          id: st.hazardIdCounter++,
          x: boss.x + 24,
          y: boss.y,
          vx: isBlue ? 0 : 96 * speedMult,
          vy: 0,
          blue: isBlue,
          droppingStraight: isBlue,
          onLadder: false,
          rot: 0,
          lastTierY: boss.y
        });
      }
    }

    if (stage.index === 1) {
      st.pieSpawnTimer -= dt * speedMult;
      if (st.pieSpawnTimer <= 0) {
        st.pieSpawnTimer = Math.max(1.4, 2.4 - (st.level - 1) * 0.18);
        const onTopBelt = Math.random() < 0.6;
        const y = onTopBelt ? 298 : 502;
        const fromLeft = Math.random() < 0.5;
        st.pies.push({
          id: st.hazardIdCounter++,
          x: fromLeft ? 28 : PLAYFIELD_W - 28,
          y,
          vx: (fromLeft ? 1 : -1) * 62 * speedMult,
          vy: 0
        });
      }

      st.fireballSpawnTimer -= dt * speedMult;
      if (st.fireballSpawnTimer <= 0 && st.fireballs.length < Math.min(4, 2 + st.level)) {
        st.fireballSpawnTimer = 5.5;
        this._spawnFireball(240, 400);
      }
    }

    if (stage.index === 2) {
      st.springSpawnTimer -= dt * speedMult;
      if (st.springSpawnTimer <= 0) {
        st.springSpawnTimer = Math.max(1.3, 2.2 - (st.level - 1) * 0.16);
        boss.animState = 'stomp';
        st.girderShake = 0.15;
        this.audio.playBossStomp();
        st.springs.push({
          id: st.hazardIdCounter++,
          x: 148,
          y: 156,
          vx: 118 * speedMult,
          vy: -175,
          trail: []
        });
      }
    }

    if (stage.index === 3) {
      st.fireballSpawnTimer -= dt * speedMult;
      if (st.fireballSpawnTimer <= 0 && st.fireballs.length < Math.min(5, 3 + st.level)) {
        st.fireballSpawnTimer = 6.0;
        this._spawnFireball(240, 204);
      }
    }
  }

  _spawnFireball(x, y) {
    this.state.fireballs.push({
      id: this.state.hazardIdCounter++,
      x,
      y,
      dir: Math.random() < 0.5 ? -1 : 1,
      vy: 0,
      onLadder: false,
      currentLadder: null,
      seed: Math.random() * 10
    });
  }

  _updateBarrels(dt, speedMult) {
    const st = this.state;
    const stage = st.stage;
    const maxStage1Fireballs = Math.min(4, 1 + st.level);

    for (let i = st.barrels.length - 1; i >= 0; i--) {
      const b = st.barrels[i];

      if (b.droppingStraight) {
        b.vy += GRAVITY * dt;
        b.y += b.vy * dt;
        b.rot += 6 * dt;

        // Only blue barrels ignite fireballs in the bottom-left oil drum
        if (b.y >= 604) {
          this._spawnParticles(48, 592, 'rgba(255, 140, 40, ALPHA)', 12, 130);
          if (st.fireballs.length < maxStage1Fireballs) {
            this._spawnFireball(56, 604);
          }
          st.barrels.splice(i, 1);
        }
        continue;
      }

      if (b.onLadder) {
        b.y += 110 * speedMult * dt;
        b.rot += 8 * dt;
        if (b.y >= b.targetLadderBottom) {
          b.y = b.targetLadderBottom;
          b.onLadder = false;
          b.vx = -b.prevVx;
        }
        continue;
      }

      const prevY = b.y;
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += (b.vx / 9) * dt;

      const sup = findSupportBelow(b.x, b.y, prevY, stage);
      if (sup && b.vy >= 0) {
        if (b.vy > 120) {
          this.audio.playBarrelBounce();
          this._spawnParticles(b.x, sup.y, 'rgba(251, 191, 36, ALPHA)', 4, 70);
        }
        b.y = sup.y;
        b.vy = 0;

        if (sup.girder) {
          const slope = sup.girder.y2 - sup.girder.y1;
          if (Math.abs(slope) > 2) {
            b.vx = Math.sign(slope) * 105 * speedMult;
          }
        }

        for (const l of stage.ladders) {
          if (!l.broken && Math.abs(b.x - l.x) < 4 && Math.abs(b.y - l.topY) < 6) {
            if (Math.random() < 0.26) {
              b.onLadder = true;
              b.prevVx = b.vx;
              b.vx = 0;
              b.targetLadderBottom = l.bottomY;
              break;
            }
          }
        }
      }

      // Wooden barrels burn out in the oil drum without spawning extra fireballs
      if (b.x <= 56 && b.y >= 596) {
        this._spawnParticles(48, 592, 'rgba(255, 160, 50, ALPHA)', 8, 95);
        st.barrels.splice(i, 1);
        continue;
      }

      if (b.y > 636 || b.x < 10 || b.x > PLAYFIELD_W - 10) {
        st.barrels.splice(i, 1);
      }
    }
  }

  _updatePies(dt, speedMult) {
    const st = this.state;
    const stage = st.stage;

    for (let i = st.pies.length - 1; i >= 0; i--) {
      const p = st.pies[i];
      const prevY = p.y;
      p.vy += GRAVITY * dt;

      const sup = findSupportBelow(p.x, p.y, prevY, stage);
      let beltPush = 0;
      if (sup && sup.girder && sup.girder.type === 'conveyor') {
        beltPush = st.conveyorDir * sup.girder.conveyorDir * 55 * speedMult;
      }

      p.x += (beltPush || p.vx) * dt;
      p.y += p.vy * dt;

      if (sup && p.vy >= 0) {
        p.y = sup.y;
        p.vy = 0;
      }

      if (p.x < 16 || p.x > PLAYFIELD_W - 16 || p.y > 630) {
        st.pies.splice(i, 1);
      }
    }
  }

  _updateSprings(dt, speedMult) {
    const st = this.state;
    for (let i = st.springs.length - 1; i >= 0; i--) {
      const sp = st.springs[i];
      sp.trail.push({ x: sp.x, y: sp.y });
      if (sp.trail.length > 9) sp.trail.shift();

      sp.vy += GRAVITY * 0.92 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;

      if (sp.x <= 390 && sp.y >= 156 && sp.vy > 0) {
        sp.y = 156;
        sp.vy = -195;
        this.audio.playSpringBoing();
        this._spawnParticles(sp.x, 156, 'rgba(232, 121, 249, ALPHA)', 7, 110);
      }

      if (sp.y > 636) {
        st.springs.splice(i, 1);
      }
    }
  }

  _updateFireballs(dt, speedMult) {
    const st = this.state;
    const stage = st.stage;
    const speed = 64 * speedMult;

    for (let i = st.fireballs.length - 1; i >= 0; i--) {
      const fb = st.fireballs[i];

      if (fb.onLadder && fb.currentLadder) {
        const l = fb.currentLadder;
        fb.y += fb.climbDir * speed * 0.85 * dt;
        if (fb.climbDir < 0 && fb.y <= l.topY) {
          fb.y = l.topY;
          fb.onLadder = false;
          fb.dir = Math.random() < 0.5 ? -1 : 1;
        } else if (fb.climbDir > 0 && fb.y >= l.bottomY) {
          fb.y = l.bottomY;
          fb.onLadder = false;
          fb.dir = Math.random() < 0.5 ? -1 : 1;
        }
        continue;
      }

      const nextX = fb.x + fb.dir * speed * dt;
      const sup = findSupportBelow(nextX, fb.y, fb.y - 6, stage);

      if (!sup || nextX < 24 || nextX > PLAYFIELD_W - 24) {
        fb.dir *= -1;
      } else {
        fb.x = nextX;
        fb.y = sup.y;

        for (const l of stage.ladders) {
          if (l.broken || (l.retractable && l.retractProgress < 0.8)) continue;
          if (Math.abs(fb.x - l.x) < 3) {
            if (Math.abs(fb.y - l.bottomY) < 4 && Math.random() < 0.14) {
              fb.onLadder = true;
              fb.currentLadder = l;
              fb.climbDir = -1;
              break;
            } else if (Math.abs(fb.y - l.topY) < 4 && Math.random() < 0.06) {
              fb.onLadder = true;
              fb.currentLadder = l;
              fb.climbDir = 1;
              break;
            }
          }
        }
      }
    }
  }

  _checkPickupsAndRivets() {
    const st = this.state;
    const p = st.player;

    for (const h of st.stage.hammers) {
      if (!h.taken && boxOverlap(p.x, p.y - 14, 18, 22, h.x, h.y, 18, 18)) {
        h.taken = true;
        p.hammerTimer = 8.5;
        this.audio.playBonusPickup();
      }
    }

    for (const b of st.stage.bonuses) {
      if (!b.taken && boxOverlap(p.x, p.y - 14, 18, 22, b.x, b.y, 16, 16)) {
        b.taken = true;
        this._addScore(b.pts, b.x, b.y);
        this.audio.playBonusPickup();
        this._spawnParticles(b.x, b.y, 'rgba(244, 114, 182, ALPHA)', 10, 95);
      }
    }

    if (st.stage.rivets.length > 0) {
      let remaining = 0;
      for (const r of st.stage.rivets) {
        if (r.removed) continue;
        remaining++;
        if (Math.abs(p.x - r.x) < 16 && Math.abs(p.y - r.y) < 28) {
          r.removed = true;
          remaining--;
          this._addScore(100, r.x, r.y);
          this.audio.playRivetPop();
          this._spawnParticles(r.x, r.y, 'rgba(251, 191, 36, ALPHA)', 14, 140);
          this._triggerShake(2.2, 0.12);
        }
      }

      if (remaining === 0 && st.mode === 'playing') {
        this._addScore(st.bonusTimer, PLAYFIELD_W / 2, 180, true);
        st.mode = 'victory';
        st.clearTimer = 2.6;
        this._triggerShake(4.5, 0.45);
        this.audio.playVictory();
      }
    }
  }

  _checkJumpOverHazards() {
    const st = this.state;
    const p = st.player;
    if (p.onGround || p.onLadder) return;

    const allHazards = [...st.barrels, ...st.pies, ...st.springs, ...st.fireballs];
    for (const hz of allHazards) {
      if (p.jumpedHazards.has(hz.id)) continue;
      const dx = Math.abs(p.x - hz.x);
      const dy = hz.y - p.y;
      if (dx < 16 && dy > 8 && dy < 66) {
        p.jumpedHazards.add(hz.id);
        this._addScore(100, p.x, p.y - 24);
        this.audio.playJumpOverScore();
      }
    }
  }

  _checkCollisions() {
    const st = this.state;
    const p = st.player;
    const px = p.x;
    const py = p.y - 12;
    const pw = 14;
    const ph = 20;

    const hammerActive = p.hammerTimer > 0;
    const hx = p.x + p.facing * 18;
    const hy = p.y - 16;

    const checkList = (arr, w, h, color) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const hz = arr[i];
        if (hammerActive && boxOverlap(hx, hy, 26, 26, hz.x, hz.y - 8, w + 8, h + 8)) {
          arr.splice(i, 1);
          this._addScore(500, hz.x, hz.y);
          this.audio.playHammerSmash();
          this._spawnParticles(hz.x, hz.y - 8, color, 14, 150);
          st.hitStopFrames = 3;
          this._triggerShake(3.0, 0.14);
          continue;
        }
        if (boxOverlap(px, py, pw, ph, hz.x, hz.y - 8, w, h)) {
          this._killPlayer();
          return true;
        }
      }
      return false;
    };

    if (checkList(st.barrels, 13, 13, 'rgba(217, 119, 6, ALPHA)')) return;
    if (checkList(st.pies, 14, 9, 'rgba(251, 191, 36, ALPHA)')) return;
    if (checkList(st.springs, 11, 12, 'rgba(232, 121, 249, ALPHA)')) return;
    if (checkList(st.fireballs, 12, 12, 'rgba(6, 182, 212, ALPHA)')) return;

    if (boxOverlap(px, py, pw, ph, st.boss.x, st.boss.y - 22, 30, 34)) {
      this._killPlayer();
    }
  }

  _checkGoal() {
    const st = this.state;
    const p = st.player;
    const pauline = st.stage.pauline;

    if (st.stageIndex < 3) {
      if (Math.abs(p.x - pauline.x) < 28 && Math.abs(p.y - pauline.y) < 18) {
        this._addScore(st.bonusTimer, pauline.x, pauline.y - 20, true);
        st.mode = 'stageClear';
        st.clearTimer = 1.8;
        this.audio.playStageClear();
      }
    }
  }

  _killPlayer() {
    const st = this.state;
    if (st.player.dead) return;
    st.player.dead = true;
    st.mode = 'dying';
    st.deathTimer = 0;
    this._triggerShake(3.5, 0.25);
    this.audio.playDeath();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new DonkeyKongGame();
});
