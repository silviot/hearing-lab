// SPDX-License-Identifier: AGPL-3.0-only
import test from "node:test";
import assert from "node:assert/strict";
import {renderExperiment, measurePeak, measureRms, dbToGain, gainToDb} from "../src/audio/dsp.js";

function almost(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test("opposite polarity remains audible in separate ears and cancels exactly in a normalized mono sum", () => {
  for (const source of ["sine", "complex", "noise"]) {
    const params = {source, mode: "polarity", phase: 180, duration: 0.2};
    const stereo = renderExperiment("phase", params);
    assert.ok(measureRms(stereo.left) > 0.05);
    assert.ok(measureRms(stereo.right) > 0.05);
    for (let i = 0; i < stereo.left.length; i++) assert.equal(stereo.left[i] + stereo.right[i], 0);
    const mono = renderExperiment("phase", {...params, routing: "mono"});
    assert.equal(measurePeak(mono.left), 0);
    assert.equal(measurePeak(mono.right), 0);
  }
});

test("in-phase mono mixing does not add an unintended 6 dB", () => {
  const stereo = renderExperiment("phase", {phase: 0, duration: 0.2});
  const mono = renderExperiment("phase", {phase: 0, routing: "mono", duration: 0.2});
  assert.deepEqual(mono.left, stereo.left);
  assert.deepEqual(mono.right, stereo.right);
  const quarterCycle = renderExperiment("phase", {phase: 90, routing: "mono", duration: 1});
  const inPhase = renderExperiment("phase", {phase: 0, routing: "mono", duration: 1});
  almost(measureRms(quarterCycle.left) / measureRms(inPhase.left), Math.SQRT1_2, 0.0001);
});

test("seeded noise is reproducible and opposite ears reuse the same source", () => {
  const params = {source: "noise", mode: "polarity", phase: 0, duration: 0.2};
  const first = renderExperiment("phase", params, 44100, 123);
  const repeated = renderExperiment("phase", params, 44100, 123);
  const different = renderExperiment("phase", params, 44100, 124);
  assert.deepEqual(first.left, first.right);
  assert.deepEqual(first.left, repeated.left);
  assert.notDeepEqual(first.left, different.left);
});

test("the original pink approximation is reproducible and has more slow variation than white", () => {
  const pink = renderExperiment("noise", {color: "pink", duration: 1}, 48000, 321);
  const repeated = renderExperiment("noise", {color: "pink", duration: 1}, 48000, 321);
  const white = renderExperiment("noise", {color: "white", duration: 1}, 48000, 321);
  assert.deepEqual(pink.left, repeated.left);
  assert.deepEqual(pink.left, pink.right);
  const adjacentChangeRatio = samples => {
    let changePower = 0, signalPower = 0;
    for (let i = 1; i < samples.length; i++) {
      changePower += (samples[i] - samples[i - 1]) ** 2;
      signalPower += samples[i] ** 2;
    }
    return changePower / signalPower;
  };
  assert.ok(adjacentChangeRatio(pink.left) < adjacentChangeRatio(white.left) * 0.75);
  assert.equal(pink.meta.noiseMethod, "octave-rate sample-and-hold plus white");
});

test("masking changes only the four tone pulses, retaining continuous shared noise and active-window SNR", () => {
  const params = {snr: -12, frequency: 500};
  const same = renderExperiment("masking", params);
  const opposite = renderExperiment("masking", {...params, invertTone: true});
  assert.deepEqual(same.left, same.right);
  assert.deepEqual(same.left, opposite.left);
  const noise = new Float32Array(same.left.length);
  const tone = new Float32Array(same.left.length);
  for (let i = 0; i < noise.length; i++) {
    noise[i] = (same.left[i] + opposite.right[i]) / 2;
    tone[i] = (same.left[i] - opposite.right[i]) / 2;
  }
  almost(measureRms(noise), same.meta.noiseRms, 1e-7);
  almost(measureRms(tone), same.meta.toneRms, 1e-7);
  let activeNoisePower = 0, activeTonePower = 0, activeCount = 0;
  for (const {startSample, endSample} of same.meta.tonePulseRanges) {
    for (let i = startSample; i < endSample; i++) {
      activeNoisePower += noise[i] ** 2;
      activeTonePower += tone[i] ** 2;
      activeCount++;
    }
  }
  almost(Math.sqrt(activeNoisePower / activeCount), same.meta.activeNoiseRms, 1e-7);
  almost(Math.sqrt(activeTonePower / activeCount), same.meta.activeToneRms, 1e-7);
  almost(gainToDb(Math.sqrt(activeTonePower / activeNoisePower)), -12, 0.0001);
  assert.equal(same.meta.continuousMasker, true);
  assert.equal(same.meta.noiseCentreHz, 500);
  assert.equal(same.meta.noiseQ, 2.5);
  assert.equal(same.meta.pulseCount, 4);
  // The target disappears between pulses; the masker must keep playing there.
  for (let pulse = 0; pulse < 3; pulse++) {
    const gapStart = same.meta.tonePulseRanges[pulse].endSample;
    const gapEnd = same.meta.tonePulseRanges[pulse + 1].startSample;
    assert.equal(measurePeak(tone.subarray(gapStart, gapEnd)), 0);
    assert.ok(measureRms(noise.subarray(gapStart, gapEnd)) > 0.01);
  }
  const mixed = renderExperiment("masking", {...params, invertTone: true, routing: "mono"});
  assert.deepEqual(mixed.left, noise);
  assert.deepEqual(mixed.left, mixed.right);
  assert.ok(measureRms(noise) > 0.02, "The masker must survive mono mixing.");
});

test("removing a harmonic preserves the amplitudes of every remaining partial", () => {
  const all = renderExperiment("harmonics", {harmonics: [1, 1, 1, 1, 1, 1], duration: 0.2});
  const missing = renderExperiment("harmonics", {harmonics: [0, 1, 1, 1, 1, 1], duration: 0.2});
  const fundamental = renderExperiment("harmonics", {harmonics: [1, 0, 0, 0, 0, 0], duration: 0.2});
  for (let i = 0; i < all.left.length; i++) almost(all.left[i] - missing.left[i], fundamental.left[i], 8e-8);
  assert.equal(all.meta.componentScale, missing.meta.componentScale);
});

test("waveform gain uses the amplitude-decibel convention", () => {
  almost(dbToGain(-6), 0.5011872336272722, 1e-12);
  const loud = renderExperiment("amplitude", {gainDb: 0, duration: 0.2});
  const quiet = renderExperiment("amplitude", {gainDb: -6, duration: 0.2});
  almost(measureRms(quiet.left) / measureRms(loud.left), dbToGain(-6), 1e-7);
});

test("frequency routing has one genuinely silent channel and respects sample-rate limits", () => {
  const left = renderExperiment("frequency", {frequency: 20000, ear: "left"}, 8000);
  assert.equal(measurePeak(left.right), 0);
  assert.ok(measureRms(left.left) > 0);
  assert.equal(left.meta.frequencyHz, 3600);
  const right = renderExperiment("frequency", {ear: "right"});
  assert.equal(measurePeak(right.left), 0);
  assert.ok(measureRms(right.right) > 0);
});

test("a stated gap contains exactly that number of silent samples, with separately labelled ramps", () => {
  const result = renderExperiment("gap", {gapMs: 16}, 48000);
  assert.equal(result.meta.gapSamples, 768);
  const centre = Math.floor(result.left.length / 3);
  const start = centre - 384;
  for (let i = start; i < start + 768; i++) assert.ok(result.left[i] === 0);
  assert.notEqual(result.left[start - 1], 0);
  assert.notEqual(result.left[start + 768], 0);
  const noGap = renderExperiment("gap", {gapMs: 0}, 48000);
  assert.equal(noGap.meta.gapCount, 0);
  assert.notEqual(noGap.left[centre], 0);
});

test("every experiment produces bounded finite PCM, finite duration, and silent smooth edges", () => {
  const ids = ["phase", "beats", "harmonics", "masking", "spatial", "noise", "shepard", "amplitude", "frequency", "gap", "pitch"];
  for (const sampleRate of [8000, 44100, 48000]) {
    for (const id of ids) {
      const result = renderExperiment(id, {}, sampleRate);
      assert.ok(result.duration > 0 && result.duration <= 8, id);
      assert.equal(result.left.length, result.right.length);
      assert.equal(result.duration, result.left.length / sampleRate);
      for (const channel of [result.left, result.right]) {
        assert.ok(channel[0] === 0, `${id} starts silent`);
        assert.ok(channel.at(-1) === 0, `${id} ends silent`);
        for (const sample of channel) assert.ok(Number.isFinite(sample) && Math.abs(sample) <= 0.95, `${id} stays bounded`);
        assert.ok(Math.abs(channel[1]) < 0.001, `${id} has a smooth onset`);
      }
    }
  }
});

test("extreme controls stay bounded without normalizing individual conditions", () => {
  const variants = [
    ["phase", {source: "noise", mode: "delay", delayMs: 10}],
    ["phase", {source: "noise", mode: "delay", delayMs: -10}],
    ["harmonics", {harmonics: [1, 1, 1, 1, 1, 1]}],
    ["masking", {snr: 12, invertTone: true}],
    ["spatial", {pan: 1, delayMs: -1}],
    ["shepard", {steps: 16, direction: "down"}],
    ...["sine", "square", "triangle", "sawtooth"].map(shape => ["amplitude", {shape, gainDb: 0}]),
    ...["white", "pink", "brown"].map(color => ["noise", {color}]),
  ];
  for (const [id, params] of variants) {
    const result = renderExperiment(id, params);
    assert.ok(result.meta.peak.left <= 0.95 && result.meta.peak.right <= 0.95, id);
  }
  assert.equal(renderExperiment("frequency", {duration: 999}).duration, 8);
  assert.throws(() => renderExperiment("unknown"), /Unknown experiment/);
  assert.throws(() => renderExperiment("phase", {}, NaN), /Sample rate/);
});
