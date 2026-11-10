// SPDX-License-Identifier: AGPL-3.0-only
// Speech-to-text for the observation note, on top of the browser's Web Speech
// API. The browser owns the microphone and the recognition service; this
// module only merges the recognised words into the note text.

export function recognitionClass(scope = globalThis) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

/** Append a recognised phrase to existing text with exactly one separator. */
export function joinText(base, piece) {
  const addition = String(piece ?? "").trim();
  if (!addition) return base;
  if (!base || /\s$/.test(base)) return base + addition;
  return `${base} ${addition}`;
}

export class Dictation {
  constructor({Recognition, lang = "en-US", limit = 1500, onText, onState, onError} = {}) {
    this.Recognition = Recognition || null;
    this.lang = lang;
    this.limit = limit;
    this.onText = onText || (() => {});
    this.onState = onState || (() => {});
    this.onError = onError || (() => {});
    this.session = null;
    this.base = "";
  }

  get supported() { return Boolean(this.Recognition); }
  get listening() { return Boolean(this.session); }

  /** Start listening; recognised words are appended to `text`. */
  start(text = "") {
    if (!this.supported || this.session) return false;
    const session = new this.Recognition();
    session.lang = this.lang;
    session.continuous = true;
    session.interimResults = true;
    session.maxAlternatives = 1;
    this.base = String(text).slice(0, this.limit);
    // Every handler checks that its session is still the current one, so a
    // late result from a cancelled session can never rewrite the note.
    session.onresult = event => {
      if (this.session !== session) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) this.base = joinText(this.base, transcript).slice(0, this.limit);
        else interim = joinText(interim, transcript);
      }
      this.onText(joinText(this.base, interim).slice(0, this.limit));
    };
    session.onerror = event => {
      if (this.session !== session) return;
      // "aborted" is our own cancel; "no-speech" just means silence.
      if (event.error !== "aborted") this.onError(event.error || "unknown");
    };
    session.onend = () => {
      if (this.session !== session) return;
      this.session = null;
      this.onText(this.base);
      this.onState(false);
    };
    this.session = session;
    try {
      session.start();
    } catch {
      this.session = null;
      this.onError("start-failed");
      return false;
    }
    this.onState(true);
    return true;
  }

  /** Stop listening and keep what the service still has to deliver. */
  stop() {
    try { this.session?.stop(); } catch { this.cancel(); }
  }

  /** Stop at once and ignore anything the service delivers afterwards. */
  cancel() {
    const session = this.session;
    if (!session) return;
    this.session = null;
    try { session.abort(); } catch { /* Already ended. */ }
    this.onState(false);
  }
}
