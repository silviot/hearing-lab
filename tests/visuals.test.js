// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrumBins, signalScope, spectrumView, cardVisual, staircaseChart, frequencyMapChart } from '../src/ui/visuals.js';
import { picture } from '../src/ui/pictures.js';
import { experiments } from '../src/lib/catalog.js';
import { renderExperiment } from '../src/audio/dsp.js';

test('spectrum locates a generated tone and preserves the power ratio when its amplitude changes', () => {
  const sampleRate=48000, frequency=sampleRate/4096*85;
  const signal=Float32Array.from({length:sampleRate},(_,i)=>.5*Math.sin(2*Math.PI*frequency*i/sampleRate));
  const full=spectrumBins(signal,sampleRate), half=spectrumBins(signal.map(x=>x/2),sampleRate);
  let peak=0;for(let i=1;i<full.power.length;i++)if(full.power[i]>full.power[peak])peak=i;
  assert.equal(peak,85);
  assert.ok(Math.abs(full.power[peak]/half.power[peak]-4)<1e-5);
});

test('waveform display does not normalize away a six-decibel attenuation', () => {
  const loud=renderExperiment('amplitude',{frequency:200,shape:'sine',gainDb:0},48000);
  const soft=renderExperiment('amplitude',{frequency:200,shape:'sine',gainDb:-6},48000);
  function excursion(rendered) {
    const svg=signalScope(rendered,'amplitude',{frequency:200});
    const path=svg.match(/<path d="(M0,[^"]+)" fill="none"/)[1];
    return Math.max(...[...path.matchAll(/[ML][\d.]+,([\d.]+)/g)].map(m=>Math.abs(Number(m[1])-49)));
  }
  const ratio=excursion(soft)/excursion(loud);
  assert.ok(ratio>.49 && ratio<.52);
});

test('every experiment has a unique card visual and an interactive explanatory picture', () => {
  const cards = new Set();
  for (const exp of experiments) {
    const card = cardVisual(exp.id);
    assert.ok(card.startsWith('<svg'), `Missing card SVG for ${exp.id}`);
    cards.add(card);
    const drawn = picture(exp.id, exp.defaults);
    assert.ok(drawn && drawn.svg.includes('class="picture-svg"'), `Missing picture SVG for ${exp.id}`);
    assert.ok(drawn.title.length > 3, `Missing picture title for ${exp.id}`);
    assert.ok(drawn.caption.length > 20, `Missing picture caption for ${exp.id}`);
    assert.ok(drawn.hint.length > 10, `Missing interactive hint for ${exp.id}`);
    assert.ok(drawn.svg.includes('data-drag-param') || drawn.svg.includes('data-click-param') || drawn.svg.includes('data-click-harmonic'), `Picture for ${exp.id} should have interactive attributes`);
  }
  assert.equal(cards.size, experiments.length, 'Every experiment card should have its own distinct graphic');
});

test('spectrumView and challenge charts render valid SVG summaries', () => {
  const rendered = renderExperiment('amplitude', { frequency: 1000, shape: 'sine', gainDb: 0, duration: 0.5 }, 48000);
  const spec = spectrumView(rendered);
  assert.ok(spec.includes('peak ≈ 1.00 kHz'));
  const stair = staircaseChart(
    [{ index: 1, value: 100, correct: true }, { index: 2, value: 50, correct: false }, { index: 3, value: 100, correct: true }],
    [{ trial: 2, value: 50 }],
    'pitch',
  );
  assert.ok(stair.includes('<svg') && stair.includes('Adaptive path'));
  const fmap = frequencyMapChart([{ frequencyHz: 1000, correct: 3, trials: 3 }, { frequencyHz: 8000, correct: 1, trials: 3 }]);
  assert.ok(fmap.includes('<svg') && fmap.includes('1k') && fmap.includes('8k'));
});
