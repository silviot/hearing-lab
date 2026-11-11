// SPDX-License-Identifier: AGPL-3.0-only
import { AudioEngine } from './audio/engine.js';
import { renderExperiment } from './audio/dsp.js';
import { experiments, byId } from './lib/catalog.js';
import { readNotes, saveNote, removeNote, downloadNotes, readPreferences, savePreferences, escapeHtml as esc } from './lib/notebook.js';
import { icon, heroScope, cardVisual, signalScope, spectrumView, staircaseChart, frequencyMapChart } from './ui/visuals.js';
import { mountChallenge } from './ui/challenges.js';
import { picture } from './ui/pictures.js';
import { Dictation, recognitionClass } from './ui/dictation.js';
import {
  LANGUAGES, detectLanguage, loadLanguage, getLanguage, getLanguageMeta,
  isRtl, t, tRaw, localizedExperiment,
} from './i18n/index.js';

const CATEGORY_IDS = ['all', 'foundations', 'perception', 'challenges', 'illusions'];

const app = document.querySelector('#app');
let prefs = readPreferences();
let active = 'explore', category = 'all', query = '', cleanupChallenge = null, animation = null, previewFrame = null, shownPitchClass = 0, currentMode = 'explore', forceSpectrum = false;
const settings = Object.fromEntries(experiments.map(e => [e.id, structuredClone(e.defaults)]));
const visited = new Set(Array.isArray(prefs.explored) ? prefs.explored : []);
const engine = new AudioEngine({ onState: audioState });
const DICTATION_ERROR_KEYS = {
  'not-allowed': 'toasts.micRefused',
  'service-not-allowed': 'toasts.speechNotAllowed',
  'audio-capture': 'toasts.noMic',
  'network': 'toasts.speechNetwork',
  'language-not-supported': 'toasts.speechLangUnsupported',
  'no-speech': 'toasts.noSpeech',
};
const dictation = new Dictation({
  Recognition: recognitionClass(),
  lang: navigator.language || 'en-US',
  onText: text => {
    const field = document.querySelector('#observation');
    if (field) { field.value = text; field.scrollTop = field.scrollHeight; }
  },
  onState: dictationState,
  onError: code => toast(t(DICTATION_ERROR_KEYS[code] || 'toasts.dictationStopped')),
});

function dictationState(listening) {
  const button = document.querySelector('#dictate-button'), field = document.querySelector('#observation');
  if (!button || !field) return;
  button.classList.toggle('is-listening', listening);
  button.setAttribute('aria-pressed', String(listening));
  button.querySelector('span').textContent = listening ? t('workbench.stopDictating') : t('workbench.dictate');
  // Typing and dictating into the same text at once would duplicate words.
  field.readOnly = listening;
  field.placeholder = listening ? t('workbench.obsListening') : t('workbench.obsPlaceholder');
}
engine.setVolume(Number.isFinite(prefs.volume) ? Math.min(1, Math.max(0, prefs.volume)) : .35);

function applyLanguageToDocument() {
  const code = getLanguage();
  const meta = getLanguageMeta(code);
  document.documentElement.lang = code;
  document.documentElement.dir = isRtl(code) ? 'rtl' : 'ltr';
  if (prefs.lang) {
    document.documentElement.setAttribute('translate', 'no');
    if (!document.querySelector('meta[name="google"]')) {
      const m = document.createElement('meta');
      m.name = 'google';
      m.content = 'notranslate';
      document.head.appendChild(m);
    }
  }
  dictation.lang = meta.speech;
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', t('meta.description'));
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) skipLink.textContent = t('meta.skipLink');
}

function shell() {
  const volPct = Math.round(engine.volume * 100);
  const currentLang = getLanguage();
  const expLinks = experiments.map(raw => {
    const e = localizedExperiment(raw);
    return `<a href="#${e.id}" data-page="${e.id}"><span class="experiment-num">${e.number}</span><span>${esc(e.title)}</span><span class="nav-dot ${visited.has(e.id) ? 'visited' : ''}"></span></a>`;
  }).join('');
  const langOptions = LANGUAGES.map(l => `<option value="${l.code}" ${l.code === currentLang ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  app.innerHTML = `<aside class="sidebar" aria-label="${esc(t('nav.mainAria'))}">
    <button class="mobile-nav-close icon-button" data-action="menu" aria-label="${esc(t('nav.closeMenu'))}">${icon('close')}</button><a href="#explore" class="brand" aria-label="${esc(t('nav.homeAria'))}"><span class="brand-mark">${icon('waves')}</span><span><span dir="ltr">hearing<span class="brand-light">lab</span></span><small>${esc(t('nav.tagline'))}</small></span></a>
    <div class="sidebar-section">${esc(t('nav.yourLab'))}</div>
    <nav class="primary-nav"><a href="#explore" data-page="explore">${icon('grid')}<span>${esc(t('nav.explore'))}</span><span class="nav-count">11</span></a><a href="#notebook" data-page="notebook">${icon('book')}<span>${esc(t('nav.notebook'))}</span><span id="note-count" class="nav-count">${readNotes().length}</span></a></nav>
    <div class="sidebar-section experiments-label">${esc(t('nav.experiments'))}</div>
    <nav class="experiment-nav">${expLinks}</nav>
    <div class="sidebar-bottom"><div class="lab-note">${esc(t('nav.curiosity'))}</div><a href="#about">${icon('info')} <span>${esc(t('nav.aboutLab'))}</span> ${icon('arrow')}</a><a href="./hearing-lab-source.tar.gz" download class="source-link">${esc(t('nav.downloadSource'))} <span>↓</span></a><div class="sidebar-meta"><span class="status-dot"></span> ${esc(t('nav.localAudio'))}</div></div>
  </aside>
  <div class="main-shell"><header class="topbar"><button class="icon-button menu-button" data-action="menu" aria-label="${esc(t('nav.openMenu'))}">${icon('menu')}</button><div class="breadcrumb"><span>${esc(t('meta.titleSuffix'))}</span><span>/</span><strong id="breadcrumb-current">${esc(t('nav.explore'))}</strong></div><div class="topbar-actions"><div class="lang-picker">${icon('globe')}<select id="language-select" aria-label="${esc(t('nav.languageAria'))}">${langOptions}</select></div><button class="setup-chip" data-action="setup" title="${esc(t('nav.listeningSetup'))}" aria-label="${esc(t('nav.listeningSetup'))}">${icon('headphones')}<span class="setup-chip-label">${esc(t('nav.listeningSetup'))}</span><span class="setup-dot ${prefs.setup ? 'done' : ''}"></span></button><a class="github-link" href="https://github.com/silviot/hearing-lab" target="_blank" rel="noopener noreferrer">AGPLv3 <span dir="ltr">↗</span></a></div></header>
  <main id="main-content" tabindex="-1"></main>
  <footer class="page-footer"><span>${esc(t('nav.footerLeft'))}</span><span>${esc(t('nav.footerRight'))}</span></footer></div>
  <div class="audio-dock" aria-label="${esc(t('dock.aria'))}"><div class="dock-status"><span id="audio-status-dot" class="status-dot"></span><span id="audio-status">${esc(t('dock.ready'))}</span></div><div class="dock-volume">${icon('volume')}<label for="master-volume">${esc(t('dock.labVolume'))}</label><input id="master-volume" type="range" min="0" max="100" value="${volPct}" style="--progress:${volPct}%" aria-label="${esc(t('dock.volumeAria'))}"><output id="volume-value" dir="ltr">${volPct}%</output></div><button class="stop-button" data-action="stop" title="${esc(t('dock.stopTitle'))}">${icon('stop')} ${esc(t('dock.stop'))} <kbd>esc</kbd></button></div>
  <dialog id="setup-dialog" aria-labelledby="setup-title"></dialog>`;
}

function renderRoute({ preserveMode = false, preserveScroll = false } = {}) {
  cleanupChallenge?.(); cleanupChallenge = null;
  dictation.cancel();
  engine.stop('navigation');
  cancelAnimationFrame(animation);
  const [route, encoded] = location.hash.slice(1).split('?');
  active = byId[route] || ['explore', 'notebook', 'about'].includes(route) ? route : 'explore';
  if (byId[active] && encoded && !preserveMode) loadSharedParams(active, encoded);
  document.querySelectorAll('[data-page]').forEach(a => {
    const selected = a.dataset.page === active;
    a.classList.toggle('active', selected);
    if (selected) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.querySelector('.sidebar')?.classList.remove('open');
  syncNavigation();
  const locExp = byId[active] ? localizedExperiment(byId[active]) : null;
  const pageTitle = locExp ? locExp.title : ({ explore: t('nav.explore'), notebook: t('nav.notebook'), about: t('nav.about') }[active]);
  const bc = document.querySelector('#breadcrumb-current');
  if (bc) bc.textContent = pageTitle;
  document.title = active === 'explore' ? t('meta.title') : `${pageTitle} — ${t('meta.titleSuffix')}`;
  if (active === 'explore') renderHome();
  else if (active === 'notebook') renderNotebook();
  else if (active === 'about') renderAbout();
  else {
    if (!preserveMode) {
      const modeParam = encoded ? new URLSearchParams(encoded).get('mode') : null;
      currentMode = modeParam === 'explore' || modeParam === 'challenge'
        ? (byId[active].challenge ? modeParam : 'explore')
        : (byId[active].challenge && active !== 'frequency' && !encoded?.includes('s=') ? 'challenge' : 'explore');
    }
    renderExperimentPage();
  }
  if (!preserveScroll) window.scrollTo({ top: 0, behavior: 'instant' });
}

function syncNavigation() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const isMobile = matchMedia('(max-width: 720px)').matches;
  const open = sidebar.classList.contains('open');
  sidebar.inert = isMobile && !open;
  document.querySelector('.menu-button')?.setAttribute('aria-expanded', String(open));
}
const main = () => document.querySelector('#main-content');

function renderHome() {
  const exploredLine = visited.size ? t('home.exploredCount', { n: visited.size }) : t('home.endlessQuestions');
  main().innerHTML = `<section class="home-intro"><div><div class="eyebrow"><span></span> ${esc(t('home.eyebrow'))}</div><h1>${esc(t('home.heading1'))} <br>${esc(t('home.heading2'))}<span class="heading-dot">.</span></h1><p>${esc(t('home.intro1'))} <br class="desktop-break">${esc(t('home.intro2'))}</p></div><div class="intro-index"><span>11</span><div>${esc(t('home.experimentsCaps'))}<br>${esc(exploredLine)}</div></div></section>
  <a href="#phase" class="feature-card"><div class="feature-copy"><span class="feature-label">${esc(t('home.featureLabel'))} <span dir="ltr">01 / 11</span></span><h2>${esc(t('home.featureTitle1'))} <br>${esc(t('home.featureTitle2'))}</h2><p>${esc(t('home.featureCopy1'))} <br>${esc(t('home.featureCopy2'))}</p><span class="feature-button">${esc(t('home.featureCta'))} ${icon('arrow')}</span><div class="feature-foot">${icon('headphones')} ${esc(t('home.featureFoot'))} <span>·</span> ${esc(t('home.featureTime'))}</div></div><div class="feature-visual"><div class="scope-labels"><span><i class="left-dot"></i> ${esc(t('home.scopeLeft'))}</span><span><i class="right-dot"></i> ${esc(t('home.scopeRight'))}</span><span><i class="sum-dot"></i> ${esc(t('home.scopeMono'))}</span></div>${heroScope()}<div class="scope-equation" dir="ltr"><span>+1</span><span>−1</span><span>= 0</span></div><div class="scope-caption">${esc(t('home.scopeCaption'))}</div></div></a>
  <section class="catalog-section" aria-labelledby="catalog-title"><div class="section-heading"><h2 id="catalog-title">${esc(t('home.catalogTitle'))}<span id="catalog-count" class="count-pill">11</span></h2><span>${esc(t('home.catalogSub'))}</span></div><div class="catalog-tools"><div class="category-tabs" role="group" aria-label="${esc(t('home.filterAria'))}">${CATEGORY_IDS.map(id => `<button class="category-tab ${category === id ? 'selected' : ''}" data-category="${id}" aria-pressed="${category === id}">${esc(t(`categories.${id}`))}</button>`).join('')}</div><input type="search" id="experiment-search" placeholder="${esc(t('home.searchPlaceholder'))}" aria-label="${esc(t('home.searchAria'))}" value="${esc(query)}"></div><div id="experiment-grid" class="experiment-grid"></div></section>
  <section class="home-note"><div class="home-note-icon">${icon('headphones')}</div><div><h3>${esc(t('home.setupTitle'))}</h3><p>${esc(t('home.setupBody'))}</p></div><button class="text-button" data-action="setup">${esc(t('home.setupCta'))} ${icon('arrow')}</button></section>`;
  renderCards();
}

function renderCards() {
  const q = query.trim().toLowerCase();
  const list = experiments.map(localizedExperiment).filter(e => {
    const raw = byId[e.id];
    const catOk = category === 'all' || e.categoryId === category;
    const queryOk = !q || `${e.title} ${e.short} ${e.description} ${e.categoryLabel} ${raw.title} ${raw.short} ${raw.description}`.toLowerCase().includes(q);
    return catOk && queryOk;
  });
  const countPill = document.querySelector('#catalog-count');
  if (countPill) countPill.textContent = String(list.length);
  document.querySelector('#experiment-grid').innerHTML = list.length ? list.map(e => `<a href="#${e.id}" class="experiment-card ${e.color}"><div class="card-top"><span class="card-icon">${icon(e.icon)}</span><span class="card-number">${e.number} ${visited.has(e.id) ? `<span class="explored-mark" title="${esc(t('home.exploredTitle'))}">✓</span>` : ''}</span></div><div class="card-graphic">${cardVisual(e.id)}</div><div class="card-category">${esc(e.categoryLabel)}</div><h3>${esc(e.title)}</h3><p>${esc(e.short)}</p><div class="card-bottom"><span>${esc(e.time)} · ${esc(e.challenge ? t('home.cardChallenge') : t('home.cardExplore'))}</span>${icon('arrow')}</div></a>`).join('') : `<div class="empty-search"><p>${esc(t('home.emptySearch'))}</p><button class="outline-button" data-action="clear-filter">${esc(t('home.showAll'))}</button></div>`;
}

function renderExperimentPage() {
  const e = localizedExperiment(byId[active]);
  const idx = experiments.findIndex(x => x.id === e.id);
  const nextExps = [experiments[(idx + 1) % experiments.length], experiments[(idx + 2) % experiments.length]].map(localizedExperiment);
  main().innerHTML = `<section class="experiment-header"><a class="back-link" href="#explore"><span class="dir-arrow" aria-hidden="true">←</span> ${esc(t('workbench.backAll'))}</a><div class="experiment-heading-row"><div><div class="eyebrow"><span class="number-label">${e.number}</span> ${esc(e.categoryLabel.toUpperCase())} <span class="eyebrow-separator">/</span> ${esc(e.time)}</div><h1>${esc(e.title)}<span class="heading-dot">.</span></h1><p>${esc(e.description)}</p></div><span class="large-experiment-icon ${e.color}">${icon(e.icon)}</span></div></section>
  <div class="experiment-layout"><div class="experiment-workbench"><div class="workbench-top"><span class="panel-label">${icon('waves')} ${esc(t('workbench.title'))}</span><div class="workbench-tools">${e.challenge ? `<div class="mode-tabs" role="group" aria-label="${esc(t('workbench.modeAria'))}"><button data-mode="explore" aria-pressed="${currentMode === 'explore'}" class="${currentMode === 'explore' ? 'selected' : ''}">${icon('sliders')} ${esc(t('workbench.modeExplore'))}</button><button data-mode="challenge" aria-pressed="${currentMode === 'challenge'}" class="${currentMode === 'challenge' ? 'selected' : ''}">${icon('target')} ${esc(t('workbench.modeChallenge'))}</button></div>` : ''}<button class="icon-button" data-action="reset" title="${esc(t('workbench.resetTitle'))}" aria-label="${esc(t('workbench.resetAria'))}">${icon('reset')}</button><button class="icon-button" data-action="share" title="${esc(t('workbench.shareTitle'))}" aria-label="${esc(t('workbench.shareAria'))}">${icon('share')}</button></div></div><div id="workbench-body"></div></div>
  <aside class="experiment-guide"><div class="prediction"><span class="tiny-label">${esc(t('workbench.beforePlay'))}</span><h2>${esc(e.question)}</h2><p>${esc(t('workbench.makeGuess'))}</p></div><section class="try-this"><span class="tiny-label">${esc(t('workbench.tryThis'))}</span><ol>${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></section><div class="discovery-fact">${icon('info')}<p>${esc(e.fact)}</p></div></aside></div>
  <section class="understanding"><div class="explanation"><div class="eyebrow">${esc(t('workbench.behindMagic'))}</div><h2>${esc(t('workbench.whatsHappening'))}</h2><p>${esc(e.explanation)}</p><details><summary>${esc(t('workbench.littleDeeper'))} ${icon('arrow')}</summary><p>${esc(e.detail)}</p><a href="${e.source}" target="_blank" rel="noopener noreferrer">${esc(e.sourceLabel)} <span dir="ltr">↗</span></a></details></div><div class="observation-card"><div class="observation-heading">${icon('book')}<h3>${esc(t('workbench.whatNoticed'))}</h3></div><label class="sr-only" for="observation">${esc(t('workbench.yourObservation'))}</label><textarea id="observation" rows="3" maxlength="1500" placeholder="${esc(t('workbench.obsPlaceholder'))}"></textarea><div class="observation-footer"><span>${esc(t('workbench.savedLocal'))}</span><div class="observation-actions">${dictation.supported ? `<button class="small-button dictate-button" id="dictate-button" data-action="dictate" aria-pressed="false" aria-describedby="dictation-note">${icon('mic')}<span>${esc(t('workbench.dictate'))}</span></button>` : ''}<button class="small-button" data-action="save-note">${esc(t('workbench.saveNote'))} ${icon('arrow')}</button></div></div>${dictation.supported ? `<p class="dictation-note" id="dictation-note">${esc(t('workbench.dictationNote'))}</p>` : ''}</div></section>
  <nav class="next-experiments" aria-label="${esc(t('workbench.keepFollowing'))}"><span>${esc(t('workbench.keepFollowing'))}</span>${nextExps.map(n => `<a href="#${n.id}">${icon(n.icon)} ${esc(n.title)} ${icon('arrow')}</a>`).join('')}</nav>`;
  renderWorkbench();
}

function renderWorkbench() {
  cleanupChallenge?.(); cleanupChallenge = null;
  const body = document.querySelector('#workbench-body');
  if (currentMode === 'challenge') {
    body.innerHTML = '<div id="challenge-host"></div>';
    cleanupChallenge = mountChallenge(document.querySelector('#challenge-host'), {
      kind: active,
      engine,
      onSave: result => {
        try {
          const e = localizedExperiment(byId[active]);
          saveNote({
            experiment: active,
            title: `${e.title} · ${t('notebook.challengeTitleSuffix')}`,
            type: 'challenge',
            result,
            observation: t('notebook.challengeObsDefault'),
            setup: setupSnapshot(),
          });
          updateCount();
          toast(t('toasts.challengeSaved'));
        } catch {
          toast(t('toasts.saveFailed'));
          return false;
        }
      },
    });
    return;
  }
  const defaultSpectrum = ['noise', 'harmonics', 'amplitude'].includes(active);
  const showSpectrum = defaultSpectrum || forceSpectrum;
  const playHintHtml = esc(t('workbench.playHint', { space: '__SPACE_KBD__' })).replace('__SPACE_KBD__', '<kbd>space</kbd>');
  body.innerHTML = `<div class="playback-row"><button class="primary-button listen-button" id="listen-button" data-action="listen" aria-pressed="false">${icon('play')}<span>${esc(t('workbench.play'))}</span></button><div><strong id="listen-description"></strong><span>${playHintHtml}</span></div><span id="live-badge" class="live-badge" hidden><i></i>${esc(t('workbench.live'))}</span></div>
  <figure class="picture-panel" id="picture-panel"><div class="picture-top"><div class="picture-heading"><span class="picture-label">${esc(t('workbench.ideaLabel'))}</span><strong id="picture-title"></strong></div><span id="picture-hint" class="picture-hint"></span></div><div class="picture-scroll"><div id="picture"></div></div><span class="picture-swipe" aria-hidden="true">${esc(t('workbench.swipeHint'))}</span><figcaption id="picture-caption"></figcaption></figure>
  <div class="experiment-controls" id="experiment-controls"></div>
  <div class="scope-panel"><div class="scope-top"><div class="scope-legend"><span><i class="left-dot"></i>${esc(t('workbench.left'))}</span><span><i class="right-dot"></i>${esc(t('workbench.right'))}</span><span><i class="sum-dot"></i>${esc(t('workbench.monoAvg'))}</span></div><div class="scope-actions">${defaultSpectrum ? '' : `<button class="scope-toggle ${showSpectrum ? 'active' : ''}" data-action="toggle-spectrum" aria-pressed="${showSpectrum}">${icon('bars')} ${esc(t('workbench.spectrumBtn'))}</button>`}<span class="scope-live-label">${esc(t('workbench.signalLabel'))}</span></div></div><div id="signal-visual"></div><div class="scope-bottom"><span id="scope-context"></span><span>${esc(t('workbench.fixedScale'))}</span></div></div>`;
  renderControls();
  updateVisual();
}

function formatValue(key, v) {
  if (['frequency', 'fundamental'].includes(key)) return Number(v) >= 1000 ? `${Number((Number(v) / 1000).toFixed(2))} kHz` : `${Math.round(v)} Hz`;
  if (key === 'phase') return `${Math.round(v)}°`;
  if (key === 'difference') return `${Number(Number(v).toFixed(1))} Hz`;
  if (['delayMs', 'gapMs'].includes(key)) return `${Number(Number(v).toFixed(2))} ms`;
  if (['snr', 'gainDb'].includes(key)) return `${Number(v) > 0 ? '+' : ''}${Math.round(v)} dB`;
  if (key === 'pan') {
    if (Math.abs(v) < .005) return t('controls.centered');
    const pct = Math.round(Math.abs(v) * 100);
    return v < 0 ? t('controls.pctLeft', { n: pct }) : t('controls.pctRight', { n: pct });
  }
  return String(v);
}

function rangeProgress(value, min, max, log) {
  const lo = log ? Math.log2(min) : min;
  const hi = log ? Math.log2(max) : max;
  const cur = log ? Math.log2(Math.max(min, value)) : value;
  return Math.min(100, Math.max(0, ((cur - lo) / Math.max(1e-6, hi - lo)) * 100)).toFixed(1);
}

function range(key, label, min, max, step = 1, log = false, hint = '') {
  const value = settings[active][key];
  const pct = rangeProgress(value, min, max, log);
  const formatted = formatValue(key, value);
  return `<div class="control-group"><label for="control-${key}">${esc(label)}<output id="output-${key}" dir="auto">${esc(formatted)}</output></label><input type="range" id="control-${key}" data-param="${key}" ${log ? 'data-log="true"' : ''} min="${log ? Math.log2(min) : min}" max="${log ? Math.log2(max) : max}" step="${log ? '.005' : step}" value="${log ? Math.log2(value) : value}" style="--progress:${pct}%" aria-valuetext="${esc(formatted)}" title="${esc(t('workbench.doubleClickReset'))}"><div class="range-endpoints"><span>${esc(formatValue(key, min))}</span><span>${esc(hint)}</span><span>${esc(formatValue(key, max))}</span></div></div>`;
}

function segments(key, label, choices) {
  return `<fieldset class="control-group"><legend>${esc(label)}</legend><div class="segmented-control">${choices.map(([value, text]) => `<button data-param-button="${key}" data-value="${value}" aria-pressed="${String(settings[active][key]) === String(value)}" class="${String(settings[active][key]) === String(value) ? 'selected' : ''}">${esc(text)}</button>`).join('')}</div></fieldset>`;
}

function renderControls() {
  const p = settings[active];
  let html = '';
  if (active === 'phase') {
    html = `<div class="preset-row"><span>${esc(t('controls.quickDiscoveries'))}</span><button data-preset="same">${esc(t('controls.presetAligned'))}</button><button data-preset="opposite">${esc(t('controls.presetOpposite'))}</button><button data-preset="cancel">${esc(t('controls.presetCancel'))}</button></div>`;
    html += segments('source', t('controls.soundSource'), [['sine', t('controls.sineWave')], ['complex', t('controls.complexTone')], ['noise', t('controls.noise')]]);
    html += `<div class="two-controls">${segments('mode', t('controls.whatChanges'), [...(p.source === 'sine' ? [['phase', t('controls.phase')]] : []), ['polarity', t('controls.polarity')], ['delay', t('controls.delay')]])}${segments('routing', t('controls.whereGoes'), [['stereo', t('controls.separateEars')], ['mono', t('controls.mixMono')]])}</div>`;
    if (p.source !== 'noise') html += range('frequency', t('controls.frequency'), 125, 2000, 1, true);
    if (p.mode === 'phase') html += range('phase', t('controls.relativePhase'), 0, 360, 1, false, t('controls.oneCycle'));
    else if (p.mode === 'polarity') html += segments('phase', t('controls.rightPolarity'), [[0, t('controls.matching')], [180, t('controls.upsideDown')]]);
    else html += range('delayMs', t('controls.rightDelay'), 0, 2, .05);
  } else if (active === 'beats') {
    html = range('frequency', t('controls.firstTone'), 100, 800, 1, true)
      + range('difference', t('controls.freqSpacing'), .5, 20, .5, false, t('controls.setsBeatRate'))
      + segments('routing', t('controls.listenTones'), [['together', t('controls.mixedTogether')], ['separate', t('controls.oneEachEar')]]);
  } else if (active === 'harmonics') {
    html = `<div class="preset-row"><span>${esc(t('controls.quickDiscoveries'))}</span><button data-preset="full">${esc(t('controls.presetFullHarmonics'))}</button><button data-preset="missing">${esc(t('controls.presetMissingFund'))}</button><button data-preset="pure">${esc(t('controls.presetPureTone'))}</button></div>`
      + range('fundamental', t('controls.fundamentalFreq'), 100, 500, 1, true);
    html += `<div class="harmonic-bank">${p.harmonics.map((v, i) => `<div class="harmonic-control" style="--h-level:${Math.round(v * 100)}%"><output dir="ltr">${Math.round(v * 100)}%</output><div class="harmonic-fader-wrap"><div class="harmonic-bar-fill" aria-hidden="true"></div><input type="range" data-harmonic="${i}" aria-label="${esc(t('controls.harmonicAria', { n: i + 1, hz: Math.round((i + 1) * p.fundamental) }))}" min="0" max="1" step=".01" value="${v}" title="${esc(t('workbench.doubleClickReset'))}"></div><button type="button" class="harmonic-label-btn" data-toggle-harmonic="${i}" title="${esc(t('controls.toggleHarmonic', { n: i + 1 }))}"><strong dir="ltr">${i === 0 ? 'F₀' : `${i + 1}×`}</strong><span dir="ltr">${Math.round((i + 1) * p.fundamental)} Hz</span></button></div>`).join('')}</div><p class="control-hint">${esc(t('controls.harmonicHint'))}</p>`;
  } else if (active === 'amplitude') {
    html = segments('shape', t('controls.waveShape'), [['sine', t('controls.sine')], ['triangle', t('controls.triangle')], ['square', t('controls.square')], ['sawtooth', t('controls.sawtooth')]])
      + range('frequency', t('controls.frequency'), 100, 1000, 1, true)
      + range('gainDb', t('controls.relativeGain'), -30, 0, 1, false, t('controls.signalRatioHint'));
  } else if (active === 'spatial') {
    html = segments('source', t('controls.soundSource'), [['noise', t('controls.broadbandNoise')], ['sine', t('controls.pureTone')]])
      + range('pan', t('controls.lrBalance'), -1, 1, .01)
      + range('delayMs', t('controls.waveDelay'), -1, 1, .025, false, t('controls.rightLagsHint'));
    if (p.source === 'sine') html += range('frequency', t('controls.toneFreq'), 125, 1500, 1, true);
  } else if (active === 'masking') {
    html = segments('invertTone', t('controls.toneInEars'), [[false, t('controls.matchingTones')], [true, t('controls.oppositeTone')]])
      + range('snr', t('controls.toneRelNoise'), -30, 0, 1, false, t('controls.lowerHarderHint'))
      + segments('routing', t('controls.output'), [['stereo', t('controls.separateEars')], ['mono', t('controls.mixMono')]])
      + `<p class="control-hint">${esc(t('controls.maskingHint'))}</p>`;
  } else if (active === 'noise') {
    html = segments('color', t('controls.chooseSpectrum'), [['white', t('controls.white')], ['pink', t('controls.pink')], ['brown', t('controls.brown')]])
      + `<p class="control-hint">${esc(t('controls.noiseHint'))}</p>`;
  } else if (active === 'shepard') {
    html = segments('direction', t('controls.chooseDirection'), [['up', t('controls.alwaysAscending')], ['down', t('controls.alwaysDescending')]])
      + `<p class="control-hint">${esc(t('controls.shepardHint'))}</p>`;
  } else if (active === 'frequency') {
    html = range('frequency', t('controls.toneFreq'), 80, Math.min(18000, .45 * (engine.sampleRate || 48000)), 1, true)
      + `<div class="frequency-presets" dir="ltr">${[125, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000].map(f => `<button data-frequency="${f}" class="${Math.abs(p.frequency - f) < 1 ? 'selected' : ''}">${f < 1000 ? f : `${f / 1000}k`}</button>`).join('')}</div>`
      + segments('ear', t('controls.listenWith'), [['both', t('controls.bothEars')], ['left', t('controls.leftOnly')], ['right', t('controls.rightOnly')]])
      + `<p class="control-hint">${esc(t('controls.frequencyHint'))}</p>`;
  } else if (active === 'pitch') {
    html = range('frequency', t('controls.tryPitch'), 100, 4000, 1, true)
      + `<p class="control-hint">${esc(t('controls.pitchHint'))}</p>`;
  } else if (active === 'gap') {
    html = range('gapMs', t('controls.silentPlateau'), 1, 64, 1, false, t('controls.gapEdgesHint'))
      + `<p class="control-hint">${esc(t('controls.gapHint'))}</p>`;
  }
  // Rebuilding the controls must not throw away keyboard focus.
  const focused = document.activeElement?.closest?.('#experiment-controls') ? document.activeElement : null;
  const focusKey = focused && (focused.id ? `#${focused.id}` : focused.dataset.paramButton ? `[data-param-button="${focused.dataset.paramButton}"][data-value="${focused.dataset.value}"]` : focused.dataset.preset ? `[data-preset="${focused.dataset.preset}"]` : focused.dataset.frequency ? `[data-frequency="${focused.dataset.frequency}"]` : focused.dataset.harmonic !== undefined ? `[data-harmonic="${focused.dataset.harmonic}"]` : focused.dataset.toggleHarmonic !== undefined ? `[data-toggle-harmonic="${focused.dataset.toggleHarmonic}"]` : null);
  const controls = document.querySelector('#experiment-controls');
  controls.innerHTML = html;
  if (focusKey) controls.querySelector(focusKey)?.focus({ preventScroll: true });
}

const LISTEN_TEXT = {
  phase: p => p.routing === 'mono' ? t('controls.listenPhaseMono') : t('controls.listenPhaseStereo'),
  beats: p => {
    const f1 = p.frequency, f2 = Number(p.frequency) + Number(p.difference);
    return p.routing === 'separate' ? t('controls.listenBeatsSeparate', { f1, f2 }) : t('controls.listenBeatsTogether', { f1, f2 });
  },
  harmonics: () => t('controls.listenHarmonics'),
  amplitude: p => t('controls.listenAmplitude', { shape: getLanguage() === 'de' ? t(`controls.${p.shape}`) : t(`controls.${p.shape}`).toLowerCase() }),
  spatial: p => p.source === 'sine' ? t('controls.listenSpatialSine') : t('controls.listenSpatialNoise'),
  masking: () => t('controls.listenMasking'),
  noise: p => t('controls.listenNoise', { color: getLanguage() === 'de' ? t(`controls.${p.color}`) : t(`controls.${p.color}`).toLowerCase() }),
  shepard: p => p.direction === 'down' ? t('controls.listenShepardDown') : t('controls.listenShepardUp'),
  frequency: () => t('controls.listenPureTone'),
  pitch: () => t('controls.listenPureTone'),
  gap: () => t('controls.listenGap'),
};

function updatePicture() {
  const host = document.querySelector('#picture');
  if (!host || !byId[active]) return;
  const live = engine.live ? engine.liveInfo : null;
  shownPitchClass = live?.pitchClass ?? 0;
  const drawn = picture(active, settings[active], live);
  host.innerHTML = drawn.svg;
  document.querySelector('#picture-title').textContent = drawn.title;
  document.querySelector('#picture-caption').textContent = drawn.caption;
  const hintEl = document.querySelector('#picture-hint');
  if (hintEl) hintEl.textContent = drawn.hint || '';
}

function updateVisual() {
  if (!byId[active] || currentMode !== 'explore' || !document.querySelector('#signal-visual')) return;
  try {
    const beforeRouting = ['phase', 'masking'].includes(active);
    const fullClip = ['beats', 'gap', 'shepard', 'masking'].includes(active);
    // The scope needs the whole clip only where it draws an envelope; elsewhere half a second is plenty.
    const visualParams = { ...settings[active], ...(beforeRouting ? { routing: 'stereo' } : {}), ...(fullClip ? {} : { duration: .5 }) };
    const rendered = renderExperiment(active, visualParams, engine.sampleRate || 48000, 12345);
    const showSpectrum = ['noise', 'harmonics', 'amplitude'].includes(active) || forceSpectrum;
    document.querySelector('#signal-visual').innerHTML = signalScope(rendered, active, settings[active]) + (showSpectrum ? spectrumView(rendered) : '');
    document.querySelector('#scope-context').textContent = beforeRouting
      ? t('workbench.scopeBeforeRouting')
      : active === 'beats'
        ? t('workbench.scopeSecondsEnv', { n: rendered.duration.toFixed(0) })
        : fullClip
          ? t('workbench.scopeLoopEnv', { n: rendered.duration.toFixed(1) })
          : t('workbench.scopeExcerpt');
    document.querySelector('#listen-description').textContent = LISTEN_TEXT[active](settings[active]);
    updatePicture();
  } catch (error) {
    console.error(error);
    toast(t('toasts.renderError'));
  }
}

/** Push the current settings to the sound that is already playing, and redraw. */
function settingsChanged() {
  engine.updateLive(active, settings[active]);
  cancelAnimationFrame(previewFrame);
  previewFrame = requestAnimationFrame(updateVisual);
}

function syncControlInput(key, value) {
  const input = document.querySelector(`#control-${key}`);
  const output = document.querySelector(`#output-${key}`);
  if (output) output.textContent = formatValue(key, value);
  if (input) {
    const log = Boolean(input.dataset.log);
    const rawVal = log ? Math.log2(Math.max(1, value)) : value;
    input.value = String(rawVal);
    const min = Number(input.min), max = Number(input.max);
    const pct = Math.min(100, Math.max(0, ((rawVal - min) / Math.max(1e-6, max - min)) * 100)).toFixed(1);
    input.style.setProperty('--progress', `${pct}%`);
    input.setAttribute('aria-valuetext', formatValue(key, value));
  }
  if (active === 'frequency' && key === 'frequency') {
    document.querySelectorAll('.frequency-presets button').forEach(b => b.classList.toggle('selected', Math.abs(value - Number(b.dataset.frequency)) < 1));
  }
}

function changeParameter(key, value, rebuild = false) {
  settings[active][key] = value;
  if (active === 'phase' && key === 'source' && value !== 'sine' && settings.phase.mode === 'phase') {
    settings.phase.mode = 'polarity';
    settings.phase.phase = settings.phase.phase >= 90 && settings.phase.phase < 270 ? 180 : 0;
  }
  if (active === 'phase' && key === 'mode' && value === 'polarity' && ![0, 180].includes(Number(settings.phase.phase))) settings.phase.phase = 180;
  if (rebuild) renderControls();
  else syncControlInput(key, value);
  settingsChanged();
}

function setupSnapshot() {
  return { labVolume: engine.volume, sampleRate: engine.sampleRate || null, headphonesConfirmed: !!prefs.setup, calibrated: false };
}

function formatNoteSummary(n) {
  if (n.type === 'challenge' && n.result) {
    const r = n.result;
    const chips = [];
    if (r.kind === 'pitch' && r.metrics?.cents != null) chips.push(`${Number(r.metrics.cents.toFixed(1))} ${t('challenges.centsApart')} (${Number(r.metrics.differenceHz.toFixed(1))} Hz)`);
    if (r.kind === 'gap' && r.metrics?.gapMs != null) chips.push(t('notebook.chipGap', { ms: Number(r.metrics.gapMs.toFixed(1)) }));
    if (Array.isArray(r.trials) && r.trials.length) chips.push(t('notebook.chipRounds', { n: r.trials.length }));
    if (Array.isArray(r.reversals) && r.reversals.length) chips.push(t('notebook.chipReversals', { n: r.reversals.length }));
    const chart = r.kind === 'frequency' && Array.isArray(r.metrics?.points)
      ? frequencyMapChart(r.metrics.points)
      : (r.kind === 'pitch' || r.kind === 'gap') && Array.isArray(r.trials)
        ? staircaseChart(r.trials, r.reversals, r.kind)
        : '';
    return `${chips.length ? `<div class="note-chips">${chips.map(c => `<span class="note-chip">${esc(c)}</span>`).join('')}</div>` : ''}${chart}`;
  }
  if (n.params && typeof n.params === 'object') {
    const labels = {
      frequency: t('controls.frequency'),
      fundamental: t('controls.fundamentalFreq'),
      phase: t('controls.phase'),
      difference: t('controls.freqSpacing'),
      delayMs: t('controls.delay'),
      gapMs: t('controls.silentPlateau'),
      snr: t('controls.toneRelNoise'),
      gainDb: t('controls.relativeGain'),
      pan: t('controls.lrBalance'),
      routing: t('controls.output'),
      source: t('controls.soundSource'),
      shape: t('controls.waveShape'),
      color: t('controls.chooseSpectrum'),
      direction: t('controls.chooseDirection'),
      ear: t('controls.listenWith'),
    };
    const chips = Object.entries(n.params)
      .filter(([k]) => !['duration', 'steps'].includes(k))
      .map(([k, v]) => {
        if (k === 'harmonics' && Array.isArray(v)) return `${t('notebook.chipHarmonics')}: ${v.map(x => `${Math.round(x * 100)}%`).join(' / ')}`;
        if (k === 'invertTone') return v ? t('controls.oppositeTone') : t('controls.matchingTones');
        return `${labels[k] || k}: ${formatValue(k, v)}`;
      });
    return chips.length ? `<div class="note-chips">${chips.map(c => `<span class="note-chip">${esc(c)}</span>`).join('')}</div>` : '';
  }
  return '';
}

function renderNotebook() {
  const notes = readNotes();
  main().innerHTML = `<section class="simple-header"><div class="eyebrow">${esc(t('notebook.eyebrow'))}</div><div class="title-and-action"><h1>${esc(t('notebook.title'))}<span class="heading-dot">.</span></h1><button class="outline-button" data-action="export" ${notes.length ? '' : 'disabled'}>${icon('download')} ${esc(t('notebook.exportJson'))}</button></div><p>${esc(t('notebook.subtitle'))}</p></section>${notes.length ? `<div class="notebook-grid">${notes.map(n => {
    const exp = byId[n.experiment] ? localizedExperiment(byId[n.experiment]) : null;
    const tryHref = n.params && n.type !== 'challenge'
      ? `#${esc(n.experiment)}?${new URLSearchParams({ s: JSON.stringify(n.params), mode: 'explore' })}`
      : `#${esc(n.experiment)}`;
    return `<article class="notebook-card"><div class="note-top"><span>${exp?.number || '—'} / ${esc(exp?.title || t('notebook.listeningNote'))}</span><button class="icon-button" data-delete-note="${esc(n.id)}" aria-label="${esc(t('notebook.deleteAria'))}">${icon('close')}</button></div><h2>${esc(n.title || t('notebook.smallDiscovery'))}</h2><p class="note-text">${esc(n.observation || '')}</p>${n.type === 'challenge' ? `<span class="note-badge">${esc(t('notebook.challengeBadge', { status: n.result?.status || 'saved' }))}</span>` : ''}${formatNoteSummary(n)}<details><summary>${esc(t('notebook.settingsSummary'))}</summary><pre dir="ltr">${esc(JSON.stringify(n.type === 'challenge' ? n.result : n.params, null, 2))}</pre></details><footer><time datetime="${esc(n.createdAt)}">${esc(new Date(n.createdAt).toLocaleDateString(getLanguage(), { day: 'numeric', month: 'short', year: 'numeric' }))}</time><a href="${tryHref}">${esc(t('notebook.tryAgain'))} ${icon('arrow')}</a></footer></article>`;
  }).join('')}</div>` : `<div class="empty-notebook"><div>${icon('book')}</div><h2>${esc(t('notebook.emptyTitle1'))}<br>${esc(t('notebook.emptyTitle2'))}</h2><p>${esc(t('notebook.emptyBody1'))}<br>${esc(t('notebook.emptyBody2'))}</p><a class="primary-button" href="#explore">${esc(t('notebook.emptyCta'))} ${icon('arrow')}</a></div>`}<div class="notebook-privacy">${icon('info')}<p>${esc(t('notebook.privacy'))}</p></div>`;
}

function renderAbout() {
  const bullets = tRaw('about.bullets') || [];
  main().innerHTML = `<section class="simple-header"><div class="eyebrow">${esc(t('about.eyebrow'))}</div><h1>${esc(t('about.title'))}<span class="heading-dot">.</span></h1><p>${esc(t('about.subtitle'))}</p></section><div class="about-grid"><article><h2>${esc(t('about.whatTitle'))}</h2><p>${esc(t('about.whatP1'))}</p><p>${esc(t('about.whatP2'))}</p><h2>${esc(t('about.expTitle'))}</h2><p>${esc(t('about.expP1'))}</p><h2>${esc(t('about.chalTitle'))}</h2><p>${esc(t('about.chalP1'))}</p><h2>${esc(t('about.comfortTitle'))}</h2><p>${esc(t('about.comfortP1'))}</p></article><aside><div class="about-card"><h3>${esc(t('about.footprintTitle'))}</h3><ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul><a class="outline-button" href="https://github.com/silviot/hearing-lab" target="_blank" rel="noopener noreferrer">${esc(t('about.githubRepo'))} <span dir="ltr">↗</span></a><a class="source-download" href="./hearing-lab-source.tar.gz" download>${esc(t('about.downloadCompleteSource'))} <span dir="ltr">↓</span></a><p class="license-note">${esc(t('about.licenseNote'))}</p></div><div class="about-card"><h3>${esc(t('about.readingTitle'))}</h3><a href="https://www.w3.org/TR/webaudio-1.0/" target="_blank" rel="noopener noreferrer">${esc(t('about.readWebAudio'))} <span dir="ltr">↗</span></a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11362506/" target="_blank" rel="noopener noreferrer">${esc(t('about.readPsycho'))} <span dir="ltr">↗</span></a><a href="https://deutsch.ucsd.edu/psychology/pages.php?i=213" target="_blank" rel="noopener noreferrer">${esc(t('about.readDeutsch'))} <span dir="ltr">↗</span></a><a href="https://www.mathpsy.uni-tuebingen.de/acoulab/calibration.html" target="_blank" rel="noopener noreferrer">${esc(t('about.readCalib'))} <span dir="ltr">↗</span></a></div></aside></div>`;
}

function showSetup() {
  engine.stop('setup');
  const dialog = document.querySelector('#setup-dialog');
  dialog.innerHTML = `<button class="dialog-close icon-button" data-action="close-setup" aria-label="${esc(t('setup.closeAria'))}">${icon('close')}</button><span class="setup-hero-icon">${icon('headphones')}</span><div class="eyebrow">${esc(t('setup.eyebrow'))}</div><h2 id="setup-title">${esc(t('setup.title'))}</h2><p>${esc(t('setup.body'))}</p><div class="channel-checks"><button class="outline-button" data-check-ear="left">${icon('play')} ${esc(t('setup.leftEar'))}</button><button class="outline-button" data-check-ear="right">${icon('play')} ${esc(t('setup.rightEar'))}</button></div><p class="setup-small">${esc(t('setup.monoNote'))}</p><label class="setup-checkbox"><input type="checkbox" id="setup-confirm" ${prefs.setup ? 'checked' : ''}> ${esc(t('setup.confirmLabel'))}</label><button class="primary-button setup-done" data-action="finish-setup">${esc(t('setup.readyBtn'))} ${icon('arrow')}</button><p class="setup-small">${esc(t('setup.disclaimer'))}</p>`;
  dialog.showModal();
}

function audioState(state) {
  const isPlaying = Boolean(state.playing), isLive = isPlaying && Boolean(state.live);
  document.querySelector('#audio-status-dot')?.classList.toggle('playing', isPlaying);
  const status = document.querySelector('#audio-status');
  if (status) status.textContent = isLive ? t('dock.playingLive') : isPlaying ? t('dock.listening') : t('dock.ready');
  const button = document.querySelector('#listen-button');
  if (button) {
    button.innerHTML = isLive ? `${icon('stop')}<span>${esc(t('workbench.stop'))}</span>` : `${icon('play')}<span>${esc(t('workbench.play'))}</span>`;
    button.classList.toggle('is-playing', isLive);
    button.setAttribute('aria-pressed', String(isLive));
  }
  const badge = document.querySelector('#live-badge');
  if (badge) badge.hidden = !isLive;
  document.querySelector('#picture-panel')?.classList.toggle('is-live', isLive);
  cancelAnimationFrame(animation);
  if (isLive) {
    if (byId[active]) {
      visited.add(active);
      prefs.explored = [...visited];
      savePreferences(prefs);
      document.querySelector(`[data-page="${active}"] .nav-dot`)?.classList.add('visited');
    }
    animation = requestAnimationFrame(followLive);
  } else {
    document.querySelector('.scope-playhead')?.setAttribute('opacity', '0');
    if (shownPitchClass && !isPlaying) updatePicture();
    if (['interrupted', 'devicechange', 'error'].includes(state.reason)) toast(t('toasts.playbackStopped'));
  }
}

/** While a looping experiment plays, move the scope playhead and keep the picture on the current step. */
function followLive() {
  if (!engine.live) return;
  const info = engine.liveInfo;
  const line = document.querySelector('.scope-playhead');
  if (line && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const cycle = info && info.cycle >= 0 ? info.cycle : ((performance.now() / 1400) % 1);
    const x = String((cycle * 760).toFixed(1));
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    line.setAttribute('opacity', '.65');
  }
  if (info && info.cycle >= 0 && active === 'shepard' && info.pitchClass !== shownPitchClass) updatePicture();
  animation = requestAnimationFrame(followLive);
}

async function listen() {
  try {
    if (engine.live) engine.stop('stopped');
    else await engine.startLive(active, settings[active], { seed: 12345 });
  } catch (error) {
    console.error(error);
    toast(t('toasts.audioStartFailed'));
  }
}

let toastTimer;
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 4200);
}
function updateCount() {
  const countEl = document.querySelector('#note-count');
  if (countEl) countEl.textContent = readNotes().length;
}

function loadSharedParams(id, encoded) {
  try {
    const serialized = new URLSearchParams(encoded).get('s');
    if (!serialized || serialized.length > 4000) return;
    const values = JSON.parse(serialized), original = byId[id].defaults;
    const allowed = { color: ['white', 'pink', 'brown'], source: id === 'phase' ? ['sine', 'complex', 'noise'] : ['sine', 'noise'], mode: ['phase', 'polarity', 'delay'], routing: id === 'beats' ? ['together', 'separate'] : ['stereo', 'mono'], direction: ['up', 'down'], shape: ['sine', 'triangle', 'square', 'sawtooth'], ear: ['both', 'left', 'right'] };
    for (const key of Object.keys(original)) {
      const v = values[key];
      if (typeof original[key] === 'number' && Number.isFinite(v)) settings[id][key] = v;
      else if (typeof original[key] === 'boolean' && typeof v === 'boolean') settings[id][key] = v;
      else if (typeof original[key] === 'string' && allowed[key]?.includes(v)) settings[id][key] = v;
      else if (Array.isArray(original[key]) && Array.isArray(v) && v.length === 6 && v.every(x => Number.isFinite(x) && x >= 0 && x <= 1)) settings[id][key] = v;
    }
    // Shared links are untrusted. Renderers clamp all signal parameters; constrain the UI too.
    const p = settings[id];
    const frequencyBounds = { phase: [125, 2000], beats: [100, 800], amplitude: [100, 1000], spatial: [125, 1500], masking: [500, 500], pitch: [100, 4000], frequency: [80, Math.min(18000, .45 * (engine.sampleRate || 48000))] };
    if ('frequency' in p) { const [min, max] = frequencyBounds[id] || [80, 4000]; p.frequency = Math.min(max, Math.max(min, p.frequency)); }
    if ('fundamental' in p) p.fundamental = Math.min(500, Math.max(100, p.fundamental));
    if ('duration' in p) p.duration = original.duration;
    if ('steps' in p) p.steps = 12;
    if ('phase' in p) p.phase = ((p.phase % 360) + 360) % 360;
    if ('pan' in p) p.pan = Math.min(1, Math.max(-1, p.pan));
    if ('delayMs' in p) p.delayMs = Math.min(id === 'spatial' ? 1 : 2, Math.max(id === 'spatial' ? -1 : 0, p.delayMs));
    if ('difference' in p) p.difference = Math.min(20, Math.max(.5, p.difference));
    if ('snr' in p) p.snr = Math.min(0, Math.max(-30, p.snr));
    if ('gainDb' in p) p.gainDb = Math.min(0, Math.max(-30, p.gainDb));
    if ('gapMs' in p) p.gapMs = Math.min(64, Math.max(1, p.gapMs));
    if (id === 'phase' && p.source !== 'sine' && p.mode === 'phase') p.mode = 'polarity';
    if (id === 'phase' && p.mode === 'polarity') p.phase = p.phase >= 90 && p.phase < 270 ? 180 : 0;
  } catch { /* Invalid links simply use the experiment defaults. */ }
}

function toggleHarmonic(idx) {
  const current = settings.harmonics.harmonics[idx];
  const def = byId.harmonics.defaults.harmonics[idx] || 0.5;
  settings.harmonics.harmonics[idx] = current > 0.01 ? 0 : def;
  renderControls();
  settingsChanged();
}

// Direct manipulation on explanatory SVG diagrams.
let activeDrag = null;
function applyPictureDrag(event) {
  if (!activeDrag) return;
  const svg = document.querySelector('#picture .picture-svg');
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const vx = (event.clientX - rect.left) / rect.width * 760;
  const vy = (event.clientY - rect.top) / rect.height * 250;
  const { key, axis, min, max, c0, c1, log } = activeDrag;
  const coord = axis === 'y' ? vy : vx;
  const u = Math.min(1, Math.max(0, (coord - c0) / (c1 - c0)));
  let val = log ? min * (max / min) ** u : min + u * (max - min);
  if (['frequency', 'fundamental', 'phase', 'snr', 'gainDb', 'gapMs'].includes(key)) val = Math.round(val);
  else if (key === 'difference') val = Math.round(val * 2) / 2;
  else if (['delayMs', 'pan'].includes(key)) val = Math.round(val * 40) / 40;
  const maxFreq = Math.min(18000, .45 * (engine.sampleRate || 48000));
  if (active === 'frequency' && key === 'frequency') val = Math.min(maxFreq, val);
  changeParameter(key, val, false);
}
app.addEventListener('pointerdown', event => {
  const dragEl = event.target.closest?.('[data-drag-param]');
  if (!dragEl) return;
  event.preventDefault();
  const axis = dragEl.dataset.dragAxis === 'y' ? 'y' : 'x';
  activeDrag = {
    key: dragEl.dataset.dragParam,
    axis,
    min: Number(dragEl.dataset.dragMin),
    max: Number(dragEl.dataset.dragMax),
    c0: Number(axis === 'y' ? dragEl.dataset.dragY0 : dragEl.dataset.dragX0),
    c1: Number(axis === 'y' ? dragEl.dataset.dragY1 : dragEl.dataset.dragX1),
    log: dragEl.dataset.dragLog === 'true',
  };
  applyPictureDrag(event);
});
window.addEventListener('pointermove', event => { if (activeDrag) applyPictureDrag(event); });
window.addEventListener('pointerup', () => { activeDrag = null; });
window.addEventListener('pointercancel', () => { activeDrag = null; });

app.addEventListener('change', async event => {
  if (event.target.id === 'language-select') {
    const newLang = event.target.value;
    const savedObs = document.querySelector('#observation')?.value || '';
    const scrollY = window.scrollY;
    prefs.lang = newLang;
    savePreferences(prefs);
    await loadLanguage(newLang);
    applyLanguageToDocument();
    shell();
    document.querySelector('#setup-dialog').addEventListener('cancel', () => engine.stop('setup closed'));
    renderRoute({ preserveMode: true, preserveScroll: true });
    const obsField = document.querySelector('#observation');
    if (obsField && savedObs) obsField.value = savedObs;
    window.scrollTo({ top: scrollY, behavior: 'instant' });
  }
});

app.addEventListener('click', async event => {
  const clickHarmonic = event.target.closest?.('[data-click-harmonic]');
  if (clickHarmonic && active === 'harmonics') { toggleHarmonic(Number(clickHarmonic.dataset.clickHarmonic)); return; }
  const clickParam = event.target.closest?.('[data-click-param]');
  if (clickParam && byId[active]) {
    const key = clickParam.dataset.clickParam;
    let v = clickParam.dataset.clickValue;
    if (typeof settings[active][key] === 'number') v = Number(v);
    else if (typeof settings[active][key] === 'boolean') v = v === 'true';
    changeParameter(key, v, true);
    return;
  }
  const target = event.target.closest('button,a');
  if (!target) return;
  if (target.dataset.toggleHarmonic !== undefined && active === 'harmonics') { toggleHarmonic(Number(target.dataset.toggleHarmonic)); return; }
  if (target.dataset.category) {
    category = target.dataset.category;
    document.querySelectorAll('[data-category]').forEach(b => {
      b.classList.toggle('selected', b.dataset.category === category);
      b.setAttribute('aria-pressed', String(b.dataset.category === category));
    });
    renderCards();
    return;
  }
  if (target.dataset.mode) {
    engine.stop('mode changed');
    currentMode = target.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(b => {
      b.classList.toggle('selected', b === target);
      b.setAttribute('aria-pressed', String(b === target));
    });
    renderWorkbench();
    return;
  }
  if (target.dataset.paramButton) {
    const key = target.dataset.paramButton;
    let v = target.dataset.value;
    if (typeof settings[active][key] === 'number') v = Number(v);
    else if (typeof settings[active][key] === 'boolean') v = v === 'true';
    changeParameter(key, v, true);
    return;
  }
  if (target.dataset.frequency) { changeParameter('frequency', Number(target.dataset.frequency), true); return; }
  if (target.dataset.preset) {
    const p = settings[active], preset = target.dataset.preset;
    if (active === 'phase') Object.assign(p, { source: 'sine', mode: 'phase', phase: preset === 'same' ? 0 : 180, routing: preset === 'cancel' ? 'mono' : 'stereo' });
    if (active === 'harmonics') p.harmonics = preset === 'full' ? [1, .65, .45, .3, .22, .16] : preset === 'missing' ? [0, .65, .45, .3, .22, .16] : [1, 0, 0, 0, 0, 0];
    renderControls();
    settingsChanged();
    return;
  }
  if (target.dataset.checkEar) {
    try { await engine.play('frequency', { frequency: 1000, ear: target.dataset.checkEar, duration: .6 }); }
    catch { toast(t('toasts.audioTryAgain')); }
    return;
  }
  if (target.dataset.deleteNote) {
    try { removeNote(target.dataset.deleteNote); updateCount(); renderNotebook(); toast(t('toasts.noteDeleted')); }
    catch { toast(t('toasts.deleteFailed')); }
    return;
  }
  switch (target.dataset.action) {
    case 'menu': document.querySelector('.sidebar').classList.toggle('open'); syncNavigation(); break;
    case 'stop': engine.stop('stopped'); break;
    case 'setup': showSetup(); break;
    case 'close-setup': engine.stop('setup closed'); document.querySelector('#setup-dialog').close(); break;
    case 'finish-setup':
      if (!document.querySelector('#setup-confirm').checked) { toast(t('toasts.confirmSetupFirst')); return; }
      prefs.setup = true; savePreferences(prefs);
      document.querySelector('.setup-dot')?.classList.add('done');
      engine.stop('setup complete');
      document.querySelector('#setup-dialog').close();
      toast(t('toasts.setupComplete'));
      break;
    case 'listen': await listen(); break;
    case 'toggle-spectrum':
      forceSpectrum = !forceSpectrum;
      target.classList.toggle('active', forceSpectrum);
      target.setAttribute('aria-pressed', String(forceSpectrum));
      updateVisual();
      break;
    case 'clear-filter': category = 'all'; query = ''; renderHome(); break;
    case 'reset':
      settings[active] = structuredClone(byId[active].defaults);
      if (currentMode === 'explore') { renderControls(); settingsChanged(); }
      else renderWorkbench();
      toast(t('toasts.experimentReset'));
      break;
    case 'share':
      try {
        const url = new URL(location.href);
        url.hash = `${active}?${new URLSearchParams({ s: JSON.stringify(settings[active]) })}`;
        await navigator.clipboard.writeText(url.href);
        toast(t('toasts.linkCopied'));
      } catch { toast(t('toasts.clipboardUnavailable')); }
      break;
    case 'export': downloadNotes(); toast(t('toasts.exportedJson')); break;
    case 'dictate': if (dictation.listening) dictation.stop(); else dictation.start(document.querySelector('#observation').value); break;
    case 'save-note': {
      dictation.cancel();
      const text = document.querySelector('#observation').value.trim();
      if (!text) { document.querySelector('#observation').focus(); toast(t('toasts.writeObservationFirst')); return; }
      try {
        const e = localizedExperiment(byId[active]);
        saveNote({ experiment: active, title: e.title, type: 'observation', observation: text, params: structuredClone(settings[active]), setup: setupSnapshot() });
        updateCount();
        document.querySelector('#observation').value = '';
        toast(t('toasts.noteSaved'));
      } catch { toast(t('toasts.saveFailed')); }
      break;
    }
  }
});

// Double-click any range slider or harmonic fader to reset that individual parameter.
app.addEventListener('dblclick', event => {
  const el = event.target;
  if (el.dataset?.param && byId[active]) {
    const key = el.dataset.param;
    changeParameter(key, byId[active].defaults[key], true);
  } else if (el.dataset?.harmonic !== undefined && active === 'harmonics') {
    toggleHarmonic(Number(el.dataset.harmonic));
  }
});

app.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'master-volume') {
    engine.setVolume(Number(el.value) / 100);
    prefs.volume = Number(el.value) / 100;
    savePreferences(prefs);
    el.style.setProperty('--progress', `${el.value}%`);
    document.querySelector('#volume-value').textContent = `${el.value}%`;
    return;
  }
  if (el.id === 'experiment-search') { query = el.value; renderCards(); return; }
  if (el.dataset.param) {
    const key = el.dataset.param;
    const value = el.dataset.log ? Math.round(2 ** Number(el.value)) : Number(el.value);
    changeParameter(key, value);
    if (active === 'harmonics' && key === 'fundamental') {
      document.querySelectorAll('.harmonic-control').forEach((c, i) => {
        const hz = Math.round((i + 1) * value);
        c.querySelector('span').textContent = `${hz} Hz`;
        c.querySelector('input').setAttribute('aria-label', t('controls.harmonicAria', { n: i + 1, hz }));
      });
    }
    return;
  }
  if (el.dataset.harmonic !== undefined) {
    const idx = Number(el.dataset.harmonic), val = Number(el.value), pct = Math.round(val * 100);
    settings.harmonics.harmonics[idx] = val;
    const ctrl = el.closest('.harmonic-control');
    if (ctrl) { ctrl.style.setProperty('--h-level', `${pct}%`); ctrl.querySelector('output').textContent = `${pct}%`; }
    settingsChanged();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    engine.stop('stopped');
    document.querySelector('.sidebar')?.classList.remove('open');
    syncNavigation();
    return;
  }
  if (event.key === ' ' && byId[active] && currentMode === 'explore' && !document.querySelector('#setup-dialog[open]') && !event.target.closest?.('button,a,input,textarea,select,summary,[contenteditable]')) {
    event.preventDefault();
    listen();
  }
});
document.querySelector('.skip-link')?.addEventListener('click', event => { event.preventDefault(); main()?.focus(); });
window.addEventListener('resize', syncNavigation);
window.addEventListener('hashchange', () => renderRoute());

(async () => {
  const hashQuery = location.hash.includes('?') ? location.hash.split('?')[1] : '';
  const urlLang = new URLSearchParams(location.search).get('lang') || new URLSearchParams(hashQuery).get('lang');
  const initialLang = detectLanguage({ urlLang, saved: prefs.lang });
  await loadLanguage(initialLang);
  applyLanguageToDocument();
  shell();
  document.querySelector('#setup-dialog').addEventListener('cancel', () => engine.stop('setup closed'));
  renderRoute();
})();
