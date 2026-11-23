// Procedural Web Audio API Sound Engine (zero external audio files)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;

    this.bassStep = 0;
    this.bassTimer = 0;
    this.lastStepSound = 0;
    this.lastClimbSound = 0;
    this.lastHumSound = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.35;
    this.master.connect(this.ctx.destination);

    // Pre-generate white noise buffer for fire crackle, splinters, and conveyor hum
    const length = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  _tone(freqStart, freqEnd, duration, type = 'square', gainVal = 0.2, delay = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  _noise(duration, filterFreq, filterType = 'bandpass', gainVal = 0.15, delay = 0) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + duration);
  }

  playFootstep() {
    const now = performance.now();
    if (now - this.lastStepSound < 115) return;
    this.lastStepSound = now;
    this._tone(160, 95, 0.045, 'triangle', 0.12);
    this._noise(0.03, 950, 'highpass', 0.05);
  }

  playClimb() {
    const now = performance.now();
    if (now - this.lastClimbSound < 130) return;
    this.lastClimbSound = now;
    this._tone(280, 390, 0.05, 'square', 0.08);
  }

  playJump() {
    this._tone(210, 560, 0.16, 'square', 0.14);
    this._tone(320, 680, 0.12, 'triangle', 0.08, 0.03);
  }

  playLand() {
    this._tone(110, 52, 0.07, 'triangle', 0.16);
    this._noise(0.04, 420, 'lowpass', 0.08);
  }

  playBarrelBounce() {
    this._tone(145, 70, 0.08, 'triangle', 0.14);
    this._tone(95, 55, 0.06, 'sine', 0.1, 0.01);
  }

  playHammerSmash() {
    this._tone(520, 110, 0.14, 'sawtooth', 0.25);
    this._tone(880, 240, 0.1, 'square', 0.16);
    this._noise(0.14, 1400, 'bandpass', 0.22);
  }

  playSpringBoing() {
    this._tone(260, 740, 0.14, 'sine', 0.16);
    this._tone(400, 920, 0.11, 'triangle', 0.1, 0.04);
  }

  playRivetPop() {
    this._tone(780, 290, 0.12, 'square', 0.18);
    this._tone(1100, 1420, 0.08, 'triangle', 0.14, 0.04);
    this._noise(0.08, 2200, 'highpass', 0.12);
  }

  playBonusPickup() {
    this._tone(523, 659, 0.08, 'square', 0.14, 0);
    this._tone(659, 784, 0.08, 'square', 0.14, 0.07);
    this._tone(784, 1046, 0.16, 'square', 0.16, 0.14);
  }

  playJumpOverScore() {
    this._tone(660, 880, 0.08, 'square', 0.11);
    this._tone(880, 1174, 0.1, 'square', 0.11, 0.06);
  }

  playBossStomp() {
    this._tone(90, 38, 0.2, 'sawtooth', 0.22);
    this._noise(0.16, 260, 'lowpass', 0.18);
  }

  playDeath() {
    const notes = [440, 392, 349, 311, 261, 196];
    notes.forEach((n, idx) => {
      this._tone(n, n * 0.88, 0.11, 'sawtooth', 0.18, idx * 0.09);
    });
  }

  playStageClear() {
    const melody = [523, 659, 784, 1046, 784, 1046];
    const times = [0, 0.09, 0.18, 0.27, 0.4, 0.5];
    melody.forEach((n, idx) => {
      this._tone(n, n, idx === melody.length - 1 ? 0.35 : 0.09, 'square', 0.16, times[idx]);
    });
  }

  playVictory() {
    const fanfare = [523, 523, 523, 659, 784, 659, 784, 1046];
    const times = [0, 0.1, 0.2, 0.3, 0.42, 0.56, 0.68, 0.82];
    fanfare.forEach((n, idx) => {
      this._tone(n, n, idx === fanfare.length - 1 ? 0.45 : 0.1, 'square', 0.18, times[idx]);
    });
  }

  playStageAmbient(stageIndex) {
    const now = performance.now();
    if (now - this.lastHumSound < 650) return;
    this.lastHumSound = now;

    if (stageIndex === 1) {
      // Pie Factory conveyor hum
      this._tone(68, 64, 0.22, 'sawtooth', 0.03);
    } else if (stageIndex === 2) {
      // Elevators motor whir
      this._tone(110, 122, 0.25, 'triangle', 0.028);
    }
    // Subtle fire crackle on stages with oil drums
    if (stageIndex === 0 || stageIndex === 1) {
      this._noise(0.06, 2600, 'highpass', 0.018);
    }
  }

  updateMusic(dt, isPlaying, hammerActive) {
    if (!this.ctx || this.muted || !isPlaying) return;
    const interval = hammerActive ? 0.115 : 0.22;
    this.bassTimer += dt;
    if (this.bassTimer >= interval) {
      this.bassTimer -= interval;
      const normalBass = [110, 110, 130.8, 146.8, 110, 110, 164.8, 146.8];
      const hammerBass = [220, 261.6, 293.6, 329.6, 220, 293.6, 329.6, 392.0];
      const seq = hammerActive ? hammerBass : normalBass;
      const freq = seq[this.bassStep % seq.length];
      this.bassStep++;
      this._tone(freq, freq * 0.96, interval * 0.72, hammerActive ? 'square' : 'triangle', hammerActive ? 0.11 : 0.08);
    }
  }
}
