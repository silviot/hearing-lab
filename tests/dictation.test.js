// SPDX-License-Identifier: AGPL-3.0-only
import test from "node:test";
import assert from "node:assert/strict";
import {Dictation, joinText, recognitionClass} from "../src/ui/dictation.js";

class FakeRecognition {
  static last = null;
  constructor() { FakeRecognition.last = this; this.started = false; }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  abort() { this.aborted = true; }
  emit(...results) {
    this.onresult?.({resultIndex: 0, results: results.map(([transcript, isFinal]) => Object.assign([{transcript}], {isFinal}))});
  }
}

function setup(options = {}) {
  const log = {text: [], state: [], errors: []};
  const dictation = new Dictation({
    Recognition: FakeRecognition,
    lang: "it-IT",
    onText: text => log.text.push(text),
    onState: state => log.state.push(state),
    onError: error => log.errors.push(error),
    ...options,
  });
  return {dictation, log};
}

test("joinText separates phrases with one space", () => {
  assert.equal(joinText("", " hello "), "hello");
  assert.equal(joinText("I heard", "a beat"), "I heard a beat");
  assert.equal(joinText("I heard\n", "a beat"), "I heard\na beat");
  assert.equal(joinText("unchanged", "  "), "unchanged");
});

test("recognitionClass finds the prefixed constructor", () => {
  assert.equal(recognitionClass({webkitSpeechRecognition: FakeRecognition}), FakeRecognition);
  assert.equal(recognitionClass({}), null);
});

test("dictation appends final phrases and previews interim ones", () => {
  const {dictation, log} = setup();
  assert.equal(dictation.start("Typed first."), true);
  const session = FakeRecognition.last;
  assert.equal(session.lang, "it-IT");
  assert.equal(session.continuous, true);
  assert.deepEqual(log.state, [true]);
  session.emit(["the tone", false]);
  assert.equal(log.text.at(-1), "Typed first. the tone");
  session.emit(["the tone moved left", true], ["then", false]);
  assert.equal(log.text.at(-1), "Typed first. the tone moved left then");
  dictation.stop();
  // An unfinished interim phrase is dropped when the session ends.
  assert.equal(log.text.at(-1), "Typed first. the tone moved left");
  assert.deepEqual(log.state, [true, false]);
  assert.equal(dictation.listening, false);
});

test("dictation respects the note length limit", () => {
  const {dictation, log} = setup({limit: 12});
  dictation.start("0123456789");
  FakeRecognition.last.emit(["abcdef", true]);
  assert.equal(log.text.at(-1), "0123456789 a");
});

test("a cancelled session cannot rewrite the note", () => {
  const {dictation, log} = setup();
  dictation.start("");
  const session = FakeRecognition.last;
  dictation.cancel();
  assert.equal(session.aborted, true);
  const seen = log.text.length;
  session.emit(["late words", true]);
  session.onend();
  assert.equal(log.text.length, seen);
  assert.deepEqual(log.state, [true, false]);
});

test("dictation reports errors but not its own abort", () => {
  const {dictation, log} = setup();
  dictation.start("");
  FakeRecognition.last.onerror({error: "aborted"});
  FakeRecognition.last.onerror({error: "not-allowed"});
  assert.deepEqual(log.errors, ["not-allowed"]);
});

test("dictation without browser support does nothing", () => {
  const {dictation, log} = setup({Recognition: null});
  assert.equal(dictation.supported, false);
  assert.equal(dictation.start("x"), false);
  assert.deepEqual(log.state, []);
});
