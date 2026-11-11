// SPDX-License-Identifier: AGPL-3.0-only
import {
  createAdaptiveState, applyAdaptiveResponse, adaptiveResult,
  createChallengeTrial, frequencySchedule, frequencyResult,
} from '../lib/challenges.js';
import { staircaseChart, frequencyMapChart } from './visuals.js';
import { t, tRaw, getLanguage } from '../i18n/index.js';

const KINDS = new Set(['pitch', 'gap', 'frequency']);

const INTERVAL_WAVE = `<svg class="challenge-wave" viewBox="0 0 64 22" aria-hidden="true"><path d="M4 11h8l4-7 6 14 6-14 6 14 6-14 4 7h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STYLES = `
.challenge-shell{color:var(--ink);width:100%}.challenge-card{border:1px solid var(--line);border-radius:14px;padding:clamp(20px,3vw,32px);background:var(--paper);max-width:860px;margin:0 auto}
.challenge-kicker{font-size:11px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}.challenge-card h3{font-size:clamp(22px,3vw,30px);line-height:1.2;margin:0 0 12px}.challenge-copy{line-height:1.65;margin:10px 0;font-size:14.5px}.challenge-note{color:var(--muted);font-size:13px;line-height:1.65;margin:12px 0}.challenge-topline{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted);margin-bottom:10px}.challenge-progress{height:6px;width:100%;accent-color:var(--accent);margin:0 0 22px;border-radius:99px;overflow:hidden}.challenge-intervals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0 16px}.challenge-intervals[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}.challenge-choice{min-height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1.5px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);font:inherit;cursor:pointer;padding:16px 10px;transition:transform .14s,background .14s,border-color .14s,box-shadow .14s;position:relative}.challenge-choice:not(:disabled):hover{border-color:#96b08c;background:#f7faf2;transform:translateY(-2px);box-shadow:0 6px 16px #1938290d}.challenge-choice span{font-size:22px;font-weight:650;line-height:1}.challenge-choice small{font-size:12.5px;color:var(--muted)}.challenge-choice .challenge-wave{width:52px;height:18px;color:#7a9470;opacity:.45;transition:opacity .15s,transform .15s,color .15s}.challenge-choice:disabled{cursor:default;opacity:.72}.challenge-choice.challenge-active{border-color:var(--accent);background:#e6f0de;box-shadow:0 0 0 2px var(--accent),0 8px 20px #294d371a;opacity:1;transform:translateY(-2px)}.challenge-choice.challenge-active .challenge-wave{opacity:1;color:var(--accent);transform:scale(1.1)}.challenge-choice.challenge-correct{border-color:var(--accent);background:#eaf3e2;opacity:1}.challenge-choice.challenge-wrong{border-color:#c97b63;background:#fbf0ec;opacity:.9}.challenge-choice:focus-visible,.challenge-button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.challenge-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px}.challenge-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;padding:10px 16px;min-height:42px;cursor:pointer;font:inherit;font-size:13.5px;font-weight:550;transition:background .15s,border-color .15s}.challenge-button kbd{font:600 10.5px ui-monospace,monospace;padding:1px 6px;border-radius:4px;border:1px solid #cedac2;background:#f2f6eb;color:#4f6845;line-height:1.4}.challenge-button:hover:not(:disabled){background:#eef3e6;border-color:#b8caa8}.challenge-button.challenge-primary{background:var(--accent);color:#fff;border-color:var(--accent)}.challenge-button.challenge-primary kbd{border-color:#ffffff45;background:#ffffff24;color:#fff}.challenge-button.challenge-primary:hover:not(:disabled){background:#3a6b56}.challenge-button:disabled{opacity:.5;cursor:default}.challenge-saved{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:550;color:#2f5e41;background:#eaf3e2;border:1px solid #c6dbba;border-radius:99px;padding:8px 14px}.challenge-feedback{min-height:46px;font-size:14px;line-height:1.55;margin:12px 0;padding:10px 14px;border-radius:8px;background:#f3f6ec;color:var(--ink)}.challenge-metric{font-size:clamp(36px,6vw,58px);letter-spacing:-.04em;line-height:1.1;margin:18px 0 10px;color:#234233;font-weight:600}.challenge-metric small{font-size:16px;letter-spacing:0;margin-inline-start:8px;color:var(--muted);font-weight:450}.challenge-table{width:100%;border-collapse:collapse;margin:18px 0;font-size:13.5px}.challenge-table th,.challenge-table td{text-align:start;padding:10px 6px;border-bottom:1px solid var(--line)}.challenge-table th{font-size:12px;color:var(--muted);font-weight:600}.challenge-dots{letter-spacing:5px;color:var(--accent);white-space:nowrap}.challenge-error{color:var(--ink);border-inline-start:3px solid #c0563b;padding-inline-start:12px}.challenge-chart-wrap{margin:18px 0;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:#f8faf3}.challenge-chart-legend{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:8px}.challenge-chart-legend span{display:inline-flex;align-items:center;gap:5px}.challenge-chart{width:100%;height:auto;display:block;color:var(--ink)}.dot-correct,.dot-miss,.dot-rev{width:8px;height:8px;border-radius:50%;display:inline-block}.dot-correct{background:#315d4b}.dot-miss{border:2px solid #b85d43;background:#fffefa}.dot-rev{border:2px solid #c98a3b}
`;

function freshSeed() {
  if (globalThis.crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 4294967296);
}
function formatNumber(value, digits = 1) {
  return Number(value).toLocaleString(getLanguage(), { maximumFractionDigits: digits });
}
function frequencyLabel(value) { return value >= 1000 ? `${formatNumber(value / 1000, 1)} kHz` : `${value} Hz`; }
function escapeText(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

function challengeCopy(kind) {
  const labels = tRaw(`challenges.${kind}.labels`);
  return {
    title: t(`challenges.${kind}.title`),
    question: t(`challenges.${kind}.question`),
    description: t(`challenges.${kind}.description`),
    detail: t(`challenges.${kind}.detail`),
    labels: Array.isArray(labels) ? labels : ['1', '2', '3'],
  };
}

/** Mount one self-contained challenge. Returned cleanup cancels pending audio. */
export function mountChallenge(container, { kind, engine, onSave, onChange } = {}) {
  if (!KINDS.has(kind)) throw new RangeError(`Unknown challenge: ${kind}`);
  if (!engine?.playBuffer) throw new TypeError('An AudioEngine is required.');
  let alive = true;
  let phase = 'intro';
  let adaptive = kind === 'frequency' ? null : createAdaptiveState(kind);
  let schedule = [];
  let records = [];
  let practiceRecords = [];
  let practiceIndex = 0;
  const practiceTotal = kind === 'pitch' ? 3 : 0;
  let currentTrial = null;
  let lastSelectedIndex = -1;
  let lastFocusedChoice = 0;
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
      body = `<p class="challenge-copy">${escapeText(t('challenges.freqObservations'))}</p>${frequencyMapChart(result.metrics.points)}<table class="challenge-table"><thead><tr><th scope="col">${escapeText(t('challenges.colFrequency'))}</th><th scope="col">${escapeText(t('challenges.colFound'))}</th><th scope="col">${escapeText(t('challenges.colTries'))}</th></tr></thead><tbody>${result.metrics.points.map(point => `<tr><th scope="row">${escapeText(frequencyLabel(point.frequencyHz))}</th><td>${point.correct} / ${point.trials}</td><td class="challenge-dots" aria-label="${escapeText(t('challenges.correctOutOf', { correct: point.correct, trials: point.trials }))}">${'●'.repeat(point.correct)}${'○'.repeat(point.trials - point.correct)}</td></tr>`).join('')}</tbody></table><p class="challenge-note">${escapeText(t('challenges.freqDisclaimer'))}</p>`;
    } else {
      const value = kind === 'pitch' ? result.metrics.cents : result.metrics.gapMs;
      const label = kind === 'pitch' ? t('challenges.centsApart') : t('challenges.msSilence');
      const status = result.status === 'estimate' ? t('challenges.statusEstimate')
        : result.status === 'boundary' ? t('challenges.statusBoundary') : t('challenges.statusProvisional');
      const explanation = result.status === 'boundary'
        ? t(result.stopReason === 'lower-bound' ? 'challenges.expBoundaryFinest' : 'challenges.expBoundaryEasiest')
        : value == null ? t('challenges.expNoSettle')
          : result.status === 'provisional' ? t('challenges.expProvisional')
            : t('challenges.expEstimate');
      const replays = result.trials.reduce((sum, trial) => sum + (trial.replays || 0), 0);
      body = `<p class="challenge-kicker">${escapeText(status)}</p>${value == null ? '' : `<div class="challenge-metric">${escapeText(formatNumber(value, value < 10 ? 2 : 1))}<small>${escapeText(label)}</small></div>`}<p class="challenge-copy">${escapeText(explanation)}</p>${staircaseChart(result.trials, result.reversals, kind)}${kind === 'pitch' && value != null ? `<p class="challenge-note">${escapeText(t('challenges.pitchHzNote', { hz: formatNumber(result.metrics.differenceHz, 2) }))}</p>` : ''}${kind === 'gap' ? `<p class="challenge-note">${escapeText(t('challenges.gapTaperNote'))}</p>` : ''}<p class="challenge-note">${escapeText(t('challenges.summaryStats', { trials: result.trials.length, reversals: result.reversals.length, replays }))}</p>`;
    }
    const saveControl = saved
      ? `<span class="challenge-saved" role="status">✓ ${escapeText(t('challenges.resultSaved'))}</span>`
      : `<button type="button" class="challenge-button challenge-primary" data-action="save" ${saving ? 'disabled' : ''}>${escapeText(saving ? t('challenges.saving') : t('challenges.saveResult'))}</button>`;
    return `${body}${result.volumeChanged ? `<p class="challenge-note challenge-error">${escapeText(t('challenges.volumeChangedWarn'))}</p>` : ''}<div class="challenge-actions">${saveControl}<button type="button" class="challenge-button${saved ? ' challenge-primary' : ''}" data-action="restart">${escapeText(t('challenges.tryAgain'))}</button></div>`;
  }

  function render() {
    if (!alive) return;
    const copy = challengeCopy(kind);
    let body;
    if (phase === 'intro') {
      body = `<p class="challenge-copy">${escapeText(copy.description)}</p><p class="challenge-note">${escapeText(copy.detail)}</p><p class="challenge-note">${escapeText(t('challenges.useHeadphones'))}</p><div class="challenge-actions"><button type="button" class="challenge-button challenge-primary" data-action="start">${escapeText(practiceTotal ? t('challenges.startPractice') : t('challenges.startListening'))}</button></div>`;
    } else if (phase === 'result') {
      body = resultMarkup();
    } else {
      const practice = isPractice();
      const count = phase === 'feedback' ? scoredCount() : scoredCount() + 1;
      const top = currentTrial?.meta.practice
        ? t('challenges.practiceOf', { current: Math.min(practiceIndex + (phase === 'feedback' ? 0 : 1), practiceTotal), total: practiceTotal })
        : t('challenges.roundOf', { current: count, max: kind === 'frequency' ? maximumCount() : t('challenges.upTo', { max: maximumCount() }) });
      const message = phase === 'playing' ? t('challenges.listenFirst')
        : phase === 'answer' ? t(copy.labels.length === 2 ? 'challenges.choose2' : 'challenges.choose3')
          : phase === 'paused' ? t('challenges.pausedMsg') : feedback;
      const complete = !practice && phase === 'feedback' && isFinished();
      const modeTag = currentTrial?.meta.practice ? t('challenges.notScored') : kind === 'frequency' ? t('challenges.fixedLevel') : t('challenges.adaptiveDiff');
      const nextBtnText = complete ? t('challenges.seeResult') : currentTrial.meta.practice && !practice ? t('challenges.startScored') : t('challenges.nextRound');
      body = `<div class="challenge-topline"><span>${escapeText(top)}</span><span>${escapeText(modeTag)}</span></div><progress class="challenge-progress" max="${maximumCount()}" value="${scoredCount()}" aria-label="${escapeText(t('challenges.scoredAria'))}"></progress><p class="challenge-copy">${escapeText(copy.question)}</p><div class="challenge-intervals" data-count="${copy.labels.length}">${copy.labels.map((label, index) => {
        const isCorrect = phase === 'feedback' && currentTrial.meta.correctIndex === index;
        const isWrong = phase === 'feedback' && lastSelectedIndex === index && !isCorrect;
        return `<button type="button" class="challenge-choice${activeInterval === index ? ' challenge-active' : ''}${isCorrect ? ' challenge-correct' : ''}${isWrong ? ' challenge-wrong' : ''}" data-action="answer" data-index="${index}" aria-keyshortcuts="${index + 1}" ${phase === 'answer' ? '' : 'disabled'}>${INTERVAL_WAVE}<span>${index + 1}</span><small>${escapeText(label)}</small></button>`;
      }).join('')}</div><p class="challenge-feedback" role="status" aria-live="polite">${escapeText(message)}</p><div class="challenge-actions">${phase === 'playing' ? `<button type="button" class="challenge-button" data-action="stop">${escapeText(t('challenges.stopPlayback'))}</button>` : phase === 'feedback' ? `<button type="button" class="challenge-button challenge-primary" data-action="next">${escapeText(nextBtnText)}</button>` : `<button type="button" class="challenge-button" data-action="replay" aria-keyshortcuts="R">${escapeText(t('challenges.replayRound'))} <kbd dir="ltr">R</kbd></button>`}<button type="button" class="challenge-button" data-action="restart">${escapeText(t('challenges.restart'))}</button></div>`;
    }
    container.innerHTML = `<style>${STYLES}</style><section class="challenge-card" aria-label="${escapeText(copy.title)}"><p class="challenge-kicker">${escapeText(t('challenges.kicker'))}</p><h3>${escapeText(copy.title)}</h3>${body}${error ? `<p class="challenge-note challenge-error" role="alert">${escapeText(error)}</p>` : ''}</section>`;
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
      error = cause?.message || t('challenges.playbackError');
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
    lastSelectedIndex = -1;
    lastFocusedChoice = 0;
    replayCount = 0;
    playCurrent();
  }

  function answer(index) {
    const copy = challengeCopy(kind);
    if (phase !== 'answer' || index < 0 || index >= copy.labels.length) return;
    lastSelectedIndex = index;
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
    const rawLabel = copy.labels[currentTrial.meta.correctIndex] || '';
    const formattedLabel = getLanguage() === 'de' ? rawLabel : rawLabel.toLowerCase();
    feedback = correct ? t('challenges.foundIt') : t('challenges.itWas', { label: formattedLabel });
    if (currentTrial.meta.practice) feedback += t('challenges.practiceNote');
    else if (kind === 'frequency') feedback += t('challenges.sameLevelAt', { freq: frequencyLabel(currentTrial.meta.parameter) });
    else feedback += t('challenges.nextFollows');
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
    currentTrial = null; lastSelectedIndex = -1; result = null; saved = false; saving = false; error = '';
    render(); notify(); focusAction('start');
  }

  async function persistResult() {
    if (!result || saved || saving) return;
    if (!onSave) { saved = true; render(); focusAction('restart'); return; }
    const savingResult = result;
    saving = true; error = ''; render();
    try {
      const outcome = await onSave(savingResult);
      if (outcome === false) throw new Error(t('challenges.saveError'));
      if (alive && result === savingResult) saved = true;
    } catch (cause) {
      if (alive && result === savingResult) error = cause?.message || t('challenges.saveError');
    } finally {
      if (alive && result === savingResult) { saving = false; render(); focusAction(saved ? 'restart' : 'save'); }
    }
  }

  async function advanceFromFeedback() {
    if (!isPractice() && isFinished()) {
      result = kind === 'frequency' ? frequencyResult(records) : adaptiveResult(adaptive);
      result.practiceTrials = practiceRecords.map(item => ({ ...item }));
      result.sampleRate = currentTrial.sampleRate;
      result.volumeChanged = new Set(result.trials.flatMap(trial => [trial.masterVolume, trial.masterVolumeEnd])).size > 1;
      if (result.volumeChanged) result.notes.push('The playback volume changed during this run; fixed-level frequency comparisons are not consistent.');
      phase = 'result'; notify();
      await persistResult();
    } else nextTrial();
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
    else if (name === 'next') await advanceFromFeedback();
    else if (name === 'save' && result && !saved) await persistResult();
  }

  function keydown(event) {
    if (!alive || event.defaultPrevented) return;
    if (globalThis.document?.querySelector?.('dialog[open]')) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    if (phase === 'answer' && /^[123]$/.test(event.key)) {
      const idx = Number(event.key) - 1;
      if (idx < challengeCopy(kind).labels.length) {
        event.preventDefault();
        answer(idx);
      }
      return;
    }

    if ((phase === 'answer' || phase === 'paused') && (event.key === 'r' || event.key === 'R' || event.code === 'KeyR')) {
      event.preventDefault();
      replayCount += 1;
      playCurrent();
      return;
    }

    if (phase === 'feedback' && (event.key === 'Enter' || event.key === ' ') && !event.target?.closest?.('button, a, summary')) {
      event.preventDefault();
      advanceFromFeedback();
      return;
    }

    if (/^Arrow(?:Left|Right|Up|Down)$/.test(event.key)) {
      const choices = [...container.querySelectorAll('button[data-action="answer"]:not(:disabled)')];
      const actions = [...container.querySelectorAll('.challenge-actions button:not(:disabled)')];
      const activeEl = globalThis.document?.activeElement;
      const choiceIdx = choices.indexOf(activeEl);
      const actionIdx = actions.indexOf(activeEl);
      const rtl = globalThis.document?.documentElement?.dir === 'rtl';
      if (choiceIdx !== -1) {
        lastFocusedChoice = choiceIdx;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          const delta = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
          const nextIdx = (choiceIdx + delta + choices.length) % choices.length;
          lastFocusedChoice = nextIdx;
          event.preventDefault();
          choices[nextIdx]?.focus();
        } else if (event.key === 'ArrowDown' && actions.length) {
          event.preventDefault();
          actions[0].focus();
        }
      } else if (actionIdx !== -1) {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          const delta = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
          event.preventDefault();
          actions[(actionIdx + delta + actions.length) % actions.length]?.focus();
        } else if (event.key === 'ArrowUp' && choices.length) {
          event.preventDefault();
          choices[Math.min(lastFocusedChoice, choices.length - 1)]?.focus();
        }
      }
    }
  }

  const unsubscribe = typeof engine.subscribe === 'function' ? engine.subscribe(state => {
    if (!alive || ignoreEngineStop || phase !== 'playing' || state.playing !== false) return;
    if (state.rendered && state.rendered !== currentTrial) return;
    if (state.reason === 'ended') finishPlayback();
    else {
      playbackGeneration += 1; clearTimers(); activeInterval = -1;
      phase = 'paused'; render(); notify(); focusAction('replay');
    }
  }) : null;

  const keyTarget = globalThis.document || container;
  container.addEventListener('click', action);
  keyTarget.addEventListener('keydown', keydown);
  render();
  return () => {
    if (!alive) return;
    alive = false;
    unsubscribe?.();
    stopPlayback();
    container.removeEventListener('click', action);
    keyTarget.removeEventListener('keydown', keydown);
    container.classList.remove('challenge-shell');
    container.replaceChildren();
  };
}
