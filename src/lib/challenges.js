/**
 * Short, reproducible listening experiments. These are curiosity games, not
 * calibrated audiometry. Levels are digital; no dB HL or age norms are implied.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const CHALLENGE_PROTOCOLS = Object.freeze({
  pitch: Object.freeze({
    referenceHz: 1000, initial: 100, minimum: 0.5, maximum: 400,
    targetReversals: 8, coarseReversals: 2, estimateReversals: 6,
    maxTrials: 40, coarseFactor: 2, fineFactor: Math.SQRT2,
    targetCorrect: Math.SQRT1_2, alternatives: 2, unit: 'Hz',
  }),
  gap: Object.freeze({
    initial: 32, minimum: 1, maximum: 64,
    targetReversals: 8, coarseReversals: 2, estimateReversals: 6,
    maxTrials: 30, coarseFactor: 2, fineFactor: Math.SQRT2,
    targetCorrect: Math.SQRT1_2, alternatives: 3, unit: 'ms',
  }),
});

export const FREQUENCY_MAP_HZ = Object.freeze([250, 500, 1000, 2000, 4000, 8000, 10000, 12000]);

function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite.`);
  return value;
}

export function createAdaptiveState(kind, overrides = {}) {
  if (!CHALLENGE_PROTOCOLS[kind]) throw new RangeError(`Unknown adaptive task: ${kind}`);
  const config = { ...CHALLENGE_PROTOCOLS[kind], ...overrides };
  for (const key of ['initial', 'minimum', 'maximum', 'coarseFactor', 'fineFactor', 'maxTrials', 'targetReversals']) positive(config[key], key);
  if (config.minimum > config.initial || config.initial > config.maximum) throw new RangeError('Initial value must be within bounds.');
  if (config.coarseFactor <= 1 || config.fineFactor <= 1) throw new RangeError('Staircase factors must exceed one.');
  return {
    kind, config, value: config.initial, correctStreak: 0, lastDirection: 0,
    reversals: [], trials: [], boundaryAttempts: { lower: 0, upper: 0 },
    stopped: false, stopReason: null,
  };
}

/** A reversal is an actual nonzero movement changing direction, not an answer. */
export function applyAdaptiveResponse(state, correct, detail = {}) {
  if (state.stopped) return state;
  if (typeof correct !== 'boolean') throw new TypeError('Response correctness must be boolean.');
  const config = state.config;
  let streak = correct ? state.correctStreak + 1 : 0;
  let requestedDirection = 0;
  if (!correct) requestedDirection = 1;
  else if (streak === 2) { requestedDirection = -1; streak = 0; }

  const next = {
    ...state,
    correctStreak: streak,
    trials: [...state.trials, {
      ...detail, index: state.trials.length + 1, parameter: state.value, correct,
    }],
    reversals: [...state.reversals],
    boundaryAttempts: { ...state.boundaryAttempts },
  };

  if (requestedDirection) {
    const atBoundary = (requestedDirection < 0 && state.value <= config.minimum)
      || (requestedDirection > 0 && state.value >= config.maximum);
    if (atBoundary) {
      const side = requestedDirection < 0 ? 'lower' : 'upper';
      next.boundaryAttempts[side] += 1;
      next.boundaryAttempts[side === 'lower' ? 'upper' : 'lower'] = 0;
      if (next.boundaryAttempts[side] >= 3) {
        next.stopped = true;
        next.stopReason = `${side}-bound`;
      }
    } else {
      next.boundaryAttempts = { lower: 0, upper: 0 };
      if (state.lastDirection && requestedDirection !== state.lastDirection) {
        next.reversals.push({ value: state.value, trial: next.trials.length });
      }
      const factor = next.reversals.length < config.coarseReversals
        ? config.coarseFactor : config.fineFactor;
      const requested = state.value * factor ** requestedDirection;
      next.value = Math.max(config.minimum, Math.min(config.maximum, requested));
      next.lastDirection = requestedDirection;
    }
  }

  if (!next.stopped && next.reversals.length >= config.targetReversals) {
    next.stopped = true;
    next.stopReason = 'reversals';
  } else if (!next.stopped && next.trials.length >= config.maxTrials) {
    next.stopped = true;
    next.stopReason = 'trial-limit';
  }
  return next;
}

export function hzDifferenceToCents(differenceHz, referenceHz = 1000) {
  positive(referenceHz, 'Reference frequency');
  if (!Number.isFinite(differenceHz) || differenceHz < 0) throw new RangeError('Difference must be nonnegative.');
  return 1200 * Math.log2((referenceHz + differenceHz) / referenceHz);
}

export function adaptiveResult(state, createdAt = new Date().toISOString()) {
  const fine = state.reversals.slice(state.config.coarseReversals);
  const used = fine.slice(-state.config.estimateReversals);
  const boundary = state.stopReason === 'lower-bound' || state.stopReason === 'upper-bound';
  // Four fine reversals permit only a provisional summary; fewer give no number.
  const estimate = !boundary && used.length >= 4
    ? Math.exp(used.reduce((sum, item) => sum + Math.log(item.value), 0) / used.length)
    : null;
  const status = boundary ? 'boundary'
    : state.stopReason === 'reversals' && used.length >= state.config.estimateReversals
      ? 'estimate' : 'provisional';
  return {
    schemaVersion: 1, kind: state.kind, createdAt, status,
    metrics: state.kind === 'pitch'
      ? { differenceHz: estimate, cents: estimate == null ? null : hzDifferenceToCents(estimate, state.config.referenceHz), referenceHz: state.config.referenceHz }
      : { gapMs: estimate, gapEdgeRampMs: 0.5 },
    protocol: {
      ...state.config, algorithm: 'two-down-one-up', replayAllowed: true,
      calibration: 'uncalibrated', gapDefinition: state.kind === 'gap' ? 'fully silent interval, plus two 0.5 ms edge ramps' : undefined,
    },
    stopReason: state.stopReason,
    reversals: state.reversals.map(item => ({ ...item })),
    trials: state.trials.map(item => ({ ...item })),
    notes: ['A short, session-specific listening experiment; no hearing-health classification.'],
  };
}

export function seededRandom(seed = 1) {
  let value = Number(seed) >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

export function frequencySchedule(seed = 1, repetitions = 3, sampleRate = 48000) {
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 12) throw new RangeError('Repetitions must be 1–12.');
  const random = seededRandom(seed);
  const frequencies = FREQUENCY_MAP_HZ.filter(hz => hz < sampleRate * 0.45);
  const schedule = [];
  for (let round = 0; round < repetitions; round += 1) {
    const shuffled = [...frequencies];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    schedule.push(...shuffled);
  }
  return schedule;
}

function outerEnvelope(index, length, rampSamples) {
  const position = Math.min(index / rampSamples, (length - 1 - index) / rampSamples, 1);
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, position));
}

/**
 * Return stereo PCM with all intervals pre-rendered on a shared sample clock.
 * meta.correctIndex is zero-based. Tone level is fixed across frequencies.
 */
export function createChallengeTrial(kind, options = {}) {
  if (!['pitch', 'gap', 'frequency'].includes(kind)) throw new RangeError(`Unknown task: ${kind}`);
  const sampleRate = options.sampleRate ?? 48000;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Unsupported sample rate.');
  const random = seededRandom(options.seed ?? 1);
  const alternatives = kind === 'pitch' ? 2 : 3;
  const correctIndex = options.correctIndex ?? Math.floor(random() * alternatives);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= alternatives) throw new RangeError('Invalid target interval.');
  const parameter = positive(options.value ?? (kind === 'pitch' ? 100 : kind === 'gap' ? 32 : 1000), 'Stimulus parameter');
  const referenceHz = options.referenceHz ?? 1000;
  const frequencyHz = kind === 'frequency' ? (options.frequencyHz ?? parameter) : referenceHz;
  if (kind !== 'gap' && (!Number.isFinite(frequencyHz) || frequencyHz <= 0 || frequencyHz + (kind === 'pitch' ? parameter : 0) >= sampleRate * 0.45)) {
    throw new RangeError('Tone is outside the supported frequency range.');
  }
  if (kind === 'gap' && parameter > 128) throw new RangeError('Gap is too long for this task.');

  const intervalDuration = kind === 'gap' ? 0.5 : kind === 'pitch' ? 0.25 : 0.35;
  const intervalGap = kind === 'pitch' ? 0.3 : 0.25;
  const lead = 0.15;
  const duration = lead * 2 + alternatives * intervalDuration + (alternatives - 1) * intervalGap;
  const pcm = new Float32Array(Math.ceil(duration * sampleRate));
  const intervals = [];
  const intervalSamples = Math.round(intervalDuration * sampleRate);
  const outerRamp = Math.round(0.02 * sampleRate);
  const gapRamp = Math.max(1, Math.round(0.0005 * sampleRate));
  const gapSamples = Math.round(parameter * sampleRate / 1000);
  const gapStart = Math.floor((intervalSamples - gapSamples) / 2);
  const gapEnd = gapStart + gapSamples;

  for (let interval = 0; interval < alternatives; interval += 1) {
    const start = Math.round((lead + interval * (intervalDuration + intervalGap)) * sampleRate);
    intervals.push({ start: start / sampleRate, duration: intervalSamples / sampleRate });
    const frequency = kind === 'pitch'
      ? referenceHz + (interval === correctIndex ? parameter : 0) : frequencyHz;
    for (let index = 0; index < intervalSamples; index += 1) {
      const envelope = outerEnvelope(index, intervalSamples, outerRamp);
      let value = 0;
      if (kind === 'gap') {
        let gapEnvelope = 1;
        if (interval === correctIndex) {
          if (index >= gapStart && index < gapEnd) gapEnvelope = 0;
          else if (index >= gapStart - gapRamp && index < gapStart) {
            gapEnvelope = 0.5 - 0.5 * Math.cos(Math.PI * (gapStart - index) / gapRamp);
          } else if (index >= gapEnd && index < gapEnd + gapRamp) {
            gapEnvelope = 0.5 - 0.5 * Math.cos(Math.PI * (index - gapEnd) / gapRamp);
          }
        }
        value = (random() * 2 - 1) * 0.4 * gapEnvelope * envelope;
      } else if (kind === 'pitch' || interval === correctIndex) {
        value = Math.sin(2 * Math.PI * frequency * index / sampleRate) * 0.5 * envelope;
      }
      pcm[start + index] = value;
    }
  }

  return {
    left: pcm, right: pcm.slice(), sampleRate, duration: pcm.length / sampleRate,
    meta: {
      kind, correctIndex, intervals, parameter: kind === 'frequency' ? frequencyHz : parameter,
      referenceHz: kind === 'pitch' ? referenceHz : undefined,
      gapDefinition: kind === 'gap' ? 'silent plateau; 0.5 ms extra taper on each side' : undefined,
      seed: options.seed ?? 1,
    },
  };
}

export function frequencyResult(records, createdAt = new Date().toISOString()) {
  const points = [...new Set(records.map(item => item.frequencyHz))]
    .sort((a, b) => a - b)
    .map(frequencyHz => {
      const observations = records.filter(item => item.frequencyHz === frequencyHz);
      return { frequencyHz, correct: observations.filter(item => item.correct).length, trials: observations.length };
    });
  return {
    schemaVersion: 1, kind: 'frequency', createdAt, status: 'exploratory',
    metrics: { points },
    protocol: { alternatives: 3, repetitions: 3, level: 'fixed digital amplitude', amplitude: 0.5, calibration: 'uncalibrated', replayAllowed: true },
    trials: records.map(item => ({ ...item })),
    notes: ['Guessing succeeds about one time in three. Three observations per frequency do not establish a hearing threshold or maximum audible frequency.'],
  };
}
