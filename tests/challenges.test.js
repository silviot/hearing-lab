// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdaptiveState, applyAdaptiveResponse, stopAdaptiveEarly, adaptiveResult,
  createChallengeTrial, hzDifferenceToCents, frequencySchedule, frequencyResult,
} from '../src/lib/challenges.js';

test('two correct answers lower difficulty; an error raises it and resets the streak', () => {
  const original = createAdaptiveState('pitch');
  let state = applyAdaptiveResponse(original, true);
  assert.equal(state.value, 100);
  assert.equal(state.reversals.length, 0);
  state = applyAdaptiveResponse(state, true);
  assert.equal(state.value, 50);
  assert.equal(state.correctStreak, 0);
  state = applyAdaptiveResponse(state, true);
  state = applyAdaptiveResponse(state, false);
  assert.equal(state.value, 100);
  assert.equal(state.correctStreak, 0);
  assert.deepEqual(state.reversals, [{ value: 50, trial: 4 }]);
  assert.equal(original.trials.length, 0, 'Input state must remain reusable.');
});

test('the second actual reversal starts the smaller logarithmic steps', () => {
  let state = createAdaptiveState('pitch');
  for (const answer of [true, true, false, true, true]) state = applyAdaptiveResponse(state, answer);
  assert.equal(state.reversals.length, 2);
  assert.ok(Math.abs(state.value - 100 / Math.SQRT2) < 1e-10);
});

test('repeated floor clamping stops without fake reversals or a manufactured threshold', () => {
  let state = createAdaptiveState('pitch', { initial: 0.5 });
  for (let index = 0; index < 6; index += 1) state = applyAdaptiveResponse(state, true);
  assert.equal(state.stopReason, 'lower-bound');
  assert.equal(state.reversals.length, 0);
  assert.equal(adaptiveResult(state).metrics.differenceHz, null);
  assert.equal(adaptiveResult(state).status, 'boundary');
  assert.equal(applyAdaptiveResponse(state, false), state, 'A completed track cannot accumulate new answers.');
});

test('easiest boundary and trial budget are explicit incomplete outcomes', () => {
  let boundary = createAdaptiveState('gap', { initial: 64 });
  for (let index = 0; index < 3; index += 1) boundary = applyAdaptiveResponse(boundary, false);
  assert.equal(boundary.stopReason, 'upper-bound');
  let capped = createAdaptiveState('pitch', { maxTrials: 1 });
  capped = applyAdaptiveResponse(capped, true);
  assert.equal(capped.stopReason, 'trial-limit');
  assert.equal(adaptiveResult(capped).status, 'provisional');
  assert.equal(adaptiveResult(capped).metrics.cents, null);
});

test('a simulated listener brackets a known difference without running forever', () => {
  let state = createAdaptiveState('pitch');
  const listenerThreshold = 5;
  while (!state.stopped) state = applyAdaptiveResponse(state, state.value >= listenerThreshold);
  const result = adaptiveResult(state, '2026-01-01T00:00:00.000Z');
  assert.equal(state.stopReason, 'reversals');
  assert.equal(result.status, 'estimate');
  assert.equal(result.reversals.length, 4);
  assert.ok(result.metrics.differenceHz > listenerThreshold / Math.SQRT2);
  assert.ok(result.metrics.differenceHz < listenerThreshold * Math.SQRT2);
  assert.ok(result.trials.length <= 18);
  assert.equal(result.createdAt, '2026-01-01T00:00:00.000Z');
});

test('stopping early preserves completed trials and marks the result provisional', () => {
  let state = createAdaptiveState('gap');
  for (const answer of [true, true, false, true, true, false]) state = applyAdaptiveResponse(state, answer);
  state = stopAdaptiveEarly(state);
  assert.equal(state.stopped, true);
  assert.equal(state.stopReason, 'stopped-early');
  const result = adaptiveResult(state);
  assert.equal(result.status, 'provisional');
  assert.equal(result.trials.length, 6);
  assert.ok(Number.isFinite(result.metrics.gapMs) && result.metrics.gapMs > 0);
});

test('musical conversion uses a frequency ratio, not linear Hz', () => {
  assert.equal(hzDifferenceToCents(1000, 1000), 1200);
  assert.ok(Math.abs(hzDifferenceToCents(1000 * (2 ** (1 / 12) - 1), 1000) - 100) < 1e-9);
  assert.throws(() => hzDifferenceToCents(-1), RangeError);
});

function sinusoidalAmplitude(buffer, frequency, sampleRate) {
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const phase = 2 * Math.PI * frequency * index / sampleRate;
    real += buffer[index] * Math.cos(phase);
    imaginary += buffer[index] * Math.sin(phase);
  }
  return 2 * Math.hypot(real, imaginary) / buffer.length;
}

test('pitch trial contains the specified higher frequency only in its target interval', () => {
  const trial = createChallengeTrial('pitch', { value: 100, correctIndex: 1, sampleRate: 48000 });
  for (let interval = 0; interval < 2; interval += 1) {
    const start = Math.round((trial.meta.intervals[interval].start + 0.05) * trial.sampleRate);
    const window = trial.left.slice(start, start + 7200);
    const expected = interval === 1 ? 1100 : 1000;
    assert.ok(sinusoidalAmplitude(window, expected, trial.sampleRate) > 0.499);
    assert.ok(sinusoidalAmplitude(window, interval === 1 ? 1000 : 1100, trial.sampleRate) < 0.0001);
  }
  assert.deepEqual(trial.left, trial.right);
});

test('gap duration changes preserve the burst lengths and interval locations', () => {
  const trials = [1, 16, 64].map(value => createChallengeTrial('gap', { value, seed: 12, correctIndex: 1 }));
  for (const trial of trials) {
    assert.equal(trial.left.length, trials[0].left.length);
    assert.deepEqual(trial.meta.intervals, trials[0].meta.intervals);
    const intervalLength = Math.round(trial.meta.intervals[1].duration * trial.sampleRate);
    const length = Math.round(trial.meta.parameter * trial.sampleRate / 1000);
    const targetStart = Math.round(trial.meta.intervals[1].start * trial.sampleRate);
    const silenceStart = targetStart + Math.floor((intervalLength - length) / 2);
    assert.ok(trial.left.slice(silenceStart, silenceStart + length).every(value => value === 0));
    const foilStart = Math.round(trial.meta.intervals[0].start * trial.sampleRate);
    assert.ok(trial.left.slice(foilStart + intervalLength / 2, foilStart + intervalLength / 2 + 30).some(value => value !== 0));
  }
});

test('frequency detection places audio in one interval, leaving two exact silent alternatives', () => {
  const trial = createChallengeTrial('frequency', { value: 8000, correctIndex: 2, seed: 4 });
  for (let interval = 0; interval < 3; interval += 1) {
    const start = Math.round(trial.meta.intervals[interval].start * trial.sampleRate);
    const end = start + Math.round(trial.meta.intervals[interval].duration * trial.sampleRate);
    const hasSound = trial.left.slice(start, end).some(value => value !== 0);
    assert.equal(hasSound, interval === 2);
  }
});

test('generated buffers are reproducible, bounded, finite, and softly gated', () => {
  for (const kind of ['pitch', 'gap', 'frequency']) {
    const trial = createChallengeTrial(kind, { seed: 87 });
    assert.deepEqual(trial.left, createChallengeTrial(kind, { seed: 87 }).left);
    assert.ok(trial.left.every(value => Number.isFinite(value) && Math.abs(value) <= 0.5));
    for (const interval of trial.meta.intervals) {
      const start = Math.round(interval.start * trial.sampleRate);
      const end = start + Math.round(interval.duration * trial.sampleRate) - 1;
      assert.ok(trial.left[start] === 0);
      assert.ok(trial.left[end] === 0);
    }
  }
  assert.throws(() => createChallengeTrial('frequency', { value: 24000 }), RangeError);
  assert.throws(() => createChallengeTrial('pitch', { value: NaN }), RangeError);
});

test('frequency schedule repeats each supported band twice by default without ordered scanning', () => {
  const schedule = frequencySchedule(17);
  assert.equal(schedule.length, 16);
  assert.deepEqual(schedule, frequencySchedule(17));
  for (const hz of new Set(schedule)) assert.equal(schedule.filter(value => value === hz).length, 2);
  assert.notDeepEqual(schedule.slice(0, 8), [...schedule.slice(0, 8)].sort((a, b) => a - b));
  assert.ok(frequencySchedule(17, 2, 8000).every(hz => hz < 3600));
});

test('frequency results retain observations without inferring an audible cutoff', () => {
  const result = frequencyResult([
    { frequencyHz: 1000, correct: true },
    { frequencyHz: 1000, correct: false },
    { frequencyHz: 12000, correct: true },
  ]);
  assert.equal(result.status, 'exploratory');
  assert.deepEqual(result.metrics.points, [
    { frequencyHz: 1000, correct: 1, trials: 2 },
    { frequencyHz: 12000, correct: 1, trials: 1 },
  ]);
  assert.equal(Object.hasOwn(result.metrics, 'maximumFrequency'), false);
});
