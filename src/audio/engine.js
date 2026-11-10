// SPDX-License-Identifier: AGPL-3.0-only
import {clamp, renderExperiment} from "./dsp.js";
import {LiveSynth} from "./live.js";

export const MAX_MASTER_GAIN = 0.18;
export const DEFAULT_MASTER_GAIN = 0.08;
const HARD_STOPS = ["hidden", "pagehide", "interrupted", "suspended", "devicechange", "disposed"];

/**
 * Owns the audio context and the single thing currently sounding: either a
 * finite rendered clip (challenges, channel checks) or a continuous live synth
 * (the explore workbench). It never starts sound from its constructor.
 */
export class AudioEngine {
  constructor({onState} = {}) {
    this._onState = typeof onState === "function" ? onState : () => {};
    this._context = null;
    this._master = null;
    this._playback = null;
    this._volume = DEFAULT_MASTER_GAIN / MAX_MASTER_GAIN;
    this._generation = 0;
    this._state = {playing: false, reason: "idle", duration: 0, startedAt: null, rendered: null};
    this._liveBackend = null;
    this._cleanups = [];
    this._subscribers = new Set();
    const listen = (target, name, handler) => {
      if (!target?.addEventListener) return;
      target.addEventListener(name, handler);
      this._cleanups.push(() => target.removeEventListener(name, handler));
    };
    if (typeof document !== "undefined") listen(document, "visibilitychange", () => {
      if (document.hidden) this.stop("hidden");
    });
    if (typeof window !== "undefined") listen(window, "pagehide", () => this.stop("pagehide"));
    if (typeof navigator !== "undefined") listen(navigator.mediaDevices, "devicechange", () => this.stop("devicechange"));
  }

  get sampleRate() { return this._context?.sampleRate || 48000; }
  get state() { return this._state; }
  get current() { return this._playback?.rendered || null; }
  get volume() { return this._volume; }
  get playing() { return this._state.playing; }
  get live() { return Boolean(this._playback?.live); }

  /** Loop position of a cyclic live experiment, extrapolated between audio-thread reports. */
  get liveInfo() {
    const current = this._playback;
    if (!current?.live) return null;
    if (current.synth) return current.synth.info();
    const info = current.info;
    if (!info || info.cycle < 0) return info;
    const elapsed = (globalThis.performance?.now() ?? 0) - info.at;
    return {...info, cycle: (info.cycle + elapsed / 1000 / info.period) % 1};
  }

  _emit(state) {
    this._state = state;
    this._onState(state);
    for (const listener of this._subscribers) listener(state);
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("An audio state listener must be a function.");
    this._subscribers.add(listener);
    return () => this._subscribers.delete(listener);
  }

  async initializeFromUserGesture() {
    if (!this._context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error("This browser does not support Web Audio.");
      this._context = new Context({latencyHint: "interactive"});
      this._master = this._context.createGain();
      this._master.gain.value = this._volume * MAX_MASTER_GAIN;
      this._master.connect(this._context.destination);
      this._context.addEventListener("statechange", () => {
        if (this._context.state !== "running" && this._playback) this.stop(this._context.state === "interrupted" ? "interrupted" : "suspended");
      });
    }
    if (this._context.state === "closed") throw new Error("Audio has been closed. Reload the page to start again.");
    if (this._context.state !== "running") await this._context.resume();
    if (this._context.state !== "running") throw new Error("Audio is interrupted. Return to this page and press Play again.");
    return this._context;
  }

  async play(id, params = {}, options = {}) {
    const generation = ++this._generation;
    this._stopPlayback("replaced");
    try {
      await this.initializeFromUserGesture();
      if (generation !== this._generation) return this._state;
      const rendered = renderExperiment(id, params, this.sampleRate, options.seed ?? 12345);
      return this._start(rendered, generation);
    } catch (error) {
      if (generation === this._generation) this._emit({...this._state, playing: false, reason: "error", error: error.message});
      throw error;
    }
  }

  /** Resolves after scheduling playback; completion is delivered through onState. */
  async playBuffer(rendered) {
    const generation = ++this._generation;
    this._stopPlayback("replaced");
    try {
      await this.initializeFromUserGesture();
      if (generation !== this._generation) return this._state;
      return this._start(rendered, generation);
    } catch (error) {
      if (generation === this._generation) this._emit({...this._state, playing: false, reason: "error", error: error.message});
      throw error;
    }
  }

  /** Start continuous synthesis. It plays until stop(), an interruption, or a replacement. */
  async startLive(id, params = {}, options = {}) {
    const generation = ++this._generation;
    this._stopPlayback("replaced");
    try {
      const context = await this.initializeFromUserGesture();
      const backend = await this._prepareLive();
      if (generation !== this._generation) return this._state;
      const gain = context.createGain();
      gain.gain.value = 1;
      gain.connect(this._master);
      const current = {live: true, id, gain, generation, startedAt: context.currentTime, duration: Infinity, rendered: null, info: null};
      const message = {type: "set", id, params: JSON.parse(JSON.stringify(params))};
      if (backend === "worklet") {
        const node = new globalThis.AudioWorkletNode(context, "hearing-lab-live", {numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: {seed: options.seed ?? 12345}});
        node.port.onmessage = event => { current.info = {...event.data, at: globalThis.performance?.now() ?? 0}; };
        current.node = node;
        current.post = data => node.port.postMessage(data);
      } else {
        // Fallback for browsers that cannot load the worklet module: same synth, main thread.
        const synth = new LiveSynth(context.sampleRate, options.seed ?? 12345);
        const node = context.createScriptProcessor(1024, 0, 2);
        node.onaudioprocess = event => synth.process(event.outputBuffer.getChannelData(0), event.outputBuffer.getChannelData(1));
        current.node = node;
        current.synth = synth;
        current.post = data => { if (data.type === "set") synth.set(data.id, data.params); else synth.stop(); };
      }
      current.post(message);
      current.node.connect(gain);
      this._playback = current;
      this._emit({playing: true, reason: "playing", live: true, id, duration: Infinity, startedAt: current.startedAt, rendered: null});
      return this._state;
    } catch (error) {
      if (generation === this._generation) this._emit({...this._state, playing: false, reason: "error", error: error.message});
      throw error;
    }
  }

  /** Change the live sound without stopping it. Returns false when nothing live is playing. */
  updateLive(id, params = {}) {
    const current = this._playback;
    if (!current?.live) return false;
    current.post({type: "set", id, params: JSON.parse(JSON.stringify(params))});
    if (current.id !== id) { current.id = id; current.info = null; }
    return true;
  }

  _prepareLive() {
    if (!this._liveBackend) this._liveBackend = (async () => {
      const context = this._context;
      if (context.audioWorklet?.addModule && typeof globalThis.AudioWorkletNode === "function") {
        try {
          await context.audioWorklet.addModule(new URL("./live-worklet.js", import.meta.url).href);
          return "worklet";
        } catch { /* Fall through to the main-thread processor. */ }
      }
      if (typeof context.createScriptProcessor !== "function") throw new Error("This browser cannot run continuous audio.");
      return "script";
    })();
    return this._liveBackend;
  }

  _start(rendered, generation) {
    const {left, right, sampleRate} = rendered || {};
    if (!(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length || !left.length) throw new TypeError("Playback requires equal, non-empty Float32Array channels.");
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError("Invalid PCM sample rate.");
    const duration = left.length / sampleRate;
    if (duration > 8.001) throw new RangeError("Each playback must finish within eight seconds.");
    for (let i = 0; i < left.length; i++) {
      if (!Number.isFinite(left[i]) || !Number.isFinite(right[i]) || Math.abs(left[i]) > 0.95 || Math.abs(right[i]) > 0.95) throw new RangeError("PCM samples must be finite and within the digital headroom ceiling.");
    }
    const context = this._context;
    const buffer = context.createBuffer(2, left.length, sampleRate);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this._master);
    const startedAt = context.currentTime + 0.03;
    const current = {source, gain, rendered, generation, startedAt, duration};
    this._playback = current;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this._playback === current) {
        this._playback = null;
        this._emit({playing: false, reason: "ended", duration, startedAt, rendered});
      }
    };
    source.start(startedAt);
    source.stop(startedAt + duration);
    this._emit({playing: true, reason: "playing", duration, startedAt, rendered});
    return this._state;
  }

  setVolume(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return this._volume;
    this._volume = clamp(parsed, 0, 1);
    if (this._master) {
      const now = this._context.currentTime;
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setTargetAtTime(this._volume * MAX_MASTER_GAIN, now, 0.012);
    }
    return this._volume;
  }

  _stopPlayback(reason) {
    const current = this._playback;
    if (!current) return;
    this._playback = null;
    if (current.live) return this._stopLive(current, reason);
    const {source, gain, duration, startedAt, rendered} = current;
    const now = this._context.currentTime;
    const hardStop = HARD_STOPS.includes(reason) || this._context.state !== "running";
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    try {
      gain.gain.cancelScheduledValues(now);
      if (hardStop) {
        gain.gain.setValueAtTime(0, now);
        source.stop(now);
        source.disconnect();
        gain.disconnect();
      } else {
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.015);
        source.stop(now + 0.016);
      }
    } catch {
      source.disconnect();
      gain.disconnect();
    }
    this._emit({playing: false, reason, duration, startedAt, rendered});
  }

  _stopLive(current, reason) {
    const {node, gain, startedAt} = current;
    const now = this._context.currentTime;
    const release = () => { try { node.disconnect(); gain.disconnect(); if (node.port) node.port.onmessage = null; node.onaudioprocess = null; } catch { /* Already released. */ } };
    const hardStop = HARD_STOPS.includes(reason) || this._context.state !== "running";
    try {
      current.post({type: "stop"});
      gain.gain.cancelScheduledValues(now);
      if (hardStop) { gain.gain.setValueAtTime(0, now); release(); }
      else {
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.04);
        setTimeout(release, 120);
      }
    } catch { release(); }
    this._emit({playing: false, reason, live: true, id: current.id, duration: Infinity, startedAt, rendered: null});
  }

  stop(reason = "stopped") {
    ++this._generation;
    this._stopPlayback(reason);
  }

  async suspend() {
    this.stop("suspended");
    if (this._context?.state === "running") await this._context.suspend();
  }

  async dispose() {
    this.stop("disposed");
    for (const cleanup of this._cleanups) cleanup();
    this._cleanups.length = 0;
    this._subscribers.clear();
    if (this._context && this._context.state !== "closed") await this._context.close();
  }
}
