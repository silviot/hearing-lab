// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrumBins, signalScope } from '../src/ui/visuals.js';
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
