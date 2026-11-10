// SPDX-License-Identifier: AGPL-3.0-only
// AudioWorklet wrapper around LiveSynth. Runs on the audio thread.
import {LiveSynth} from "./live.js";

class HearingLabLive extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.synth = new LiveSynth(sampleRate, options?.processorOptions?.seed ?? 12345);
    this.sinceReport = 0;
    this.port.onmessage = event => {
      const message = event.data || {};
      try {
        if (message.type === "set") this.synth.set(message.id, message.params);
        else if (message.type === "stop") this.synth.stop();
      } catch { /* An invalid message leaves the current sound unchanged. */ }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output?.[0]) return !this.synth.done;
    const left = output[0], right = output[1] || new Float32Array(left.length);
    this.synth.process(left, right);
    this.sinceReport += left.length;
    if (this.sinceReport >= sampleRate / 20) {
      this.sinceReport = 0;
      this.port.postMessage(this.synth.info());
    }
    return !this.synth.done;
  }
}

registerProcessor("hearing-lab-live", HearingLabLive);
