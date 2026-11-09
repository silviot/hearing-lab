// SPDX-License-Identifier: AGPL-3.0-only
import {
  createAdaptiveState, applyAdaptiveResponse, adaptiveResult,
  createChallengeTrial, frequencySchedule, frequencyResult,
} from '../lib/challenges.js';

const COPY = {
  pitch: {
    title: 'Find the higher note', question: 'Which tone was higher?',
    description: 'Two notes, one small difference. Pick the higher note. The difference gets smaller as you find your rhythm.',
    detail: 'Three practice rounds, then up to 40 scored rounds. About 2–3 minutes. Guess when unsure; response speed does not matter.',
    labels: ['First tone', 'Second tone'],
  },
  gap: {
    title: 'Find the tiny silence', question: 'Which burst had a gap?',
    description: 'Listen to three short hisses. One has a tiny interruption in the middle. Find it as the silence shrinks.',
    detail: 'Up to 30 rounds. About 2 minutes. All bursts last the same amount of time; only the interruption changes.',
    labels: ['First burst', 'Second burst', 'Third burst'],
  },
  frequency: {
    title: 'Find the hidden tone', question: 'Which interval contained the tone?',
    description: 'Three intervals, one tone. Explore eight frequencies at a fixed playback level, with three tries at each.',
    detail: '24 rounds. About 1–2 minutes. Keep the volume unchanged. A missed high tone can reflect the headphones as well as your hearing.',
    labels: ['First interval', 'Second interval', 'Third interval'],
  },
};

const STYLES = `
.challenge-shell{color:var(--ink);width:100%}.challenge-card{border:1px solid var(--line);border-radius:14px;padding:clamp(18px,3vw,30px);background:var(--paper);max-width:820px;margin:0 auto}
.challenge-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}.challenge-card h3{font-size:clamp(21px,3vw,30px);line-height:1.2;margin:0 0 12px}.challenge-copy{line-height:1.65;margin:10px 0}.challenge-note{color:var(--muted);font-size:13px;line-height:1.6;margin:12px 0}.challenge-topline{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted);margin-bottom:12px}.challenge-progress{height:5px;width:100%;accent-color:var(--accent);margin:0 0 24px}.challenge-intervals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:24px 0 16px}.challenge-intervals[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}.challenge-choice{min-height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit;cursor:pointer;padding:15px 8px;transition:background .12s,border-color .12s}.challenge-choice span{font-size:22px;font-weight:600}.challenge-choice small{font-size:12px;color:var(--muted)}.challenge-choice:disabled{cursor:default;opacity:.65}.challenge-choice.challenge-active{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);opacity:1}.challenge-choice.challenge-correct{border-color:var(--accent);opacity:1}.challenge-choice:focus-visible,.challenge-button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.challenge-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px}.challenge-button{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;padding:10px 15px;min-height:44px;cursor:pointer;font:inherit;font-size:14px}.challenge-button.challenge-primary{background:var(--accent);color:#fff;border-color:var(--accent)}.challenge-button:disabled{opacity:.5;cursor:default}.challenge-feedback{min-height:46px;font-size:14px;line-height:1.55;margin:12px 0;color:var(--muted)}.challenge-metric{font-size:clamp(35px,6vw,60px);letter-spacing:-.04em;line-height:1.1;margin:24px 0 10px}.challenge-metric small{font-size:16px;letter-spacing:0;margin-left:6px;color:var(--muted)}.challenge-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}.challenge-table th,.challenge-table td{text-align:left;padding:10px 5px;border-bottom:1px solid var(--line)}.challenge-table th{font-size:12px;color:var(--muted);font-weight:500}.challenge-dots{letter-spacing:5px;color:var(--accent);white-space:nowrap}.challenge-error{color:var(--ink);border-left:3px solid var(--accent);padding-left:12px}.challenge-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
`;

function freshSeed() {
  if (globalThis.crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 4294967296);
}
function formatNumber(value, digits = 1) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}
function frequencyLabel(value) { return value >= 1000 ? `${formatNumber(value / 1000, 1)} kHz` : `${value} Hz`; }
function escapeText(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

/** Mount one self-contained challenge. Returned cleanup cancels pending audio. */
export function mountChallenge(container, { kind, engine, onSave, onChange } = {}) {
  if (!COPY[kind]) throw new RangeError(`Unknown challenge: ${kind}`);
  if (!engine?.playBuffer) throw new TypeError('An AudioEngine is required.');
  const copy = COPY[kind];
  let alive = true;
  let phase = 'intro';
  let adaptive = kind === 'frequency' ? null : createAdaptiveState(kind);
  let schedule = [];
  let records = [];
  let practiceRecords = [];
  let practiceIndex = 0;
  const practiceTotal = kind === 'pitch' ? 3 : 0;
  let currentTrial = null;
  let replayCount = 0;
  let feedback = '';
  let error = '';
  let result = null;
  let saved = false;
  let saving = false;
  let activeInterval = -1;
  let playbackGeneration = 0;
  let ignoreEngineStop = false;
  const timers = new Set();
  container.classList.add('challenge-shell');

  const notify = () => onChange?.({ kind, phase, playing: phase === 'playing' });
  const isPractice = () => practiceIndex < practiceTotal;
  const scoredCount = () => kind === 'frequency' ? records.length : adaptive.trials.length;
  const maximumCount = () => kind === 'frequency' ? schedule.length || 24 : adaptive.config.maxTrials;
  const isFinished = () => kind === 'frequency' ? records.length >= schedule.length : adaptive.stopped;

  function later(callback, delay) {
    const timer = setTimeout(() => { timers.delete(timer); if (alive) callback(); }, delay);
    timers.add(timer);
  }
  function clearTimers() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  }
  function stopPlayback() {
    playbackGeneration += 1;
    clearTimers();
    activeInterval = -1;
    ignoreEngineStop = true;
    engine.stop();
    ignoreEngineStop = false;
  }
  function focusAction(action) {
    queueMicrotask(() => { if (alive) container.querySelector(`[data-action="${action}"]`)?.focus(); });
  }
  function highlightInterval(index) {
    activeInterval = index;
    // Keep the controls mounted so interval highlights cannot steal keyboard focus.
    container.querySelectorAll('[data-action="answer"]').forEach(button => {
      button.classList.toggle('challenge-active', Number(button.dataset.index) === index);
    });
  }

  function resultMarkup() {
    let body;
    if (kind === 'frequency') {
      body = `<p class="challenge-copy">These are your observations at this playback level.</p><table class="challenge-table"><thead><tr><th scope="col">Frequency</th><th scope="col">Found</th><th scope="col">Your tries</th></tr></thead><tbody>${result.metrics.points.map(point => `<tr><th scope="row">${frequencyLabel(point.frequencyHz)}</th><td>${point.correct} / ${point.trials}</td><td class="challenge-dots" aria-label="${point.correct} correct out of ${point.trials}">${'●'.repeat(point.correct)}${'○'.repeat(point.trials - point.correct)}</td></tr>`).join('')}</tbody></table><p class="challenge-note">Guessing succeeds about one time in three. Three tries per frequency are a small sample: this does not establish a hearing threshold or your highest audible frequency. Headphones, fit, room noise and volume all matter.</p>`;
    } else {
      const value = kind === 'pitch' ? result.metrics.cents : result.metrics.gapMs;
      const label = kind === 'pitch' ? 'cents apart' : 'ms of silence';
      const status = result.status === 'estimate' ? 'Your estimate in this run'
        : result.status === 'boundary' ? 'The task reached a limit' : 'A provisional result';
      const explanation = result.status === 'boundary'
        ? `You reached the ${result.stopReason === 'lower-bound' ? 'finest' : 'easiest'} setting of this game. It cannot estimate a stable difference beyond that limit.`
        : value == null ? 'The answers did not settle enough for a useful number in this short run. You can try again when you feel ready.'
          : result.status === 'provisional' ? 'The round limit arrived before the full set of reversals. Treat this number as a rough observation, not a settled threshold.'
            : 'The game followed your answers toward a difference you could identify about 7 times in 10. A repeated run can give a different estimate.';
      body = `<p class="challenge-kicker">${status}</p>${value == null ? '' : `<div class="challenge-metric">${formatNumber(value, value < 10 ? 2 : 1)}<small>${label}</small></div>`}<p class="challenge-copy">${explanation}</p>${kind === 'pitch' && value != null ? `<p class="challenge-note">That is approximately ${formatNumber(result.metrics.differenceHz, 2)} Hz around a 1,000 Hz note. There are 100 cents in one equal-tempered semitone.</p>` : ''}${kind === 'gap' ? '<p class="challenge-note">The gap is the fully silent part. Two 0.5 ms tapers soften its edges; every burst keeps the same overall length.</p>' : ''}<p class="challenge-note">${result.trials.length} scored rounds · ${result.reversals.length} direction changes · ${result.trials.reduce((sum, trial) => sum + (trial.replays || 0), 0)} replays. This is a short listening experiment, not a hearing-health score.</p>`;
    }
    return `${body}${result.volumeChanged ? '<p class="challenge-note challenge-error">The playback volume changed during this run. For a consistent comparison, repeat with one comfortable setting.</p>' : ''}<div class="challenge-actions"><button type="button" class="challenge-button challenge-primary" data-action="save" ${saved || saving ? 'disabled' : ''}>${saved ? 'Result saved' : saving ? 'Saving…' : 'Save result'}</button><button type="button" class="challenge-button" data-action="restart">Try again</button></div>`;
  }

  function render() {
    if (!alive) return;
    let body;
    if (phase === 'intro') {
      body = `<p class="challenge-copy">${copy.description}</p><p class="challenge-note">${copy.detail}</p><p class="challenge-note">Use headphones at a quiet, comfortable volume. Keep that setting for the run.</p><div class="challenge-actions"><button type="button" class="challenge-button challenge-primary" data-action="start">${practiceTotal ? 'Start with practice' : 'Start listening'}</button></div>`;
    } else if (phase === 'result') {
      body = resultMarkup();
    } else {
      const practice = isPractice();
      const count = phase === 'feedback' ? scoredCount() : scoredCount() + 1;
      const top = currentTrial?.meta.practice
        ? `Practice ${Math.min(practiceIndex + (phase === 'feedback' ? 0 : 1), practiceTotal)} of ${practiceTotal}`
        : `Round ${count} · ${kind === 'frequency' ? maximumCount() : `up to ${maximumCount()}`}`;
      const message = phase === 'playing' ? 'Listen first. The choices unlock after playback.'
        : phase === 'answer' ? `Choose ${copy.labels.length === 2 ? '1 or 2' : '1, 2 or 3'} with the keyboard, or tap a card. Guess if unsure.`
          : phase === 'paused' ? 'Playback stopped. Replay this round before answering.' : feedback;
      const complete = !practice && phase === 'feedback' && isFinished();
      body = `<div class="challenge-topline"><span>${top}</span><span>${currentTrial?.meta.practice ? 'Not scored' : kind === 'frequency' ? 'Fixed playback level' : 'Adaptive difficulty'}</span></div><progress class="challenge-progress" max="${maximumCount()}" value="${scoredCount()}" aria-label="Scored rounds completed"></progress><p class="challenge-copy">${copy.question}</p><div class="challenge-intervals" data-count="${copy.labels.length}">${copy.labels.map((label, index) => `<button type="button" class="challenge-choice${activeInterval === index ? ' challenge-active' : ''}${phase === 'feedback' && currentTrial.meta.correctIndex === index ? ' challenge-correct' : ''}" data-action="answer" data-index="${index}" ${phase === 'answer' ? '' : 'disabled'}><span>${index + 1}</span><small>${label}</small></button>`).join('')}</div><p class="challenge-feedback" role="status" aria-live="polite">${message}</p><div class="challenge-actions">${phase === 'playing' ? '<button type="button" class="challenge-button" data-action="stop">Stop playback</button>' : phase === 'feedback' ? `<button type="button" class="challenge-button challenge-primary" data-action="next">${complete ? 'See your result' : currentTrial.meta.practice && !practice ? 'Start scored rounds' : 'Next round'}</button>` : '<button type="button" class="challenge-button" data-action="replay">Replay this round</button>'}<button type="button" class="challenge-button" data-action="restart">Restart</button></div>`;
    }
    container.innerHTML = `<style>${STYLES}</style><section class="challenge-card" aria-label="${copy.title}"><p class="challenge-kicker">Listening challenge</p><h3>${copy.title}</h3>${body}${error ? `<p class="challenge-note challenge-error" role="alert">${escapeText(error)}</p>` : ''}</section>`;
  }

  function finishPlayback() {
    if (!alive || phase !== 'playing') return;
    const focusWasInChallenge = container.contains(document.activeElement)
      || document.activeElement === document.body;
    clearTimers();
    activeInterval = -1;
    phase = 'answer';
    render();
    notify();
    if (focusWasInChallenge) focusAction('answer');
  }

  async function playCurrent() {
    const generation = ++playbackGeneration;
    clearTimers();
    error = '';
    phase = 'playing';
    activeInterval = -1;
    render();
    notify();
    focusAction('stop');
    try {
      // playBuffer resolves when scheduled, not when the samples finish.
      ignoreEngineStop = true;
      currentTrial.meta.masterVolume = engine.volume;
      const playback = await engine.playBuffer(currentTrial);
      ignoreEngineStop = false;
      if (!alive || generation !== playbackGeneration) return;
      if (phase !== 'playing') return;
      if (playback?.playing === false) {
        phase = 'paused';
        render(); notify();
        return;
      }
      for (let index = 0; index < currentTrial.meta.intervals.length; index += 1) {
        const interval = currentTrial.meta.intervals[index];
        later(() => { if (phase === 'playing') highlightInterval(index); }, (interval.start + 0.03) * 1000);
        later(() => { if (phase === 'playing') highlightInterval(-1); }, (interval.start + interval.duration + 0.03) * 1000);
      }
      later(finishPlayback, currentTrial.duration * 1000 + 70);
    } catch (cause) {
      ignoreEngineStop = false;
      if (!alive || generation !== playbackGeneration) return;
      clearTimers();
      phase = 'paused';
      error = cause?.message || 'Playback could not start. Try the replay button.';
      render();
      notify();
    }
  }

  function nextTrial() {
    const practice = isPractice();
    const sampleRate = engine.sampleRate || 48000;
    const value = kind === 'frequency' ? schedule[records.length]
      : practice ? [200, 100, 60][practiceIndex] : adaptive.value;
    currentTrial = createChallengeTrial(kind, { value, sampleRate, seed: freshSeed() });
    currentTrial.meta.practice = practice;
    replayCount = 0;
    playCurrent();
  }

  function answer(index) {
    if (phase !== 'answer' || index < 0 || index >= copy.labels.length) return;
    const correct = index === currentTrial.meta.correctIndex;
    const detail = {
      selectedIndex: index, correctIndex: currentTrial.meta.correctIndex,
      replays: replayCount, seed: currentTrial.meta.seed,
      masterVolume: currentTrial.meta.masterVolume,
      masterVolumeEnd: engine.volume,
    };
    if (currentTrial.meta.practice) {
      practiceRecords.push({ ...detail, parameter: currentTrial.meta.parameter, correct });
      practiceIndex += 1;
    } else if (kind === 'frequency') {
      records.push({ ...detail, index: records.length + 1, frequencyHz: currentTrial.meta.parameter, correct });
    } else {
      adaptive = applyAdaptiveResponse(adaptive, correct, detail);
    }
    feedback = correct ? 'Found it.' : `It was ${copy.labels[currentTrial.meta.correctIndex].toLowerCase()}.`;
    if (currentTrial.meta.practice) feedback += ' This round does not count toward your result.';
    else if (kind === 'frequency') feedback += ` ${frequencyLabel(currentTrial.meta.parameter)} at the same playback level.`;
    else feedback += ' The next difference follows your answers.';
    phase = 'feedback';
    render();
    notify();
    focusAction('next');
  }

  function reset() {
    stopPlayback();
    phase = 'intro';
    adaptive = kind === 'frequency' ? null : createAdaptiveState(kind);
    records = []; practiceRecords = []; schedule = []; practiceIndex = 0;
    currentTrial = null; result = null; saved = false; saving = false; error = '';
    render(); notify(); focusAction('start');
  }

  async function action(event) {
    const button = event.target.closest?.('button[data-action]');
    if (!button || !container.contains(button) || button.disabled) return;
    const name = button.dataset.action;
    if (name === 'start') {
      schedule = frequencySchedule(freshSeed(), 3, engine.sampleRate || 48000);
      nextTrial();
    } else if (name === 'answer') answer(Number(button.dataset.index));
    else if (name === 'replay') { replayCount += 1; playCurrent(); }
    else if (name === 'stop') { stopPlayback(); phase = 'paused'; render(); notify(); focusAction('replay'); }
    else if (name === 'restart') reset();
    else if (name === 'next') {
      if (!isPractice() && isFinished()) {
        result = kind === 'frequency' ? frequencyResult(records) : adaptiveResult(adaptive);
        result.practiceTrials = practiceRecords.map(item => ({ ...item }));
        result.sampleRate = currentTrial.sampleRate;
        result.volumeChanged = new Set(result.trials.flatMap(trial => [trial.masterVolume, trial.masterVolumeEnd])).size > 1;
        if (result.volumeChanged) result.notes.push('The playback volume changed during this run; fixed-level frequency comparisons are not consistent.');
        phase = 'result'; render(); notify(); focusAction('save');
      } else nextTrial();
    } else if (name === 'save' && result && !saved) {
      const savingResult = result;
      saving = true; error = ''; render();
      try {
        const outcome = await onSave?.(savingResult);
        if (outcome === false) throw new Error('This result could not be saved.');
        if (alive && result === savingResult) saved = true;
      } catch (cause) {
        if (alive && result === savingResult) error = cause?.message || 'This result could not be saved.';
      } finally {
        if (alive && result === savingResult) { saving = false; render(); focusAction(saved ? 'restart' : 'save'); }
      }
    }
  }

  function keydown(event) {
    if (event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (phase === 'answer' && !event.altKey && !event.ctrlKey && !event.metaKey && /^[123]$/.test(event.key)) {
      event.preventDefault(); answer(Number(event.key) - 1);
    }
  }

  const unsubscribe = typeof engine.subscribe === 'function' ? engine.subscribe(state => {
    if (!alive || ignoreEngineStop || phase !== 'playing' || state.playing !== false) return;
    if (state.rendered && state.rendered !== currentTrial) return;
    if (state.reason === 'ended') finishPlayback();
    else {
      playbackGeneration += 1; clearTimers(); activeInterval = -1;
      phase = 'paused'; render(); notify();
    }
  }) : null;

  container.addEventListener('click', action);
  container.addEventListener('keydown', keydown);
  render();
  return () => {
    if (!alive) return;
    alive = false;
    unsubscribe?.();
    stopPlayback();
    container.removeEventListener('click', action);
    container.removeEventListener('keydown', keydown);
    container.classList.remove('challenge-shell');
    container.replaceChildren();
  };
}
