// SPDX-License-Identifier: AGPL-3.0-only
import test from "node:test";
import assert from "node:assert/strict";
import {AudioEngine, MAX_MASTER_GAIN, DEFAULT_MASTER_GAIN} from "../src/audio/engine.js";

class FakeAudioContext extends EventTarget {
  static instances = [];
  constructor() {
    super();
    this.state = "suspended";
    this.sampleRate = 48000;
    this.currentTime = 1;
    this.destination = {};
    this.sources = [];
    this.gains = [];
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const node = {disconnected: false, connect() {}, disconnect() { this.disconnected = true; }};
    node.gain = {
      value: 1,
      events: [],
      cancelScheduledValues(time) { this.events.push(["cancel", time]); },
      setValueAtTime(value, time) { this.value = value; this.events.push(["value", value, time]); },
      linearRampToValueAtTime(value, time) { this.value = value; this.events.push(["ramp", value, time]); },
      setTargetAtTime(value, time, constant) { this.value = value; this.events.push(["target", value, time, constant]); },
    };
    this.gains.push(node);
    return node;
  }
  createBuffer(channels, length, sampleRate) {
    return {channels, length, sampleRate, data: [], copyToChannel(data, index) { this.data[index] = new Float32Array(data); }};
  }
  createBufferSource() {
    const source = {
      disconnected: false,
      stops: [],
      connect() {},
      disconnect() { this.disconnected = true; },
      start(time) { this.startTime = time; },
      stop(time) { this.stops.push(time); },
    };
    this.sources.push(source);
    return source;
  }
  async resume() { this.state = "running"; this.dispatchEvent(new Event("statechange")); }
  async suspend() { this.state = "suspended"; this.dispatchEvent(new Event("statechange")); }
  async close() { this.state = "closed"; this.dispatchEvent(new Event("statechange")); }
}

async function withContext(callback) {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = FakeAudioContext;
  FakeAudioContext.instances.length = 0;
  try { await callback(); }
  finally { if (original === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = original; }
}

function pcm(seconds = 0.1) {
  const left = new Float32Array(Math.round(seconds * 48000));
  const right = new Float32Array(left.length);
  left[100] = 0.1;
  right[100] = -0.1;
  return {left, right, sampleRate: 48000, duration: seconds, meta: {id: "fixture"}};
}

test("construction is silent, playback is finite, and completion reaches subscribers", async () => withContext(async () => {
  const states = [];
  const subscribed = [];
  const engine = new AudioEngine({onState: state => states.push(state)});
  assert.equal(FakeAudioContext.instances.length, 0, "Constructor must not create or resume audio.");
  assert.equal(engine.sampleRate, 48000);
  const unsubscribe = engine.subscribe(state => subscribed.push(state));
  const rendered = pcm();
  const started = await engine.playBuffer(rendered);
  const context = FakeAudioContext.instances[0];
  assert.equal(started.playing, true);
  assert.equal(context.gains[0].gain.value, DEFAULT_MASTER_GAIN);
  assert.equal(context.sources[0].startTime, 1.03);
  assert.equal(context.sources[0].stops.length, 1);
  assert.ok(Math.abs(context.sources[0].stops[0] - 1.13) < 1e-12);
  assert.equal(engine.current, rendered);
  context.sources[0].onended();
  assert.equal(engine.state.reason, "ended");
  assert.equal(engine.current, null);
  assert.equal(subscribed.length, 2);
  unsubscribe();
  await engine.playBuffer(rendered);
  assert.equal(subscribed.length, 2);
  assert.equal(states.length, 3);
  await engine.dispose();
}));

test("an interruption disconnects existing sound and does not restart it on resume", async () => withContext(async () => {
  const engine = new AudioEngine();
  await engine.playBuffer(pcm());
  const context = FakeAudioContext.instances[0];
  const source = context.sources[0];
  context.state = "interrupted";
  context.dispatchEvent(new Event("statechange"));
  assert.equal(engine.state.reason, "interrupted");
  assert.equal(engine.playing, false);
  assert.equal(source.disconnected, true);
  assert.equal(source.stops.at(-1), context.currentTime);
  await context.resume();
  assert.equal(engine.playing, false);
  assert.equal(context.sources.length, 1);
  await engine.dispose();
}));

test("a stale source completion cannot end its replacement", async () => withContext(async () => {
  const engine = new AudioEngine();
  await engine.playBuffer(pcm());
  const context = FakeAudioContext.instances[0];
  const first = context.sources[0];
  await engine.playBuffer(pcm(0.2));
  first.onended();
  assert.equal(engine.playing, true);
  assert.equal(engine.state.duration, 0.2);
  engine.setVolume(100);
  assert.equal(engine.volume, 1);
  assert.equal(context.gains[0].gain.value, MAX_MASTER_GAIN);
  engine.setVolume(-1);
  assert.equal(engine.volume, 0);
  await engine.dispose();
}));

test("malformed, non-finite, excessive and overlong PCM is rejected before scheduling", async () => withContext(async () => {
  const engine = new AudioEngine();
  const invalid = pcm();
  invalid.left[0] = NaN;
  await assert.rejects(engine.playBuffer(invalid), /finite/);
  const excessive = pcm();
  excessive.left[0] = 1;
  await assert.rejects(engine.playBuffer(excessive), /headroom/);
  await assert.rejects(engine.playBuffer(pcm(9)), /eight seconds/);
  await assert.rejects(engine.playBuffer({left: new Float32Array(10), right: new Float32Array(2), sampleRate: 48000}), /equal/);
  assert.equal(FakeAudioContext.instances[0].sources.length, 0);
  assert.equal(engine.playing, false);
  await engine.dispose();
}));
