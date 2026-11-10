// SPDX-License-Identifier: AGPL-3.0-only
import { AudioEngine } from './audio/engine.js';
import { renderExperiment } from './audio/dsp.js';
import { experiments, byId, categories } from './lib/catalog.js';
import { readNotes, saveNote, removeNote, downloadNotes, readPreferences, savePreferences, escapeHtml as esc } from './lib/notebook.js';
import { icon, heroScope, cardVisual, signalScope, spectrumView } from './ui/visuals.js';
import { mountChallenge } from './ui/challenges.js';
import { picture } from './ui/pictures.js';

const app = document.querySelector('#app');
let prefs = readPreferences();
let active = 'explore', category = 'All experiments', query = '', cleanupChallenge = null, animation = null, previewFrame = null, shownPitchClass = 0, currentMode = 'explore';
const settings = Object.fromEntries(experiments.map(e => [e.id, structuredClone(e.defaults)]));
const visited = new Set(Array.isArray(prefs.explored) ? prefs.explored : []);
const engine = new AudioEngine({ onState: audioState });
engine.setVolume(Number.isFinite(prefs.volume) ? Math.min(1, Math.max(0, prefs.volume)) : .35);

function shell() {
  app.innerHTML = `<aside class="sidebar" aria-label="Main navigation">
    <button class="mobile-nav-close icon-button" data-action="menu" aria-label="Close navigation">${icon('close')}</button><a href="#explore" class="brand" aria-label="Hearing Lab home"><span class="brand-mark">${icon('waves')}</span><span>hearing<span class="brand-light">lab</span><small>AN OPEN AUDIO PLAYGROUND</small></span></a>
    <div class="sidebar-section">YOUR LAB</div>
    <nav class="primary-nav"><a href="#explore" data-page="explore">${icon('grid')}<span>Explore</span><span class="nav-count">11</span></a><a href="#notebook" data-page="notebook">${icon('book')}<span>Notebook</span><span id="note-count" class="nav-count">${readNotes().length}</span></a></nav>
    <div class="sidebar-section experiments-label">EXPERIMENTS</div>
    <nav class="experiment-nav">${experiments.map(e => `<a href="#${e.id}" data-page="${e.id}"><span class="experiment-num">${e.number}</span><span>${e.title}</span><span class="nav-dot ${visited.has(e.id) ? 'visited' : ''}"></span></a>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="lab-note">Curiosity sounds good.</div><a href="#about">${icon('info')} About this lab ${icon('arrow')}</a><a href="./hearing-lab-source.tar.gz" download class="source-link">Download source <span>↓</span></a><div class="sidebar-meta"><span class="status-dot"></span> LOCAL AUDIO · NO TRACKING</div></div>
  </aside>
  <div class="main-shell"><header class="topbar"><button class="icon-button menu-button" data-action="menu" aria-label="Open navigation">${icon('menu')}</button><div class="breadcrumb"><span>Hearing Lab</span><span>/</span><strong id="breadcrumb-current">Explore</strong></div><div class="topbar-actions"><button class="setup-chip" data-action="setup">${icon('headphones')}<span>Listening setup</span><span class="setup-dot ${prefs.setup ? 'done' : ''}"></span></button><a class="github-link" href="https://github.com/silviot/hearing-lab" target="_blank" rel="noopener noreferrer">AGPLv3 <span>↗</span></a></div></header>
  <main id="main-content" tabindex="-1"></main>
  <footer class="page-footer"><span>Made for curious ears. Every age welcome.</span><span>Browser audio · Open source · v1.0</span></footer></div>
  <div class="audio-dock" aria-label="Audio controls"><div class="dock-status"><span id="audio-status-dot" class="status-dot"></span><span id="audio-status">Ready when you are</span></div><div class="dock-volume">${icon('volume')}<label for="master-volume">Lab volume</label><input id="master-volume" type="range" min="0" max="100" value="${Math.round(engine.volume * 100)}" aria-label="Lab playback volume"><output id="volume-value">${Math.round(engine.volume * 100)}%</output></div><button class="stop-button" data-action="stop" title="Stop all audio (Escape)">${icon('stop')} Stop <kbd>esc</kbd></button></div>
  <dialog id="setup-dialog" aria-labelledby="setup-title"></dialog>`;
}

function renderRoute() {
  cleanupChallenge?.(); cleanupChallenge = null;
  engine.stop('navigation');
  cancelAnimationFrame(animation);
  const [route, encoded] = location.hash.slice(1).split('?');
  active = byId[route] || ['explore','notebook','about'].includes(route) ? route : 'explore';
  if (byId[active] && encoded) loadSharedParams(active, encoded);
  document.querySelectorAll('[data-page]').forEach(a => { const selected = a.dataset.page === active; a.classList.toggle('active', selected); if (selected) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  document.querySelector('.sidebar').classList.remove('open');
  syncNavigation();
  document.querySelector('#breadcrumb-current').textContent = byId[active]?.title || ({ explore: 'Explore', notebook: 'Notebook', about: 'About' }[active]);
  document.title = `${byId[active]?.title || (active === 'explore' ? 'An open playground for curious ears' : active === 'notebook' ? 'Notebook' : 'About')} — Hearing Lab`;
  if (active === 'explore') renderHome();
  else if (active === 'notebook') renderNotebook();
  else if (active === 'about') renderAbout();
  else { currentMode = byId[active].challenge && active !== 'frequency' ? 'challenge' : 'explore'; renderExperimentPage(); }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function syncNavigation() {
  const sidebar=document.querySelector('.sidebar');
  const isMobile=matchMedia('(max-width: 720px)').matches;
  const open=sidebar.classList.contains('open');
  sidebar.inert=isMobile&&!open;
  document.querySelector('.menu-button').setAttribute('aria-expanded',String(open));
}
const main = () => document.querySelector('#main-content');

function renderHome() {
  main().innerHTML = `<section class="home-intro"><div><div class="eyebrow"><span></span> FOLLOW YOUR EARS</div><h1>Sound is stranger<br>than you think<span class="heading-dot">.</span></h1><p>A hands-on playground for sound and perception.<br class="desktop-break"> Make a prediction. Press play. Turn the knobs while it sounds.</p></div><div class="intro-index"><span>11</span><div>EXPERIMENTS<br>ENDLESS QUESTIONS</div></div></section>
  <a href="#phase" class="feature-card"><div class="feature-copy"><span class="feature-label">START WITH A LITTLE PARADOX <span>01 / 11</span></span><h2>Can two sounds<br>make silence?</h2><p>One wave. Its opposite. Two ears.<br>Meet the surprisingly strange world of phase.</p><span class="feature-button">Explore phase & polarity ${icon('arrow')}</span><div class="feature-foot">${icon('headphones')} Headphones recommended <span>·</span> 2 minutes</div></div><div class="feature-visual"><div class="scope-labels"><span><i class="left-dot"></i> LEFT</span><span><i class="right-dot"></i> RIGHT</span><span><i class="sum-dot"></i> MONO MIX</span></div>${heroScope()}<div class="scope-equation"><span>+1</span><span>−1</span><span>= 0</span></div><div class="scope-caption">OPPOSITE WAVES · 180° APART</div></div></a>
  <section class="catalog-section" aria-labelledby="catalog-title"><div class="section-heading"><h2 id="catalog-title">Pick a rabbit hole<span class="count-pill">11</span></h2><span>Small experiments. Big “wait, what?”</span></div><div class="catalog-tools"><div class="category-tabs" role="group" aria-label="Filter experiments">${categories.map(c => `<button class="category-tab ${category === c ? 'selected' : ''}" data-category="${c}" aria-pressed="${category === c}">${c}</button>`).join('')}</div><input type="search" id="experiment-search" placeholder="Find an experiment…" aria-label="Search experiments" value="${esc(query)}"></div><div id="experiment-grid" class="experiment-grid"></div></section>
  <section class="home-note"><div class="home-note-icon">${icon('headphones')}</div><div><h3>A little setup goes a long way.</h3><p>Grab headphones, find a quiet spot, and start at a comfortable low volume. No microphone or account needed.</p></div><button class="text-button" data-action="setup">Check my setup ${icon('arrow')}</button></section>`;
  renderCards();
}
function renderCards() {
  const list = experiments.filter(e => (category === 'All experiments' || e.category === category) && `${e.title} ${e.short} ${e.description} ${e.category}`.toLowerCase().includes(query.toLowerCase()));
  document.querySelector('#experiment-grid').innerHTML = list.length ? list.map(e => `<a href="#${e.id}" class="experiment-card ${e.color}"><div class="card-top"><span class="card-icon">${icon(e.icon)}</span><span class="card-number">${e.number} ${visited.has(e.id) ? '<span title="Explored">✓</span>' : ''}</span></div><div class="card-graphic">${cardVisual(e.id)}</div><div class="card-category">${e.category}</div><h3>${e.title}</h3><p>${e.short}</p><div class="card-bottom"><span>${e.time}${e.challenge ? ' · Challenge' : ' · Explore'}</span>${icon('arrow')}</div></a>`).join('') : `<div class="empty-search">No experiments match that search. Try “pitch”, “wave”, or “noise”.</div>`;
}

function renderExperimentPage() {
  const e = byId[active];
  main().innerHTML = `<section class="experiment-header"><a class="back-link" href="#explore">← All experiments</a><div class="experiment-heading-row"><div><div class="eyebrow"><span class="number-label">${e.number}</span> ${e.category.toUpperCase()} <span class="eyebrow-separator">/</span> ${e.time}</div><h1>${e.title}<span class="heading-dot">.</span></h1><p>${e.description}</p></div><span class="large-experiment-icon ${e.color}">${icon(e.icon)}</span></div></section>
  <div class="experiment-layout"><div class="experiment-workbench"><div class="workbench-top"><span class="panel-label">${icon('waves')} THE WORKBENCH</span><div class="workbench-tools">${e.challenge ? `<div class="mode-tabs"><button data-mode="explore" class="${currentMode === 'explore' ? 'selected' : ''}">Explore</button><button data-mode="challenge" class="${currentMode === 'challenge' ? 'selected' : ''}">Challenge</button></div>` : ''}<button class="icon-button" data-action="reset" title="Reset experiment" aria-label="Reset experiment">${icon('reset')}</button><button class="icon-button" data-action="share" title="Copy experiment link" aria-label="Copy experiment link">${icon('share')}</button></div></div><div id="workbench-body"></div></div>
  <aside class="experiment-guide"><div class="prediction"><span class="tiny-label">BEFORE YOU PRESS PLAY</span><h2>${e.question}</h2><p>Make a guess. Then press Play and let your ears decide.</p></div><section class="try-this"><span class="tiny-label">TRY THIS</span><ol>${e.steps.map(s => `<li>${s}</li>`).join('')}</ol></section><div class="discovery-fact">${icon('info')}<p>${e.fact}</p></div></aside></div>
  <section class="understanding"><div class="explanation"><div class="eyebrow">THE PART BEHIND THE MAGIC</div><h2>What’s happening?</h2><p>${e.explanation}</p><details><summary>A little deeper ${icon('arrow')}</summary><p>${e.detail}</p><a href="${e.source}" target="_blank" rel="noopener noreferrer">${e.sourceLabel} ↗</a></details></div><div class="observation-card"><div class="observation-heading">${icon('book')}<h3>What did you notice?</h3></div><label class="sr-only" for="observation">Your observation</label><textarea id="observation" rows="3" maxlength="1500" placeholder="A prediction, a surprise, a question…"></textarea><div class="observation-footer"><span>Saved on this device.</span><button class="small-button" data-action="save-note">Save a note ${icon('arrow')}</button></div></div></section>
  <nav class="next-experiments" aria-label="More experiments"><span>KEEP FOLLOWING YOUR EARS</span>${[experiments[(experiments.indexOf(e) + 1) % experiments.length], experiments[(experiments.indexOf(e) + 2) % experiments.length]].map(n => `<a href="#${n.id}">${icon(n.icon)} ${n.title} ${icon('arrow')}</a>`).join('')}</nav>`;
  renderWorkbench();
}

function renderWorkbench() {
  cleanupChallenge?.(); cleanupChallenge = null;
  const body = document.querySelector('#workbench-body');
  if (currentMode === 'challenge') {
    body.innerHTML = '<div id="challenge-host"></div>';
    cleanupChallenge = mountChallenge(document.querySelector('#challenge-host'), { kind: active, engine, onSave: result => {
      try { saveNote({ experiment: active, title: `${byId[active].title} · challenge`, type: 'challenge', result, observation: 'A listening challenge, on this device and at this volume.', setup: setupSnapshot() }); updateCount(); toast('Challenge saved to your notebook.'); } catch { toast('This browser could not save the result. Check available storage.'); return false; }
    } });
    return;
  }
  body.innerHTML = `<div class="playback-row"><button class="primary-button listen-button" id="listen-button" data-action="listen" aria-pressed="false">${icon('play')}<span>Play</span></button><div><strong id="listen-description"></strong><span>It plays until you press Stop. Change anything while you listen.</span></div><span id="live-badge" class="live-badge" hidden><i></i>LIVE</span></div>
  <figure class="picture-panel" id="picture-panel"><div class="picture-top"><span class="picture-label">THE IDEA IN A PICTURE</span><strong id="picture-title"></strong></div><div class="picture-scroll"><div id="picture"></div></div><span class="picture-swipe" aria-hidden="true">Swipe the picture sideways →</span><figcaption id="picture-caption"></figcaption></figure>
  <div class="experiment-controls" id="experiment-controls"></div>
  <div class="scope-panel"><div class="scope-top"><div class="scope-legend"><span><i class="left-dot"></i>Left</span><span><i class="right-dot"></i>Right</span><span><i class="sum-dot"></i>Mono average</span></div><span class="scope-live-label">THE SIGNAL ITSELF</span></div><div id="signal-visual"></div><div class="scope-bottom"><span id="scope-context"></span><span>Fixed visual scale · digital signal</span></div></div>`;
  renderControls(); updateVisual();
}

function formatValue(key, v) {
  if (['frequency','fundamental'].includes(key)) return Number(v) >= 1000 ? `${Number((Number(v) / 1000).toFixed(2))} kHz` : `${Math.round(v)} Hz`;
  if (key === 'phase') return `${Math.round(v)}°`;
  if (key === 'difference') return `${Number(Number(v).toFixed(1))} Hz`;
  if (['delayMs','gapMs'].includes(key)) return `${Number(Number(v).toFixed(2))} ms`;
  if (['snr','gainDb'].includes(key)) return `${Number(v) > 0 ? '+' : ''}${Math.round(v)} dB`;
  if (key === 'pan') return Math.abs(v) < .005 ? 'Centered' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'left' : 'right'}`;
  return String(v);
}
function range(key, label, min, max, step = 1, log = false, hint = '') {
  const value = settings[active][key];
  return `<div class="control-group"><label for="control-${key}">${label}<output id="output-${key}">${formatValue(key, value)}</output></label><input type="range" id="control-${key}" data-param="${key}" ${log ? 'data-log="true"' : ''} min="${log ? Math.log2(min) : min}" max="${log ? Math.log2(max) : max}" step="${log ? '.005' : step}" value="${log ? Math.log2(value) : value}" aria-valuetext="${formatValue(key, value)}"><div class="range-endpoints"><span>${formatValue(key, min)}</span><span>${hint}</span><span>${formatValue(key, max)}</span></div></div>`;
}
function segments(key, label, choices) {
  return `<fieldset class="control-group"><legend>${label}</legend><div class="segmented-control">${choices.map(([value, text]) => `<button data-param-button="${key}" data-value="${value}" aria-pressed="${String(settings[active][key]) === String(value)}" class="${String(settings[active][key]) === String(value) ? 'selected' : ''}">${text}</button>`).join('')}</div></fieldset>`;
}
function renderControls() {
  const p = settings[active]; let html = '';
  if (active === 'phase') {
    html = `<div class="preset-row"><span>QUICK DISCOVERIES</span><button data-preset="same">Aligned waves</button><button data-preset="opposite">Opposite ears</button><button data-preset="cancel">Make silence</button></div>`;
    html += segments('source','Sound source',[['sine','Sine wave'],['complex','Complex tone'],['noise','Noise']]);
    html += `<div class="two-controls">${segments('mode','What changes?',[...(p.source === 'sine' ? [['phase','Phase']] : []),['polarity','Polarity'],['delay','Delay']])}${segments('routing','Where does it go?',[['stereo','Separate ears'],['mono','Mix to mono']])}</div>`;
    if (p.source !== 'noise') html += range('frequency','Frequency',125,2000,1,true);
    if (p.mode === 'phase') html += range('phase','Relative phase',0,360,1,false,'One complete cycle');
    else if (p.mode === 'polarity') html += segments('phase','Right-channel polarity',[[0,'Matching'],[180,'Upside down']]);
    else html += range('delayMs','Right-channel delay',0,2,.05);
  } else if (active === 'beats') {
    html = range('frequency','First tone',100,800,1,true) + range('difference','Frequency spacing',.5,20,.5,false,'This sets the beat rate') + segments('routing','Listen to the tones',[['together','Mixed together'],['separate','One in each ear']]);
  } else if (active === 'harmonics') {
    html = `<div class="preset-row"><span>QUICK DISCOVERIES</span><button data-preset="full">All harmonics</button><button data-preset="missing">Missing fundamental</button><button data-preset="pure">Pure tone</button></div>` + range('fundamental','Fundamental frequency',100,500,1,true);
    html += `<div class="harmonic-bank">${p.harmonics.map((v,i) => `<div class="harmonic-control"><output>${Math.round(v * 100)}%</output><input type="range" data-harmonic="${i}" aria-label="Harmonic ${i+1}, ${(i+1)*p.fundamental} hertz" min="0" max="1" step=".01" value="${v}"><strong>${i === 0 ? 'F₀' : `${i+1}×`}</strong><span>${Math.round((i+1)*p.fundamental)} Hz</span></div>`).join('')}</div><p class="control-hint">Each fader adds one pure tone. Zero removes it from the generated sound.</p>`;
  } else if (active === 'amplitude') {
    html = segments('shape','Wave shape',[['sine','Sine'],['triangle','Triangle'],['square','Square'],['sawtooth','Sawtooth']]) + range('frequency','Frequency',100,1000,1,true) + range('gainDb','Relative gain',-30,0,1,false,'A signal ratio, not acoustic dB');
  } else if (active === 'spatial') {
    html = segments('source','Sound source',[['noise','Broadband noise'],['sine','Pure tone']]) + range('pan','Left / right balance',-1,1,.01) + range('delayMs','Waveform delay',-1,1,.025,false,'Positive = right waveform lags');
    if(p.source === 'sine') html += range('frequency','Tone frequency',125,1500,1,true);
  } else if (active === 'masking') {
    html = segments('invertTone','The tone in your ears',[[false,'Matching tones'],[true,'Opposite tone']]) + range('snr','Tone relative to noise',-30,0,1,false,'Lower = harder to find') + segments('routing','Output',[['stereo','Separate ears'],['mono','Mix to mono']]) + `<p class="control-hint">The tone pulses on and off, twice a second. The same noise stays in both ears; only the tone flips.</p>`;
  } else if (active === 'noise') {
    html = segments('color','Choose a spectrum',[['white','White'],['pink','Pink'],['brown','Brown']]) + `<p class="control-hint">Switch colors while the noise plays. The change is easiest to hear at the moment you switch.</p>`;
  } else if (active === 'shepard') {
    html = segments('direction','Choose a direction',[['up','Always ascending'],['down','Always descending']]) + `<p class="control-hint">Let it run. After 12 steps it is back where it began, yet it never seems to drop. Flip the direction mid-climb.</p>`;
  } else if (active === 'frequency') {
    html = range('frequency','Tone frequency',80,Math.min(18000, .45 * (engine.sampleRate || 48000)),1,true) + `<div class="frequency-presets">${[125,250,500,1000,2000,4000,8000,12000,16000].map(f => `<button data-frequency="${f}" class="${Math.abs(p.frequency-f)<1?'selected':''}">${f < 1000 ? f : `${f/1000}k`}</button>`).join('')}</div>` + segments('ear','Listen with',[['both','Both ears'],['left','Left only'],['right','Right only']]) + `<p class="control-hint">Sweep the slider while the tone plays. Keep one comfortable volume: if a tone disappears, let it disappear. Do not turn it up to chase it.</p>`;
  } else if (active === 'pitch') html = range('frequency','Try a pitch',100,4000,1,true) + `<p class="control-hint">Slide slowly while the tone plays, then switch to the challenge to compare two pitches.</p>`;
  else if (active === 'gap') html = range('gapMs','Silent plateau',1,64,1,false,'Short smooth edges surround the gap') + `<p class="control-hint">The noise is interrupted every two thirds of a second. Shrink the gap until the stutter melts away, then try the challenge.</p>`;
  // Rebuilding the controls must not throw away keyboard focus.
  const focused = document.activeElement?.closest?.('#experiment-controls') ? document.activeElement : null;
  const focusKey = focused && (focused.id ? `#${focused.id}` : focused.dataset.paramButton ? `[data-param-button="${focused.dataset.paramButton}"][data-value="${focused.dataset.value}"]` : focused.dataset.preset ? `[data-preset="${focused.dataset.preset}"]` : focused.dataset.frequency ? `[data-frequency="${focused.dataset.frequency}"]` : focused.dataset.harmonic !== undefined ? `[data-harmonic="${focused.dataset.harmonic}"]` : null);
  const controls = document.querySelector('#experiment-controls');
  controls.innerHTML = html;
  if (focusKey) controls.querySelector(focusKey)?.focus({ preventScroll: true });
}
const LISTEN_TEXT = {
  phase: p => p.routing === 'mono' ? 'Two waves, added before they reach you.' : 'One wave for each ear.',
  beats: p => `${p.frequency} Hz and ${Number(p.frequency) + Number(p.difference)} Hz, ${p.routing === 'separate' ? 'one in each ear' : 'mixed together'}.`,
  harmonics: () => 'Up to six pure tones, stacked.',
  amplitude: p => `A steady ${p.shape} wave.`,
  spatial: p => p.source === 'sine' ? 'A steady tone in both ears.' : 'Steady noise in both ears.',
  masking: () => 'A pulsing tone, hidden in steady noise.',
  noise: p => `Steady ${p.color} noise.`,
  shepard: p => `A staircase that keeps ${p.direction === 'down' ? 'descending' : 'climbing'}.`,
  frequency: () => 'A steady pure tone.', pitch: () => 'A steady pure tone.',
  gap: () => 'Noise with a repeating gap.',
};
function updatePicture() {
  const host = document.querySelector('#picture'); if (!host || !byId[active]) return;
  const live = engine.live ? engine.liveInfo : null;
  shownPitchClass = live?.pitchClass ?? 0;
  const drawn = picture(active, settings[active], live);
  host.innerHTML = drawn.svg;
  document.querySelector('#picture-title').textContent = drawn.title;
  document.querySelector('#picture-caption').textContent = drawn.caption;
}
function updateVisual() {
  if (!byId[active] || currentMode !== 'explore' || !document.querySelector('#signal-visual')) return;
  try {
    const beforeRouting = ['phase','masking'].includes(active);
    const fullClip = ['beats','gap','shepard','masking'].includes(active);
    // The scope needs the whole clip only where it draws an envelope; elsewhere half a second is plenty.
    const visualParams = {...settings[active], ...(beforeRouting ? {routing:'stereo'} : {}), ...(fullClip ? {} : {duration:.5})};
    const rendered = renderExperiment(active,visualParams,engine.sampleRate || 48000,12345);
    document.querySelector('#signal-visual').innerHTML = signalScope(rendered,active,settings[active]) + (['noise','harmonics','amplitude'].includes(active) ? spectrumView(rendered) : '');
    document.querySelector('#scope-context').textContent = beforeRouting ? 'Before output routing · L, R, (L + R) ÷ 2' : active === 'beats' ? `${rendered.duration.toFixed(0)} seconds · peak envelopes` : fullClip ? `One ${rendered.duration.toFixed(1)}-second loop · peak envelopes` : 'Waveform excerpt · time →';
    document.querySelector('#listen-description').textContent = LISTEN_TEXT[active](settings[active]);
    updatePicture();
  } catch(error) { console.error(error); toast('That combination could not be rendered. Reset this experiment.'); }
}
/** Push the current settings to the sound that is already playing, and redraw. */
function settingsChanged() {
  engine.updateLive(active, settings[active]);
  cancelAnimationFrame(previewFrame); previewFrame = requestAnimationFrame(updateVisual);
}
function changeParameter(key, value, rebuild = false) {
  settings[active][key] = value;
  if (active === 'phase' && key === 'source' && value !== 'sine' && settings.phase.mode === 'phase') { settings.phase.mode = 'polarity'; settings.phase.phase = settings.phase.phase >= 90 && settings.phase.phase < 270 ? 180 : 0; }
  if (active === 'phase' && key === 'mode' && value === 'polarity' && ![0,180].includes(Number(settings.phase.phase))) settings.phase.phase = 180;
  if(rebuild) renderControls();
  settingsChanged();
}

function setupSnapshot() { return { labVolume: engine.volume, sampleRate: engine.sampleRate || null, headphonesConfirmed: !!prefs.setup, calibrated: false }; }
function renderNotebook() {
  const notes = readNotes();
  main().innerHTML = `<section class="simple-header"><div class="eyebrow">YOUR OWN LITTLE FIELD GUIDE</div><div class="title-and-action"><h1>Notebook<span class="heading-dot">.</span></h1><button class="outline-button" data-action="export" ${notes.length?'':'disabled'}>${icon('download')} Export JSON</button></div><p>What you heard. What you wondered. Stored in this browser, under your control.</p></section>${notes.length ? `<div class="notebook-grid">${notes.map(n => `<article class="notebook-card"><div class="note-top"><span>${byId[n.experiment]?.number || '—'} / ${esc(byId[n.experiment]?.title || 'Listening note')}</span><button class="icon-button" data-delete-note="${esc(n.id)}" aria-label="Delete this note">${icon('close')}</button></div><h2>${esc(n.title || 'A small discovery')}</h2><p class="note-text">${esc(n.observation || '')}</p>${n.type === 'challenge' ? `<span class="note-badge">Challenge result · ${esc(n.result?.status || 'saved')}</span>` : ''}<details><summary>Experiment settings</summary><pre>${esc(JSON.stringify(n.type === 'challenge' ? n.result : n.params,null,2))}</pre></details><footer><time datetime="${esc(n.createdAt)}">${new Date(n.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</time><a href="#${esc(n.experiment)}">Try again ${icon('arrow')}</a></footer></article>`).join('')}</div>` : `<div class="empty-notebook"><div>${icon('book')}</div><h2>Every good experiment<br>starts with a question.</h2><p>Save observations from any experiment.<br>Your discoveries will collect here.</p><a class="primary-button" href="#explore">Find an experiment ${icon('arrow')}</a></div>`}<div class="notebook-privacy">${icon('info')}<p>No account, cloud sync, or analytics. Clearing this browser’s site data clears these notes, so export anything you want to keep. Up to 300 recent entries are retained.</p></div>`;
}
function renderAbout() {
  main().innerHTML = `<section class="simple-header"><div class="eyebrow">OPEN SOURCE. OPEN EARS.</div><h1>A lab for the curious<span class="heading-dot">.</span></h1><p>No special knowledge required. Just a pair of ears and a willingness to be surprised.</p></section><div class="about-grid"><article><h2>What this is</h2><p>Hearing Lab is a collection of small experiments in sound and perception. The controls are real and act on the sound while it plays, the sounds are generated in your browser, and each experiment has a picture that moves with the controls to show what the signal is doing.</p><p>It is built for people of every age. Try it alone, explore it with someone else, or use it to start a conversation in a classroom.</p><h2>Experiment, observe, question</h2><p>Make a prediction before you listen. Change one thing at a time. Repeat anything surprising. If someone hears something different, that is another observation worth exploring.</p><h2>About the listening challenges</h2><p>These are informal listening tasks, with no acoustic calibration. Your headphones, volume, room, and attention all affect the results. The lab does not diagnose hearing, assign a hearing age, or report clinical thresholds.</p><h2>Comfortable listening</h2><p>Start with a low system volume. Experiments play until you stop them, so you can change things while you listen; Stop and Escape silence everything at once, and so does leaving the page. Challenge clips are short. Do not turn up the volume to chase an inaudible tone. A browser cannot know the actual sound level at your ears.</p></article><aside><div class="about-card"><h3>Small footprint. Open by design.</h3><ul><li>11 interactive experiments</li><li>3 listening challenges</li><li>Audio generated on your device</li><li>No microphone or recordings</li><li>No accounts or third-party tracking</li><li>Notebook stored in this browser</li><li>Keyboard and touch controls</li><li>No runtime dependencies</li></ul><a class="outline-button" href="https://github.com/silviot/hearing-lab" target="_blank" rel="noopener noreferrer">GitHub repository ↗</a><a class="source-download" href="./hearing-lab-source.tar.gz" download>Download this version’s complete source ↓</a><p class="license-note">Licensed under GNU AGPL version 3. Modified versions offered over a network must offer their corresponding source under the license.</p></div><div class="about-card"><h3>A few things worth reading</h3><a href="https://www.w3.org/TR/webaudio-1.0/" target="_blank" rel="noopener noreferrer">Web Audio specification ↗</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11362506/" target="_blank" rel="noopener noreferrer">Psychoacoustics in the browser ↗</a><a href="https://deutsch.ucsd.edu/psychology/pages.php?i=213" target="_blank" rel="noopener noreferrer">Diana Deutsch’s auditory illusions ↗</a><a href="https://www.mathpsy.uni-tuebingen.de/acoulab/calibration.html" target="_blank" rel="noopener noreferrer">Why calibration matters ↗</a></div></aside></div>`;
}

function showSetup() {
  engine.stop('setup');
  const dialog = document.querySelector('#setup-dialog');
  dialog.innerHTML = `<button class="dialog-close icon-button" data-action="close-setup" aria-label="Close setup">${icon('close')}</button><span class="setup-hero-icon">${icon('headphones')}</span><div class="eyebrow">ONE MINUTE TO GET READY</div><h2 id="setup-title">Give your ears a good seat.</h2><p>Use stereo headphones and start with a low system volume. Find a quiet spot, then check the two channels.</p><div class="channel-checks"><button class="outline-button" data-check-ear="left">${icon('play')} Left ear</button><button class="outline-button" data-check-ear="right">${icon('play')} Right ear</button></div><p class="setup-small">Each button plays a short 1,000 Hz tone. If it plays in both ears, check your system’s mono-audio setting. Spatial audio and other effects can change the experiments.</p><label class="setup-checkbox"><input type="checkbox" id="setup-confirm" ${prefs.setup?'checked':''}> The sound is quiet and comfortable.</label><button class="primary-button setup-done" data-action="finish-setup">Ready to explore ${icon('arrow')}</button><p class="setup-small">This sets a listening level, not a medical calibration.</p>`;
  dialog.showModal();
}
function audioState(state) {
  const isPlaying = Boolean(state.playing), isLive = isPlaying && Boolean(state.live);
  document.querySelector('#audio-status-dot')?.classList.toggle('playing',isPlaying);
  const status = document.querySelector('#audio-status'); if(status) status.textContent = isLive ? 'Playing. Change anything.' : isPlaying ? 'Listening…' : 'Ready when you are';
  const button = document.querySelector('#listen-button'); if(button) { button.innerHTML = isLive ? `${icon('stop')}<span>Stop</span>` : `${icon('play')}<span>Play</span>`; button.classList.toggle('is-playing',isLive); button.setAttribute('aria-pressed',String(isLive)); }
  const badge = document.querySelector('#live-badge'); if(badge) badge.hidden = !isLive;
  document.querySelector('#picture-panel')?.classList.toggle('is-live',isLive);
  cancelAnimationFrame(animation);
  if(isLive) {
    if(byId[active]) { visited.add(active); prefs.explored = [...visited]; savePreferences(prefs); document.querySelector(`[data-page="${active}"] .nav-dot`)?.classList.add('visited'); }
    animation = requestAnimationFrame(followLive);
  } else {
    document.querySelector('.scope-playhead')?.setAttribute('opacity','0');
    if(shownPitchClass && !isPlaying) updatePicture();
    if(['interrupted','devicechange','error'].includes(state.reason)) toast('Playback stopped. Check your output and press Play when ready.');
  }
}
/** While a looping experiment plays, move the scope playhead and keep the picture on the current step. */
function followLive() {
  if(!engine.live) return;
  const info = engine.liveInfo;
  if(info && info.cycle >= 0) {
    const line = document.querySelector('.scope-playhead');
    if(line && !matchMedia('(prefers-reduced-motion: reduce)').matches) { const x = String(info.cycle*760); line.setAttribute('x1',x); line.setAttribute('x2',x); line.setAttribute('opacity','.5'); }
    if(active === 'shepard' && info.pitchClass !== shownPitchClass) updatePicture();
  }
  animation = requestAnimationFrame(followLive);
}
async function listen() {
  try { if(engine.live) engine.stop('stopped'); else await engine.startLive(active,settings[active],{seed:12345}); }
  catch(error) { console.error(error); toast('Audio could not start. Check your output and try Play again.'); }
}
let toastTimer;
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4200); }
function updateCount() { document.querySelector('#note-count').textContent=readNotes().length; }
function loadSharedParams(id, encoded) {
  try {
    const serialized = new URLSearchParams(encoded).get('s'); if(!serialized || serialized.length>4000) return;
    const values = JSON.parse(serialized), original = byId[id].defaults;
    const allowed = { color:['white','pink','brown'], source:id==='phase'?['sine','complex','noise']:['sine','noise'], mode:['phase','polarity','delay'], routing:id==='beats'?['together','separate']:['stereo','mono'], direction:['up','down'], shape:['sine','triangle','square','sawtooth'], ear:['both','left','right'] };
    for(const key of Object.keys(original)) {
      const v=values[key];
      if(typeof original[key] === 'number' && Number.isFinite(v)) settings[id][key]=v;
      else if(typeof original[key] === 'boolean' && typeof v==='boolean') settings[id][key]=v;
      else if(typeof original[key] === 'string' && allowed[key]?.includes(v)) settings[id][key]=v;
      else if(Array.isArray(original[key]) && Array.isArray(v) && v.length===6 && v.every(x=>Number.isFinite(x)&&x>=0&&x<=1)) settings[id][key]=v;
    }
    // Shared links are untrusted. Renderers clamp all signal parameters; constrain the UI too.
    const p=settings[id];
    const frequencyBounds={phase:[125,2000],beats:[100,800],amplitude:[100,1000],spatial:[125,1500],masking:[500,500],pitch:[100,4000],frequency:[80,Math.min(18000,.45*(engine.sampleRate||48000))]};
    if('frequency' in p) { const [min,max]=frequencyBounds[id]||[80,4000]; p.frequency=Math.min(max,Math.max(min,p.frequency)); }
    if('fundamental' in p) p.fundamental=Math.min(500,Math.max(100,p.fundamental));
    if('duration' in p) p.duration=original.duration;
    if('steps' in p) p.steps=12;
    if('phase' in p) p.phase=((p.phase%360)+360)%360;
    if('pan' in p) p.pan=Math.min(1,Math.max(-1,p.pan));
    if('delayMs' in p) p.delayMs=Math.min(id==='spatial'?1:2,Math.max(id==='spatial'?-1:0,p.delayMs));
    if('difference' in p) p.difference=Math.min(20,Math.max(.5,p.difference));
    if('snr' in p) p.snr=Math.min(0,Math.max(-30,p.snr));
    if('gainDb' in p) p.gainDb=Math.min(0,Math.max(-30,p.gainDb));
    if('gapMs' in p) p.gapMs=Math.min(64,Math.max(1,p.gapMs));
    if(id==='phase' && p.source!=='sine' && p.mode==='phase') p.mode='polarity';
    if(id==='phase' && p.mode==='polarity') p.phase=p.phase>=90&&p.phase<270?180:0;
  } catch { /* Invalid links simply use the experiment defaults. */ }
}

app.addEventListener('click', async event => {
  const target=event.target.closest('button,a'); if(!target) return;
  if(target.dataset.category) { category=target.dataset.category; document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('selected',b.dataset.category===category);b.setAttribute('aria-pressed',String(b.dataset.category===category));}); renderCards(); return; }
  if(target.dataset.mode) { engine.stop('mode changed'); currentMode=target.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b===target));renderWorkbench();return; }
  if(target.dataset.paramButton) { const key=target.dataset.paramButton; let v=target.dataset.value; if(typeof settings[active][key]==='number')v=Number(v);else if(typeof settings[active][key]==='boolean')v=v==='true'; changeParameter(key,v,true); return; }
  if(target.dataset.frequency) { changeParameter('frequency',Number(target.dataset.frequency),true);return; }
  if(target.dataset.preset) {
    const p=settings[active], preset=target.dataset.preset;
    if(active==='phase') Object.assign(p,{source:'sine',mode:'phase',phase:preset==='same'?0:180,routing:preset==='cancel'?'mono':'stereo'});
    if(active==='harmonics') p.harmonics=preset==='full'?[1,.65,.45,.3,.22,.16]:preset==='missing'?[0,.65,.45,.3,.22,.16]:[1,0,0,0,0,0];
    renderControls();settingsChanged();return;
  }
  if(target.dataset.checkEar) { try{await engine.play('frequency',{frequency:1000,ear:target.dataset.checkEar,duration:.6});}catch{toast('Audio could not start. Try again.');}return; }
  if(target.dataset.deleteNote) { try{removeNote(target.dataset.deleteNote);updateCount();renderNotebook();toast('Note deleted.');}catch{toast('This note could not be deleted.');}return; }
  switch(target.dataset.action) {
    case 'menu': document.querySelector('.sidebar').classList.toggle('open'); syncNavigation(); break;
    case 'stop': engine.stop('stopped');break;
    case 'setup':showSetup();break;
    case 'close-setup':engine.stop('setup closed');document.querySelector('#setup-dialog').close();break;
    case 'finish-setup':if(!document.querySelector('#setup-confirm').checked){toast('Check that the level feels quiet and comfortable first.');return;}prefs.setup=true;savePreferences(prefs);document.querySelector('.setup-dot').classList.add('done');engine.stop('setup complete');document.querySelector('#setup-dialog').close();toast('Ready. Keep this comfortable volume as you explore.');break;
    case 'listen':await listen();break;
    case 'reset':settings[active]=structuredClone(byId[active].defaults);if(currentMode==='explore'){renderControls();settingsChanged();}else renderWorkbench();toast('Experiment reset.');break;
    case 'share':try{const url=new URL(location.href);url.hash=`${active}?${new URLSearchParams({s:JSON.stringify(settings[active])})}`;await navigator.clipboard.writeText(url.href);toast('Experiment link copied. Your notes stay private.');}catch{toast('Clipboard unavailable. You can share this page’s address.');}break;
    case 'export':downloadNotes();toast('Notebook exported as JSON.');break;
    case 'save-note':{
      const text=document.querySelector('#observation').value.trim();if(!text){document.querySelector('#observation').focus();toast('Write an observation or question first.');return;}
      try{saveNote({experiment:active,title:byId[active].title,type:'observation',observation:text,params:structuredClone(settings[active]),setup:setupSnapshot()});updateCount();document.querySelector('#observation').value='';toast('Saved to your notebook.');}catch{toast('This browser could not save the note. Check available storage.');}break;
    }
  }
});
app.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='master-volume'){engine.setVolume(Number(el.value)/100);prefs.volume=Number(el.value)/100;savePreferences(prefs);document.querySelector('#volume-value').textContent=`${el.value}%`;return;}
  if(el.id==='experiment-search'){query=el.value;renderCards();return;}
  if(el.dataset.param){const key=el.dataset.param;const value=el.dataset.log?Math.round(2**Number(el.value)):Number(el.value);changeParameter(key,value);document.querySelector(`#output-${key}`).textContent=formatValue(key,value);el.setAttribute('aria-valuetext',formatValue(key,value));if(active==='harmonics'&&key==='fundamental')document.querySelectorAll('.harmonic-control').forEach((c,i)=>{c.querySelector('span').textContent=`${Math.round((i+1)*value)} Hz`;c.querySelector('input').setAttribute('aria-label',`Harmonic ${i+1}, ${Math.round((i+1)*value)} hertz`);});return;}
  if(el.dataset.harmonic!==undefined){settings.harmonics.harmonics[Number(el.dataset.harmonic)]=Number(el.value);el.parentElement.querySelector('output').textContent=`${Math.round(el.value*100)}%`;settingsChanged();}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){engine.stop('stopped');document.querySelector('.sidebar')?.classList.remove('open');syncNavigation();}});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main().focus();});
window.addEventListener('resize',syncNavigation);
window.addEventListener('hashchange',renderRoute);
shell();
document.querySelector('#setup-dialog').addEventListener('cancel',()=>engine.stop('setup closed'));
renderRoute();
