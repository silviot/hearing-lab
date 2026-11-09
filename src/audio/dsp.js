// SPDX-License-Identifier: AGPL-3.0-only
// All amplitudes in this module are digital values, never acoustic dB SPL.

const TAU = Math.PI * 2;
const MAX_DURATION = 8;
const TONE_PEAK = 0.65;
const DEFAULT_HARMONICS = [1, 0.65, 0.45, 0.3, 0.22, 0.16];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const dbToGain = (db) => 10 ** (db / 20);
export const gainToDb = (gain) => gain > 0 ? 20 * Math.log10(gain) : -Infinity;

function number(value, fallback, min, max) {
  const parsed = value === undefined || value === null ? fallback : Number(value);
  return clamp(Number.isFinite(parsed) ? parsed : fallback, min, max);
}

export function createSeededRandom(seed = 12345) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function measureRms(samples) {
  if (!samples.length) return 0;
  let squares = 0;
  for (const value of samples) squares += value * value;
  return Math.sqrt(squares / samples.length);
}

export function measurePeak(samples) {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  return peak;
}

/** Smooth, synchronized edges. The first and last samples are exactly zero. */
export function envelopeAt(index, length, sampleRate, rampSeconds = 0.02) {
  const ramp = Math.max(1, Math.min(Math.round(rampSeconds * sampleRate), (length - 1) / 2));
  const distance = Math.min(index, length - 1 - index);
  return distance >= ramp ? 1 : Math.sin(Math.PI * Math.max(0, distance) / (2 * ramp)) ** 2;
}

function frequency(value, fallback, sampleRate) {
  return number(value, fallback, 20, Math.min(20000, sampleRate * 0.45));
}

function makeNoise(length, random, color = "white", sampleRate = 48000) {
  const samples = new Float32Array(length);
  let brown = 0;
  // Original implementation of octave-rate random sample-and-hold synthesis.
  // Different rows change every 2, 4, 8, ... samples; an independent white
  // component fills the highest octave. This approximates pink noise without
  // borrowing a filter implementation or a third-party coefficient table.
  const rowCount = Math.ceil(Math.log2(sampleRate / 20));
  const rows = color === "pink" ? Array.from({length: rowCount}, () => random() * 2 - 1) : [];
  let rowSum = rows.reduce((sum, value) => sum + value, 0);
  let counter = 0;
  let total = 0;
  for (let i = 0; i < length; i++) {
    const white = random() * 2 - 1;
    let value = white;
    if (color === "pink") {
      counter++;
      let changingRow = 0;
      let bits = counter;
      while ((bits & 1) === 0 && changingRow < rowCount) { changingRow++; bits >>>= 1; }
      if (changingRow < rowCount) {
        const next = random() * 2 - 1;
        rowSum += next - rows[changingRow];
        rows[changingRow] = next;
      }
      value = (rowSum + white) / (rowCount + 1);
    } else if (color === "brown") {
      brown = (brown + white * 0.02) / 1.02;
      value = brown * 3.5;
    }
    samples[i] = value;
    total += value;
  }
  // Very slow held values can leave a finite excerpt with a nonzero mean.
  // Remove that DC term before RMS preparation; it is not an audible component.
  if (color === "pink" && length) {
    const mean = total / length;
    for (let i = 0; i < length; i++) samples[i] -= mean;
  }
  return samples;
}

/** Normalize a generated noise source only, before comparisons share it. */
function prepareNoise(samples, targetRms = 0.16, maxPeak = 0.65) {
  const scale = Math.min(targetRms / (measureRms(samples) || 1), maxPeak / (measurePeak(samples) || 1));
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}

function route(left, right, routing) {
  for (let i = 0; i < left.length; i++) {
    if (routing === "mono") {
      const sum = (left[i] + right[i]) / 2;
      left[i] = sum;
      right[i] = sum;
    } else if (routing === "left") {
      right[i] = 0;
    } else if (routing === "right") {
      left[i] = 0;
    }
  }
}

function phaseExperiment(left, right, sampleRate, params, random, meta) {
  const source = ["sine", "complex", "noise"].includes(params.source) ? params.source : "sine";
  const requestedMode = ["phase", "polarity", "delay"].includes(params.mode) ? params.mode : "phase";
  const mode = source === "sine" || requestedMode !== "phase" ? requestedMode : "polarity";
  const hz = frequency(params.frequency, 500, sampleRate);
  const degrees = number(params.phase, 180, 0, 360);
  const radians = degrees * Math.PI / 180;
  const delayMs = number(params.delayMs, 0.5, -10, 10);
  const inverted = params.inverted === undefined ? (degrees >= 90 && degrees < 270) : Boolean(params.inverted);
  const sign = inverted ? -1 : 1;
  const noise = source === "noise" ? prepareNoise(makeNoise(left.length + Math.ceil(sampleRate * 0.02), random), 0.18, 0.65) : null;
  const padding = Math.ceil(sampleRate * 0.01);
  function at(t, offset = 0) {
    if (source === "noise") {
      const position = t * sampleRate + padding;
      const index = Math.floor(position);
      const fraction = position - index;
      return (noise[index] || 0) * (1 - fraction) + (noise[index + 1] || 0) * fraction;
    }
    if (source === "complex") {
      let value = 0;
      for (let h = 1; h <= 4; h++) {
        if (h * hz < sampleRate * 0.45) value += Math.sin(TAU * hz * h * t + offset) / (2 ** (h - 1));
      }
      return value * 0.34;
    }
    return Math.sin(TAU * hz * t + offset) * TONE_PEAK;
  }
  for (let i = 0; i < left.length; i++) {
    const t = i / sampleRate;
    left[i] = at(t);
    if (mode === "polarity") right[i] = sign * left[i];
    else if (mode === "delay") right[i] = at(t - delayMs / 1000);
    else if (degrees === 180) right[i] = -left[i];
    else if (degrees === 0 || degrees === 360) right[i] = left[i];
    else right[i] = at(t, radians);
  }
  route(left, right, params.routing);
  Object.assign(meta, {frequencyHz: hz, phaseDegrees: degrees, effectiveMode: mode, source, delayMs, inverted, routing: params.routing || "stereo"});
  if (source !== "sine" && requestedMode === "phase") meta.note = "For a complex sound, this control uses exact polarity inversion. Arbitrary phase rotation is offered for sine waves.";
}

function beatsExperiment(left, right, sampleRate, params, meta) {
  const hz = frequency(params.frequency, 440, sampleRate);
  const difference = number(params.difference, 4, 0, 40);
  const second = Math.min(hz + difference, sampleRate * 0.45);
  const separate = params.routing === "separate";
  for (let i = 0; i < left.length; i++) {
    const firstTone = 0.3 * Math.sin(TAU * hz * i / sampleRate);
    const secondTone = 0.3 * Math.sin(TAU * second * i / sampleRate);
    left[i] = separate ? firstTone : firstTone + secondTone;
    right[i] = separate ? secondTone : left[i];
  }
  Object.assign(meta, {frequencyHz: hz, secondFrequencyHz: second, differenceHz: second - hz, routing: separate ? "separate" : "together", componentPeak: 0.3, note: "Each component keeps the same amplitude. Combining two components in one ear changes total level."});
}

function harmonicsExperiment(left, right, sampleRate, params, meta) {
  const fundamental = frequency(params.fundamental, 200, sampleRate);
  const requested = Array.isArray(params.harmonics) ? params.harmonics.slice(0, 6) : DEFAULT_HARMONICS;
  const amplitudes = Array.from({length: 6}, (_, i) => number(requested[i], 0, 0, 1));
  const active = amplitudes.map((amplitude, i) => (i + 1) * fundamental < sampleRate * 0.45 ? amplitude : 0);
  for (let i = 0; i < left.length; i++) {
    let value = 0;
    for (let h = 0; h < active.length; h++) value += active[h] * Math.sin(TAU * fundamental * (h + 1) * i / sampleRate);
    left[i] = right[i] = value * 0.14;
  }
  Object.assign(meta, {fundamentalHz: fundamental, harmonicAmplitudes: active, componentScale: 0.14, note: "All partials share a fixed gain. Removing the fundamental does not increase the remaining partials."});
}

function maskingExperiment(left, right, sampleRate, params, random, meta) {
  const hz = frequency(params.frequency, 500, sampleRate);
  const snr = number(params.snr, -12, -40, 12);
  const noise = makeNoise(left.length, random);
  // RBJ band-pass, constant 0 dB peak gain: smooth skirts, not a brick-wall band.
  // https://webaudio.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html
  // Q=2.5 gives approximately 200 Hz bandwidth around the default 500 Hz carrier.
  const noiseQ = 2.5;
  const omega = TAU * hz / sampleRate;
  const alpha = Math.sin(omega) / (2 * noiseQ);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = -2 * Math.cos(omega) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < noise.length; i++) {
    const input = noise[i];
    const filtered = b0 * input + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = input;
    y2 = y1; y1 = filtered;
    noise[i] = filtered;
  }
  prepareNoise(noise, 0.07, 0.25);
  const tone = new Float32Array(left.length);
  const active = new Uint8Array(left.length);
  const slot = left.length / 4;
  const pulseLength = Math.round(slot * 0.75);
  const tonePulseRanges = [];
  for (let pulse = 0; pulse < 4; pulse++) {
    const startSample = Math.round((pulse + 0.125) * slot);
    const endSample = Math.min(left.length, startSample + pulseLength);
    tonePulseRanges.push({startSample, endSample});
    for (let i = startSample; i < endSample; i++) {
      active[i] = 1;
      tone[i] = Math.sin(TAU * hz * i / sampleRate) * envelopeAt(i - startSample, endSample - startSample, sampleRate);
    }
  }
  // Set SNR over the four tone windows (including their tapers), so silence
  // between pulses cannot dilute the displayed ratio. Include the common outer
  // envelope here when measuring; renderExperiment applies it to PCM afterward.
  let noisePower = 0, tonePower = 0, activeNoisePower = 0, activeTonePower = 0, activeCount = 0;
  for (let i = 0; i < left.length; i++) {
    const outer = envelopeAt(i, left.length, sampleRate);
    const n2 = (noise[i] * outer) ** 2;
    const s2 = (tone[i] * outer) ** 2;
    noisePower += n2;
    tonePower += s2;
    if (active[i]) { activeNoisePower += n2; activeTonePower += s2; activeCount++; }
  }
  const activeNoiseRms = Math.sqrt(activeNoisePower / activeCount);
  const toneScale = Math.sqrt(activeNoisePower / (activeTonePower || 1)) * dbToGain(snr);
  const sign = params.invertTone ? -1 : 1;
  for (let i = 0; i < left.length; i++) {
    const signal = tone[i] * toneScale;
    left[i] = noise[i] + signal;
    right[i] = noise[i] + sign * signal;
  }
  route(left, right, params.routing);
  Object.assign(meta, {
    frequencyHz: hz, snrDb: snr, snrDefinition: "active-window-rms",
    invertTone: Boolean(params.invertTone), pulseCount: 4, tonePulseRanges,
    noiseRms: Math.sqrt(noisePower / left.length),
    toneRms: Math.sqrt(tonePower / left.length) * toneScale,
    activeNoiseRms, activeToneRms: activeNoiseRms * dbToGain(snr),
    noiseCentreHz: hz, noiseQ, noiseBandwidthHzNominal: hz / noiseQ,
    continuousMasker: true, routing: params.routing || "stereo",
    note: "Four tone pulses sit in continuous shared noise. SNR uses tone and total masker RMS within the tone windows, including tapers. A band-pass biquad (Q 2.5) centres the masker on the tone; only the tone changes polarity.",
  });
}

function spatialExperiment(left, right, sampleRate, params, random, meta) {
  const hz = frequency(params.frequency, 500, sampleRate);
  const pan = number(params.pan, 0, -1, 1);
  const delayMs = number(params.delayMs, 0, -1, 1);
  const noise = params.source === "sine" ? null : prepareNoise(makeNoise(left.length + Math.ceil(sampleRate * 0.004), random, "pink", sampleRate), 0.15, 0.6);
  const pad = Math.ceil(sampleRate * 0.002);
  const leftGain = Math.cos((pan + 1) * Math.PI / 4);
  const rightGain = Math.sin((pan + 1) * Math.PI / 4);
  function at(position) {
    if (!noise) return TONE_PEAK * Math.sin(TAU * hz * position / sampleRate);
    const shifted = position + pad;
    const index = Math.floor(shifted);
    const fraction = shifted - index;
    return (noise[index] || 0) * (1 - fraction) + (noise[index + 1] || 0) * fraction;
  }
  for (let i = 0; i < left.length; i++) {
    left[i] = at(i) * leftGain;
    right[i] = at(i - delayMs * sampleRate / 1000) * rightGain;
  }
  Object.assign(meta, {frequencyHz: hz, pan, delayMs, source: noise ? "noise" : "sine", note: "Positive delay means the right waveform lags; outer fades stay synchronized. Pan is an equal-power level balance, not a physical source angle."});
}

function noiseExperiment(left, right, sampleRate, params, random, meta) {
  const color = ["white", "pink", "brown"].includes(params.color) ? params.color : "pink";
  const noise = prepareNoise(makeNoise(left.length, random, color, sampleRate), 0.18, 0.65);
  left.set(noise);
  right.set(noise);
  Object.assign(meta, {color, noiseMethod: color === "pink" ? "octave-rate sample-and-hold plus white" : color === "brown" ? "leaky random walk" : "independent uniform samples", note: "The noise colors are generated approximations, approximately RMS matched with a peak ceiling. This does not guarantee equal perceived loudness."});
}

function shepardExperiment(left, right, sampleRate, params, meta) {
  const steps = Math.round(number(params.steps, 12, 4, 16));
  const direction = params.direction === "down" ? -1 : 1;
  const stepSamples = left.length / steps;
  const centre = Math.log2(700);
  for (let i = 0; i < left.length; i++) {
    const step = Math.min(steps - 1, Math.floor(i / stepSamples));
    const local = i - Math.floor(step * stepSamples);
    const length = Math.floor((step + 1) * stepSamples) - Math.floor(step * stepSamples);
    const envelope = envelopeAt(local, length, sampleRate, 0.04);
    const pitchClass = ((direction * step) % 12 + 12) % 12;
    let value = 0;
    for (let octave = -2; octave <= 5; octave++) {
      const hz = 110 * 2 ** (octave + pitchClass / 12);
      if (hz < 30 || hz >= Math.min(12000, sampleRate * 0.45)) continue;
      const weight = Math.exp(-0.5 * ((Math.log2(hz) - centre) / 1.15) ** 2);
      value += weight * Math.sin(TAU * hz * local / sampleRate);
    }
    left[i] = right[i] = value * envelope * 0.19;
  }
  Object.assign(meta, {direction: direction > 0 ? "up" : "down", steps, stepSeconds: left.length / sampleRate / steps, note: "Octave-separated tones move through a fixed spectral envelope. This is a finite staircase, not an endlessly playing loop."});
}

function amplitudeExperiment(left, right, sampleRate, params, meta) {
  const hz = frequency(params.frequency, 220, sampleRate);
  const shape = ["sine", "triangle", "square", "sawtooth"].includes(params.shape) ? params.shape : "sine";
  const gainDb = number(params.gainDb, -6, -40, 0);
  const gain = dbToGain(gainDb);
  const maxHarmonic = Math.min(48, Math.floor((sampleRate * 0.45) / hz));
  for (let i = 0; i < left.length; i++) {
    const phase = TAU * hz * i / sampleRate;
    let value = 0;
    if (shape === "sine") value = Math.sin(phase);
    else {
      for (let h = 1; h <= maxHarmonic; h++) {
        if (shape === "square" && h % 2 === 1) value += Math.sin(h * phase) * 4 / (Math.PI * h);
        else if (shape === "triangle" && h % 2 === 1) value += ((h % 4 === 1) ? 1 : -1) * Math.sin(h * phase) * 8 / (Math.PI ** 2 * h ** 2);
        else if (shape === "sawtooth") value += ((h % 2 === 1) ? 1 : -1) * Math.sin(h * phase) * 2 / (Math.PI * h);
      }
    }
    // Fixed scale leaves headroom for the Gibbs overshoot of the band-limited waves.
    left[i] = right[i] = value * 0.52 * gain;
  }
  Object.assign(meta, {frequencyHz: hz, shape, gainDb, maxHarmonic, note: "Waveforms use band-limited harmonic synthesis at a fixed common scale, not loudness normalization."});
}

function gapExperiment(left, right, sampleRate, params, random, meta) {
  const gapMs = number(params.gapMs, 16, 0, 250);
  const noise = prepareNoise(makeNoise(left.length, random), 0.18, 0.6);
  const gapSamples = Math.round(gapMs * sampleRate / 1000);
  const edgeSamples = Math.max(1, Math.round(sampleRate * 0.002));
  const centres = [Math.floor(left.length / 3), Math.floor(left.length * 2 / 3)];
  for (let i = 0; i < left.length; i++) {
    let envelope = 1;
    if (gapSamples > 0) {
      for (const centre of centres) {
        const start = centre - Math.floor(gapSamples / 2);
        const end = start + gapSamples;
        if (i >= start && i < end) envelope = 0;
        else {
          const distance = i < start ? start - i : i - end + 1;
          if (distance < edgeSamples) envelope *= Math.sin(Math.PI * distance / (2 * edgeSamples)) ** 2;
        }
      }
    }
    left[i] = right[i] = noise[i] * envelope;
  }
  Object.assign(meta, {gapMs: gapSamples * 1000 / sampleRate, gapSamples, gapCount: gapSamples ? 2 : 0, gapRampMs: 2, note: "Gap duration counts the fully silent samples, with an additional 2 ms smooth edge on each side."});
}

function toneExperiment(left, right, sampleRate, params, meta, fallback) {
  const hz = frequency(params.frequency, fallback, sampleRate);
  for (let i = 0; i < left.length; i++) left[i] = right[i] = TONE_PEAK * Math.sin(TAU * hz * i / sampleRate);
  route(left, right, params.ear === "both" ? "stereo" : params.ear);
  Object.assign(meta, {frequencyHz: hz, ear: params.ear || "both"});
}

const DEFAULT_DURATIONS = {phase: 2, beats: 5, harmonics: 2, masking: 3.2, spatial: 3, noise: 3, shepard: 5.4, amplitude: 2, frequency: 0.8, gap: 2, pitch: 1};

/** Deterministic, dependency-free synthesis. Returns finite two-channel PCM. */
export function renderExperiment(id, params = {}, sampleRate = 48000, seed = 12345) {
  if (!(id in DEFAULT_DURATIONS)) throw new RangeError(`Unknown experiment: ${id}`);
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError("Sample rate must be between 8000 and 192000 Hz.");
  sampleRate = Math.round(sampleRate);
  params = params && typeof params === "object" ? params : {};
  const steps = Math.round(number(params.steps, 12, 4, 16));
  const defaultDuration = id === "shepard" ? steps * 0.45 : DEFAULT_DURATIONS[id];
  const duration = number(params.duration, defaultDuration, 0.1, MAX_DURATION);
  const length = Math.round(duration * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const random = createSeededRandom(seed);
  const meta = {id, params: {...params}, seed: Number(seed) >>> 0, envelopeMs: 20, sampleRate, digitalOnly: true};
  if (id === "phase") phaseExperiment(left, right, sampleRate, params, random, meta);
  else if (id === "beats") beatsExperiment(left, right, sampleRate, params, meta);
  else if (id === "harmonics") harmonicsExperiment(left, right, sampleRate, params, meta);
  else if (id === "masking") maskingExperiment(left, right, sampleRate, params, random, meta);
  else if (id === "spatial") spatialExperiment(left, right, sampleRate, params, random, meta);
  else if (id === "noise") noiseExperiment(left, right, sampleRate, params, random, meta);
  else if (id === "shepard") shepardExperiment(left, right, sampleRate, params, meta);
  else if (id === "amplitude") amplitudeExperiment(left, right, sampleRate, params, meta);
  else if (id === "gap") gapExperiment(left, right, sampleRate, params, random, meta);
  else toneExperiment(left, right, sampleRate, params, meta, id === "pitch" ? 440 : 1000);
  for (let i = 0; i < length; i++) {
    const envelope = envelopeAt(i, length, sampleRate);
    left[i] *= envelope;
    right[i] *= envelope;
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw new Error("The audio renderer produced a non-finite sample.");
  }
  meta.peak = {left: measurePeak(left), right: measurePeak(right)};
  meta.rms = {left: measureRms(left), right: measureRms(right)};
  if (Math.max(meta.peak.left, meta.peak.right) > 0.95) throw new Error("The audio renderer exceeded its digital headroom ceiling.");
  return {left, right, sampleRate, duration: length / sampleRate, meta};
}
