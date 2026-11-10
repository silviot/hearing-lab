// SPDX-License-Identifier: AGPL-3.0-only
import test from "node:test";
import assert from "node:assert/strict";
import {LiveSynth, LIVE_IDS} from "../src/audio/live.js";
import {AudioEngine} from "../src/audio/engine.js";

const SR = 48000;
function run(synth, seconds) {
  const left = new Float32Array(Math.round(seconds * SR)), right = new Float32Array(left.length);
  // Process in audio-callback-sized blocks, as a browser would.
  for (let at = 0; at < left.length; at += 128) synth.process(left.subarray(at, at + 128), right.subarray(at, at + 128));
  return {left, right};
}
const rms = samples => Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
const peak = samples => samples.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
const maxStep = samples => { let max = 0; for (let i = 1; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i] - samples[i - 1])); return max; };

test("every live experiment starts from silence, keeps sounding, and stays inside the headroom ceiling", () => {
  for (const id of LIVE_IDS) {
    const synth = new LiveSynth(SR);
    synth.set(id, {});
    const {left, right} = run(synth, 3);
    assert.ok(Math.abs(left[0]) < 1e-3, id);
    assert.ok(peak(left) <= 0.95 && peak(right) <= 0.95, id);
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite), id);
    // Still producing sound in the third second: nothing ends on its own.
    assert.ok(rms(left.subarray(2 * SR)) > 0.01, id);
  }
});

test("a live tone has the requested frequency and glides to a new one without a jump", () => {
  const synth = new LiveSynth(SR);
  synth.set("pitch", {frequency: 440});
  const first = run(synth, 1).left.subarray(SR / 2);
  let crossings = 0;
  for (let i = 1; i < first.length; i++) if (first[i - 1] < 0 && first[i] >= 0) crossings++;
  assert.ok(Math.abs(crossings - 220) <= 1);
  const before = maxStep(first);
  synth.set("pitch", {frequency: 880});
  const glide = run(synth, 0.2).left;
  // A 880 Hz sine at this peak moves at most 0.65·2π·880/48000 per sample; a click would exceed it.
  assert.ok(maxStep(glide) <= 0.65 * 2 * Math.PI * 880 / SR * 1.02);
  assert.ok(maxStep(glide) > before);
});

test("opposite waves stay audible in separate ears and cancel when switched to mono while playing", () => {
  const synth = new LiveSynth(SR);
  synth.set("phase", {source: "sine", mode: "phase", phase: 180, routing: "stereo", frequency: 500});
  const stereo = run(synth, 0.5);
  const tail = stereo.left.length - 1000;
  assert.ok(rms(stereo.left.subarray(tail)) > 0.4);
  for (let i = tail; i < stereo.left.length; i++) assert.ok(Math.abs(stereo.left[i] + stereo.right[i]) < 1e-6);
  synth.set("phase", {source: "sine", mode: "phase", phase: 180, routing: "mono", frequency: 500});
  const mono = run(synth, 0.5);
  assert.ok(maxStep(mono.left) < 0.06, "The switch is a crossfade, not a click.");
  assert.ok(peak(mono.left.subarray(tail)) < 1e-6);
  synth.set("phase", {source: "sine", mode: "phase", phase: 0, routing: "mono", frequency: 500});
  assert.ok(rms(run(synth, 0.5).left.subarray(tail)) > 0.4);
});

test("live beats pulse at the frequency difference", () => {
  const synth = new LiveSynth(SR);
  synth.set("beats", {frequency: 440, difference: 4, routing: "together"});
  const {left} = run(synth, 2);
  let quiet = 0, wasQuiet = false;
  for (let at = SR / 2; at + 480 <= left.length; at += 480) {
    const isQuiet = peak(left.subarray(at, at + 480)) < 0.1;
    if (isQuiet && !wasQuiet) quiet++;
    wasQuiet = isQuiet;
  }
  assert.equal(quiet, 6, "Four beats per second leaves six quiet moments in 1.5 seconds.");
});

test("the masking tone ratio follows the setting, and the noise is identical in both ears", () => {
  const measure = snr => {
    const synth = new LiveSynth(SR);
    synth.set("masking", {snr, invertTone: true});
    const {left, right} = run(synth, 4);
    const tone = left.map((x, i) => (x - right[i]) / 2), noise = left.map((x, i) => (x + right[i]) / 2);
    return {tone: rms(tone.subarray(SR)), noise: rms(noise.subarray(SR))};
  };
  const loud = measure(0), soft = measure(-12);
  assert.ok(Math.abs(20 * Math.log10(loud.tone / soft.tone) - 12) < 0.2);
  assert.ok(Math.abs(loud.noise - soft.noise) < 1e-6);
  assert.ok(Math.abs(loud.noise - 0.07) < 0.012);
});

test("the live gap is fully silent for the stated time, and stop fades to exact silence", () => {
  const synth = new LiveSynth(SR);
  synth.set("gap", {gapMs: 16});
  const {left} = run(synth, 2);
  // Gaps are centred two thirds of a second apart; look at the one at 4/3 s.
  const centre = 2 * Math.round(SR * 2 / 3);
  assert.equal(peak(left.subarray(centre - 380, centre + 380)), 0);
  assert.ok(rms(left.subarray(centre + 2000, centre + 4000)) > 0.1);
  synth.stop();
  const tail = run(synth, 0.3).left;
  assert.ok(maxStep(tail) < 0.4);
  assert.ok(synth.done);
  assert.ok(peak(tail.subarray(tail.length - 100)) < 1e-4);
});

test("switching experiments mid-flight fades out before the new sound fades in", () => {
  const synth = new LiveSynth(SR);
  synth.set("pitch", {frequency: 300});
  run(synth, 0.2);
  synth.set("frequency", {frequency: 1000, ear: "left"});
  const {left, right} = run(synth, 0.5);
  assert.equal(synth.id, "frequency");
  assert.ok(rms(left.subarray(left.length - 2000)) > 0.4);
  assert.ok(peak(right.subarray(right.length - 2000)) < 1e-4);
  assert.throws(() => synth.set("nope", {}), /Unknown experiment/);
});

test("the engine plays live sound until stopped and applies changes without restarting", async () => {
  const original = globalThis.AudioContext;
  const nodes = [];
  globalThis.AudioContext = class extends EventTarget {
    constructor() { super(); this.state = "suspended"; this.sampleRate = SR; this.currentTime = 1; this.destination = {}; }
    createGain() { return {connect() {}, disconnect() { this.disconnected = true; }, gain: {value: 1, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }}}; }
    createScriptProcessor(size, inputs, outputs) { const node = {size, inputs, outputs, connect() { this.connected = true; }, disconnect() { this.connected = false; }}; nodes.push(node); return node; }
    async resume() { this.state = "running"; }
    async close() { this.state = "closed"; }
  };
  try {
    const states = [];
    const engine = new AudioEngine({onState: state => states.push(state)});
    assert.equal(engine.updateLive("pitch", {frequency: 440}), false);
    const state = await engine.startLive("pitch", {frequency: 440});
    assert.equal(state.playing, true);
    assert.equal(state.live, true);
    assert.equal(state.duration, Infinity);
    assert.equal(nodes.length, 1);
    const pull = () => {
      const left = new Float32Array(1024), right = new Float32Array(1024);
      nodes[0].onaudioprocess({outputBuffer: {getChannelData: channel => channel ? right : left}});
      return left;
    };
    for (let i = 0; i < 10; i++) pull();
    assert.ok(rms(pull()) > 0.4);
    assert.equal(engine.updateLive("pitch", {frequency: 660}), true);
    assert.equal(nodes.length, 1, "A change must not create a new source.");
    assert.equal(engine.playing, true);
    assert.equal(states.length, 1, "A change must not emit a stop.");
    assert.equal(engine.liveInfo.cycle, -1);
    engine.stop("hidden");
    assert.equal(engine.playing, false);
    assert.equal(engine.live, false);
    assert.equal(nodes[0].connected, false);
    await engine.dispose();
  } finally { if (original === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = original; }
});
