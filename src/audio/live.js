// SPDX-License-Identifier: AGPL-3.0-only
// Continuous synthesis for the explore workbench. All amplitudes are digital.
//
// This module has no imports, no DOM and no AudioContext, so the same class
// runs inside an AudioWorklet, in the ScriptProcessor fallback, and in Node
// tests. Every parameter that can change while sound plays is smoothed with a
// one-pole glide; switches (routing, source, polarity…) are modelled as mixes
// so that changing one is a short crossfade rather than a click.

const TAU = Math.PI * 2;
const TONE_PEAK = 0.65;
const CEILING = 0.95;
const EPS = 1e-4;
const GLIDE_SECONDS = 0.012;

export const LIVE_IDS = ["phase", "beats", "harmonics", "amplitude", "spatial", "masking", "noise", "shepard", "frequency", "pitch", "gap"];

// Smoothed parameter slots.
const F = 0, TH = 1, SIGN = 2, DELAY = 3, MONO = 4, W0 = 5, W1 = 6, W2 = 7, W3 = 8, DIFF = 9, SEP = 10,
  H0 = 11, /* …H5 = 16 */ GAIN = 17, PANL = 18, PANR = 19, TONE = 20, EARL = 21, EARR = 22, GAP = 23, GATE = 24, SLOTS = 25;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function number(value, fallback, min, max) {
  const parsed = value === undefined || value === null ? fallback : Number(value);
  return clamp(Number.isFinite(parsed) ? parsed : fallback, min, max);
}
function seeded(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class LiveSynth {
  constructor(sampleRate = 48000, seed = 12345) {
    this.sampleRate = Math.round(number(sampleRate, 48000, 8000, 192000));
    this.nyquist = Math.min(20000, this.sampleRate * 0.45);
    this.random = seeded(seed);
    this.id = null;
    this.pending = null;
    this.stopping = false;
    this.target = new Float64Array(SLOTS);
    this.value = new Float64Array(SLOTS);
    this.k = 1 - Math.exp(-1 / (GLIDE_SECONDS * this.sampleRate));
    this.phaseA = 0;
    this.phaseB = 0;
    // Noise sources.
    this.pinkRows = new Float64Array(Math.ceil(Math.log2(this.sampleRate / 20)));
    for (let i = 0; i < this.pinkRows.length; i++) this.pinkRows[i] = this.random() * 2 - 1;
    this.pinkSum = this.pinkRows.reduce((sum, value) => sum + value, 0);
    this.pinkCounter = 0;
    this.brown = 0;
    // Uniform white has RMS 1/√3; the pink and brown figures follow from their recurrences.
    this.whiteRms = 1 / Math.sqrt(3);
    this.pinkRms = 1 / Math.sqrt(3 * (this.pinkRows.length + 1));
    this.brownRms = 3.5 * (0.02 / 1.02) * this.whiteRms / Math.sqrt(1 - (1 / 1.02) ** 2);
    // A short delay line for interaural delays applied to noise.
    this.ring = new Float32Array(8192);
    this.ringAt = 0;
    // Band-pass state for the masking noise.
    this.bq = {b0: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0, scale: 1, hz: 0};
    // Cyclic experiments.
    this.direction = 1;
    this.pitchClass = 0;
    this.stepCount = 0;
    this.local = 0;
    this.cyclePos = 0;
  }

  /** True once a requested stop has faded to silence. */
  get done() { return this.stopping && this.value[GATE] < EPS; }

  /** Set the experiment and its parameters. Safe to call at any time while sound plays. */
  set(id, params = {}) {
    if (!LIVE_IDS.includes(id)) throw new RangeError(`Unknown experiment: ${id}`);
    params = params && typeof params === "object" ? params : {};
    if (this.stopping) return;
    if (this.id && id !== this.id) {
      // Fade out, switch, fade in: handled at a block boundary in process().
      this.pending = {id, params};
      this.target[GATE] = 0;
      return;
    }
    const first = this.id === null;
    this.id = id;
    this.pending = null;
    this._targets(id, params);
    this.target[GATE] = 1;
    if (first) this._snap();
  }

  stop() {
    this.stopping = true;
    this.pending = null;
    this.target[GATE] = 0;
  }

  _snap() {
    const gate = this.value[GATE];
    this.value.set(this.target);
    this.value[GATE] = gate;
  }

  _targets(id, p) {
    const t = this.target;
    const hz = fallback => number(p.frequency, fallback, 20, this.nyquist);
    t[SIGN] = 1; t[MONO] = 0; t[TH] = 0; t[DELAY] = 0;
    if (id === "phase") {
      const source = ["sine", "complex", "noise"].includes(p.source) ? p.source : "sine";
      const requested = ["phase", "polarity", "delay"].includes(p.mode) ? p.mode : "phase";
      const mode = source === "sine" || requested !== "phase" ? requested : "polarity";
      const degrees = number(p.phase, 180, 0, 360);
      t[F] = hz(500);
      t[TH] = mode === "phase" ? degrees * Math.PI / 180 : 0;
      t[SIGN] = mode === "polarity" && degrees >= 90 && degrees < 270 ? -1 : 1;
      t[DELAY] = mode === "delay" ? number(p.delayMs, 0.5, -10, 10) / 1000 : 0;
      t[MONO] = p.routing === "mono" ? 1 : 0;
      t[W0] = source === "sine" ? 1 : 0; t[W1] = source === "complex" ? 1 : 0; t[W2] = source === "noise" ? 1 : 0;
    } else if (id === "beats") {
      t[F] = hz(440);
      t[DIFF] = number(p.difference, 4, 0, 40);
      t[SEP] = p.routing === "separate" ? 1 : 0;
    } else if (id === "harmonics") {
      t[F] = number(p.fundamental, 200, 20, this.nyquist);
      const requested = Array.isArray(p.harmonics) ? p.harmonics : [1, 0.65, 0.45, 0.3, 0.22, 0.16];
      for (let h = 0; h < 6; h++) t[H0 + h] = number(requested[h], 0, 0, 1);
    } else if (id === "amplitude") {
      const shape = ["sine", "triangle", "square", "sawtooth"].includes(p.shape) ? p.shape : "sine";
      t[F] = hz(220);
      t[GAIN] = 10 ** (number(p.gainDb, -6, -40, 0) / 20);
      t[W0] = shape === "sine" ? 1 : 0; t[W1] = shape === "triangle" ? 1 : 0; t[W2] = shape === "square" ? 1 : 0; t[W3] = shape === "sawtooth" ? 1 : 0;
    } else if (id === "spatial") {
      const pan = number(p.pan, 0, -1, 1);
      t[F] = hz(500);
      t[DELAY] = number(p.delayMs, 0, -1, 1) / 1000;
      t[PANL] = Math.cos((pan + 1) * Math.PI / 4);
      t[PANR] = Math.sin((pan + 1) * Math.PI / 4);
      t[W0] = p.source === "sine" ? 0 : 1; t[W1] = p.source === "sine" ? 1 : 0;
    } else if (id === "masking") {
      t[F] = hz(500);
      this._maskingFilter(t[F]);
      // Tone RMS inside its (tapered) pulse equals noise RMS × the stated ratio.
      const pulseSeconds = 0.375, ramp = 0.02;
      const envelopePower = 1 - 2 * ramp * (5 / 8) / pulseSeconds;
      t[TONE] = 0.07 * Math.SQRT2 * 10 ** (number(p.snr, -12, -40, 12) / 20) / Math.sqrt(envelopePower);
      t[SIGN] = p.invertTone ? -1 : 1;
      t[MONO] = p.routing === "mono" ? 1 : 0;
    } else if (id === "noise") {
      const color = ["white", "pink", "brown"].includes(p.color) ? p.color : "pink";
      t[W0] = color === "white" ? 1 : 0; t[W1] = color === "pink" ? 1 : 0; t[W2] = color === "brown" ? 1 : 0;
    } else if (id === "shepard") {
      this.direction = p.direction === "down" ? -1 : 1;
    } else if (id === "gap") {
      t[GAP] = number(p.gapMs, 16, 0, 250) / 1000;
    } else {
      t[F] = hz(id === "pitch" ? 440 : 1000);
      t[EARL] = p.ear === "right" ? 0 : 1;
      t[EARR] = p.ear === "left" ? 0 : 1;
    }
  }

  /** RBJ band-pass (constant 0 dB peak, Q 2.5), with its output level measured once per centre frequency. */
  _maskingFilter(hz) {
    const bq = this.bq;
    if (bq.hz === hz) return;
    const omega = TAU * hz / this.sampleRate, alpha = Math.sin(omega) / (2 * 2.5), a0 = 1 + alpha;
    Object.assign(bq, {hz, b0: alpha / a0, b2: -alpha / a0, a1: -2 * Math.cos(omega) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0});
    const probe = seeded(977);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, power = 0;
    const count = Math.round(this.sampleRate / 2);
    for (let i = 0; i < count; i++) {
      const x = probe() * 2 - 1;
      const y = bq.b0 * x + bq.b2 * x2 - bq.a1 * y1 - bq.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      power += y * y;
    }
    bq.scale = 0.07 / (Math.sqrt(power / count) || 1);
  }

  _pink(white) {
    const rows = this.pinkRows;
    this.pinkCounter = (this.pinkCounter + 1) >>> 0;
    let row = 0, bits = this.pinkCounter;
    while ((bits & 1) === 0 && row < rows.length) { row++; bits >>>= 1; }
    if (row < rows.length) {
      const next = this.random() * 2 - 1;
      this.pinkSum += next - rows[row];
      rows[row] = next;
    }
    return (this.pinkSum + white) / (rows.length + 1);
  }

  _tap(delaySamples) {
    const position = this.ringAt - 2 - delaySamples;
    const index = Math.floor(position), fraction = position - index, mask = this.ring.length - 1;
    return this.ring[index & mask] * (1 - fraction) + this.ring[(index + 1) & mask] * fraction;
  }

  /** Where a cyclic experiment is in its loop, for the display. cycle is 0…1, or -1 when there is no loop. */
  info() {
    const sr = this.sampleRate;
    if (this.id === "shepard") {
      const step = Math.round(0.45 * sr);
      return {cycle: ((this.stepCount % 12) + this.local / step) / 12, period: 5.4, pitchClass: this.pitchClass};
    }
    if (this.id === "masking") return {cycle: this.cyclePos / (2 * sr), period: 2, pitchClass: 0};
    if (this.id === "gap") return {cycle: this.cyclePos / (2 * sr), period: 2, pitchClass: 0};
    return {cycle: -1, period: 0, pitchClass: 0};
  }

  /** Fill two equal-length channel buffers with the next samples. */
  process(left, right) {
    const n = left.length;
    if (this.pending && this.value[GATE] < 1e-3) {
      const {id, params} = this.pending;
      this.pending = null;
      this.id = id;
      this.phaseA = this.phaseB = 0;
      this.local = this.cyclePos = this.stepCount = this.pitchClass = 0;
      this._targets(id, params);
      this._snap();
      this.target[GATE] = 1;
    }
    if (!this.id) { left.fill(0); right.fill(0); return; }
    const v = this.value, t = this.target, k = this.k, sr = this.sampleRate, nyq = this.nyquist, id = this.id;
    const ring = this.ring, mask = ring.length - 1, bq = this.bq;
    const stepLength = Math.round(0.45 * sr), slot = Math.round(0.5 * sr), gapPeriod = Math.round(sr * 2 / 3);
    const rampSamples = Math.round(0.02 * sr), stepRamp = Math.round(0.04 * sr), edge = Math.max(1, Math.round(0.002 * sr));
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < SLOTS; s++) v[s] += (t[s] - v[s]) * k;
      const f = v[F];
      let l = 0, r = 0;
      if (id === "phase") {
        this.phaseA += TAU * f / sr; if (this.phaseA > TAU) this.phaseA -= TAU;
        const a = this.phaseA, lag = TAU * f * v[DELAY];
        if (v[W0] > EPS) { l += v[W0] * TONE_PEAK * Math.sin(a); r += v[W0] * TONE_PEAK * Math.sin(a + v[TH] - lag); }
        if (v[W1] > EPS) {
          let cl = 0, cr = 0;
          for (let h = 1; h <= 4; h++) if (h * f < nyq) { cl += Math.sin(h * a) / (2 ** (h - 1)); cr += Math.sin(h * (a - lag)) / (2 ** (h - 1)); }
          l += v[W1] * 0.34 * cl; r += v[W1] * 0.34 * cr;
        }
        ring[this.ringAt & mask] = (this.random() * 2 - 1) * 0.18 / this.whiteRms; this.ringAt++;
        if (v[W2] > EPS) { l += v[W2] * this._tap(Math.max(0, -v[DELAY]) * sr); r += v[W2] * this._tap(Math.max(0, v[DELAY]) * sr); }
        r *= v[SIGN];
      } else if (id === "beats") {
        this.phaseA += TAU * f / sr; if (this.phaseA > TAU) this.phaseA -= TAU;
        this.phaseB += TAU * Math.min(f + v[DIFF], nyq) / sr; if (this.phaseB > TAU) this.phaseB -= TAU;
        const a = 0.3 * Math.sin(this.phaseA), b = 0.3 * Math.sin(this.phaseB), together = 1 - v[SEP];
        l = a + together * b; r = b + together * a;
      } else if (id === "harmonics") {
        this.phaseA += TAU * f / sr; if (this.phaseA > TAU) this.phaseA -= TAU;
        let sum = 0;
        for (let h = 0; h < 6; h++) if (v[H0 + h] > EPS && (h + 1) * f < nyq) sum += v[H0 + h] * Math.sin((h + 1) * this.phaseA);
        l = r = sum * 0.14;
      } else if (id === "amplitude") {
        this.phaseA += TAU * f / sr; if (this.phaseA > TAU) this.phaseA -= TAU;
        const a = this.phaseA, base = Math.sin(a);
        let sum = v[W0] * base;
        if (v[W1] > EPS || v[W2] > EPS || v[W3] > EPS) {
          // sin(h·a) by recurrence: sin((h+1)a) = 2cos(a)·sin(ha) − sin((h−1)a).
          const twoCos = 2 * Math.cos(a), top = Math.min(48, Math.floor(nyq / f));
          let previous = 0, current = base;
          for (let h = 1; h <= top; h++) {
            const odd = h % 2 === 1;
            let c = v[W3] * (odd ? 1 : -1) * 2 / (Math.PI * h);
            if (odd) c += v[W2] * 4 / (Math.PI * h) + v[W1] * (h % 4 === 1 ? 1 : -1) * 8 / (Math.PI * Math.PI * h * h);
            sum += c * current;
            const next = twoCos * current - previous; previous = current; current = next;
          }
        }
        l = r = sum * 0.52 * v[GAIN];
      } else if (id === "spatial") {
        this.phaseA += TAU * f / sr; if (this.phaseA > TAU) this.phaseA -= TAU;
        ring[this.ringAt & mask] = this._pink(this.random() * 2 - 1) * 0.15 / this.pinkRms; this.ringAt++;
        if (v[W0] > EPS) { l += v[W0] * this._tap(Math.max(0, -v[DELAY]) * sr); r += v[W0] * this._tap(Math.max(0, v[DELAY]) * sr); }
        if (v[W1] > EPS) { l += v[W1] * TONE_PEAK * Math.sin(this.phaseA); r += v[W1] * TONE_PEAK * Math.sin(this.phaseA - TAU * f * v[DELAY]); }
        l *= v[PANL]; r *= v[PANR];
      } else if (id === "masking") {
        this.phaseA += TAU * f / sr; if (this.phaseA > TAU) this.phaseA -= TAU;
        const x = this.random() * 2 - 1;
        const y = bq.b0 * x + bq.b2 * bq.x2 - bq.a1 * bq.y1 - bq.a2 * bq.y2;
        bq.x2 = bq.x1; bq.x1 = x; bq.y2 = bq.y1; bq.y1 = y;
        const noise = y * bq.scale;
        // Four pulses per two-second loop: each fills the middle 75% of its half-second slot.
        const inSlot = this.cyclePos % slot, start = Math.round(slot * 0.125), length = Math.round(slot * 0.75);
        let envelope = 0;
        if (inSlot >= start && inSlot < start + length) {
          const distance = Math.min(inSlot - start, start + length - 1 - inSlot);
          envelope = distance >= rampSamples ? 1 : Math.sin(Math.PI * distance / (2 * rampSamples)) ** 2;
        }
        const tone = v[TONE] * envelope * Math.sin(this.phaseA);
        l = noise + tone; r = noise + v[SIGN] * tone;
        if (++this.cyclePos >= 4 * slot) this.cyclePos = 0;
      } else if (id === "noise") {
        const white = this.random() * 2 - 1;
        const pink = this._pink(white);
        this.brown = (this.brown + white * 0.02) / 1.02;
        l = r = 0.18 * (v[W0] * white / this.whiteRms + v[W1] * pink / this.pinkRms + v[W2] * this.brown * 3.5 / this.brownRms);
      } else if (id === "shepard") {
        const distance = Math.min(this.local, stepLength - 1 - this.local);
        const envelope = distance >= stepRamp ? 1 : Math.sin(Math.PI * distance / (2 * stepRamp)) ** 2;
        let sum = 0;
        for (let octave = -2; octave <= 5; octave++) {
          const hz = 110 * 2 ** (octave + this.pitchClass / 12);
          if (hz < 30 || hz >= Math.min(12000, nyq)) continue;
          const weight = Math.exp(-0.5 * ((Math.log2(hz) - Math.log2(700)) / 1.15) ** 2);
          sum += weight * Math.sin(TAU * hz * this.local / sr);
        }
        l = r = sum * envelope * 0.19;
        if (++this.local >= stepLength) { this.local = 0; this.stepCount++; this.pitchClass = (this.pitchClass + this.direction + 12) % 12; }
      } else if (id === "gap") {
        // One gap every two thirds of a second, centred on the loop boundary.
        const inPeriod = this.cyclePos % gapPeriod, distance = Math.min(inPeriod, gapPeriod - inPeriod), half = v[GAP] * sr / 2;
        let envelope = 1;
        if (half >= 0.5) {
          if (distance < half) envelope = 0;
          else if (distance - half < edge) envelope = Math.sin(Math.PI * (distance - half) / (2 * edge)) ** 2;
        }
        l = r = (this.random() * 2 - 1) * 0.18 / this.whiteRms * envelope;
        if (++this.cyclePos >= 3 * gapPeriod) this.cyclePos = 0;
      } else {
        this.phaseA += TAU * f / sr; if (this.phaseA > TAU) this.phaseA -= TAU;
        const tone = TONE_PEAK * Math.sin(this.phaseA);
        l = tone * v[EARL]; r = tone * v[EARR];
      }
      if (v[MONO] > EPS) { const mix = (l + r) / 2; l += (mix - l) * v[MONO]; r += (mix - r) * v[MONO]; }
      left[i] = clamp(l * v[GATE], -CEILING, CEILING);
      right[i] = clamp(r * v[GATE], -CEILING, CEILING);
    }
  }
}
