// SPDX-License-Identifier: AGPL-3.0-only
const paths = {
  waves: '<path d="M2 8c4-9 6 9 10 0s6 9 10 0M2 16c4-9 6 9 10 0s6 9 10 0"/>',
  wave: '<path d="M2 12c4-15 6 15 10 0s6 15 10 0"/>',
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Z"/>',
  pulse: '<path d="M2 12h4l3-8 5 16 3-8h5"/>',
  bars: '<path d="M4 18V9m4 9V4m4 14V7m4 11V2m4 16V12"/>',
  steps: '<path d="M3 19h6v-5h6V9h6V4"/>',
  gap: '<path d="M2 8v8m3-12v16m3-12v8m8-8v8m3-12v16m3-12v8"/>',
  map: '<path d="m3 16 4-6 5 3 4-8 5 4M3 21h18M3 3v18"/><circle cx="7" cy="10" r="1"/><circle cx="16" cy="5" r="1"/>',
  noise: '<path d="m2 12 2-4 2 9 2-14 2 18 2-12 2 7 2-12 2 15 2-9 2 2"/>',
  infinity: '<path d="M12 12c-3-7-10-7-10 0s7 7 10 0 10-7 10 0-7 7-10 0Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  book: '<path d="M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Zm0 14h16M8 3v14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  share: '<path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  reset: '<path d="M4 10a8 8 0 1 1 0 5m0-11v6h6"/>',
  volume: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.wave}</svg>`;

function wave(fn, y, amp = 32, width = 640) {
  return Array.from({ length: 241 }, (_, i) => `${i ? 'L' : 'M'}${(i / 240 * width).toFixed(1)},${(y - fn(i / 240) * amp).toFixed(1)}`).join(' ');
}
export function heroScope() {
  return `<svg class="hero-scope" viewBox="0 0 640 240" role="img" aria-label="Matching waveforms become opposite, then their mono average becomes a flat line">
    <defs><pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="currentColor" stroke-opacity=".10"/></pattern></defs>
    <rect width="640" height="240" fill="url(#hero-grid)"/>
    <path d="M0 60H640M0 136H640M0 212H640" stroke="currentColor" opacity=".15"/>
    <path d="${wave(t => Math.sin(t * Math.PI * 8), 60)}" fill="none" stroke="#c8f2cf" stroke-width="2.5"/>
    <path d="${wave(t => -Math.sin(t * Math.PI * 8), 136)}" fill="none" stroke="#c5b9f6" stroke-width="2.5"/>
    <path d="M0 212H640" stroke="#f6f4e9" stroke-width="2" stroke-dasharray="5 5"/>
  </svg>`;
}

export function cardVisual(id) {
  if (id === 'harmonics' || id === 'noise') {
    return `<svg viewBox="0 0 240 70" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => {
      const h = id === 'harmonics' ? (i % 4 === 0 ? 60 / (1 + i / 5) : 3) : (15 + 40 * Math.exp(-i / 14) + 8 * Math.sin(i * 2.2));
      return `<rect x="${i * 10 + 1}" y="${65 - h}" width="5" height="${h}" rx="2" fill="currentColor" opacity="${.4 + .6 * (1 - i / 30)}"/>`;
    }).join('')}</svg>`;
  }
  if (id === 'shepard' || id === 'pitch') return `<svg viewBox="0 0 240 70" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 29} ${58 - (i % 5) * 10}h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="${.4 + i / 15}"/>`).join('')}</svg>`;
  if (id === 'gap') return `<svg viewBox="0 0 240 70" aria-hidden="true"><path d="${wave(t => t > .43 && t < .57 ? 0 : Math.sin(t * 100) * (.5 + .5 * Math.sin(t * 13)), 35, 25, 240)}" stroke="currentColor" fill="none" stroke-width="1.7"/></svg>`;
  const freq = id === 'frequency' ? 15 : id === 'spatial' ? 8 : 4;
  return `<svg viewBox="0 0 240 70" aria-hidden="true"><path d="${wave(t => Math.sin(t * Math.PI * freq) * (id === 'beats' ? Math.cos(t * Math.PI * 3) : 1), 35, 24, 240)}" stroke="currentColor" fill="none" stroke-width="1.8"/>${['phase','spatial','masking'].includes(id) ? `<path d="${wave(t => Math.sin(t * Math.PI * freq + Math.PI), 35, 24, 240)}" stroke="currentColor" opacity=".35" fill="none" stroke-width="1.8"/>` : ''}</svg>`;
}

export function signalScope(rendered, id, params = {}) {
  if (!rendered?.left?.length) return '';
  const { left, right, sampleRate } = rendered;
  const frequency = Number(params.frequency || params.fundamental || 500);
  const envelope = ['beats', 'gap', 'shepard', 'masking'].includes(id);
  const start = envelope ? 0 : Math.min(Math.floor(sampleRate * .15), Math.floor(left.length / 3));
  const length = envelope ? left.length : Math.min(left.length - start, Math.floor(sampleRate * (params.source === 'noise' || id === 'noise' ? .025 : 3 / frequency)));
  const width = 760, height = 260, centers = [49, 129, 209], amplitude = 31;
  // Fixed digital scale across settings: attenuation must visibly shrink a wave.
  const scale = .85;
  const makePath = channel => {
    let d = '';
    for (let i = 0; i <= width; i++) {
      const idx = Math.min(left.length - 1, start + Math.floor(i / width * Math.max(0, length - 1)));
      const value = channel === 0 ? left[idx] : channel === 1 ? right[idx] : (left[idx] + right[idx]) / 2;
      d += `${i ? 'L' : 'M'}${i},${(centers[channel] - value / scale * amplitude).toFixed(2)} `;
    }
    return d;
  };
  const colors = ['#75d6b1', '#b8a1f5', '#e9e5d9'];
  const envelopePath = channel => {
    const upper = [], lower = [];
    for (let i = 0; i < width; i++) {
      const a = Math.floor(i / width * left.length), b = Math.max(a + 1, Math.floor((i + 1) / width * left.length));
      let peak = 0;
      for (let j = a; j < Math.min(b, left.length); j++) peak = Math.max(peak, Math.abs(channel === 0 ? left[j] : channel === 1 ? right[j] : (left[j] + right[j]) / 2));
      upper.push(`${i},${(centers[channel] - peak / scale * amplitude).toFixed(2)}`);
      lower.push(`${i},${(centers[channel] + peak / scale * amplitude).toFixed(2)}`);
    }
    return `M${upper.join(' L')} L${lower.reverse().join(' L')}Z`;
  };
  return `<svg viewBox="0 0 ${width} ${height}" class="signal-scope" role="img" aria-label="Generated left channel, right channel, and their software mono average. ${envelope ? 'Peak envelopes across the full clip.' : 'A short waveform excerpt.'}">
    <defs><pattern id="scope-grid" width="38" height="20" patternUnits="userSpaceOnUse"><path d="M38 0H0V20" fill="none" stroke="#ffffff" stroke-opacity=".055"/></pattern></defs>
    <rect width="760" height="260" fill="url(#scope-grid)"/>
    ${centers.map(y => `<path d="M0 ${y}H760" stroke="#ffffff" stroke-opacity=".14"/>`).join('')}
    ${colors.map((color, i) => `<path d="${envelope ? envelopePath(i) : makePath(i)}" fill="${envelope ? color : 'none'}" fill-opacity=".4" stroke="${color}" stroke-width="${envelope ? .65 : 1.8}"/>`).join('')}
    <line class="scope-playhead" x1="0" x2="0" y1="0" y2="260" stroke="white" opacity="0"/>
  </svg>`;
}

/** A small radix-2 FFT of the actual generated signal, averaged over four windows. */
export function spectrumBins(samples, sampleRate, size = 4096) {
  const power = new Float64Array(size / 2);
  for (let window = 0; window < 4; window++) {
    const re = new Float64Array(size), im = new Float64Array(size);
    const start = Math.min(Math.max(0, samples.length - size), Math.floor(sampleRate * (.08 + window * .09)));
    for(let i=0;i<size;i++) re[i]=(samples[start+i] || 0)*(.5-.5*Math.cos(2*Math.PI*i/(size-1)));
    for(let i=1,j=0;i<size;i++) { let bit=size>>1; for(;j&bit;bit>>=1)j^=bit; j^=bit; if(i<j)[re[i],re[j]]=[re[j],re[i]]; }
    for(let length=2;length<=size;length<<=1) {
      const theta=-2*Math.PI/length;
      for(let start=0;start<size;start+=length) for(let j=0;j<length/2;j++) {
        const a=start+j,b=a+length/2,c=Math.cos(theta*j),s=Math.sin(theta*j);
        const tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;
        re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
      }
    }
    for(let i=0;i<power.length;i++) power[i]+=(re[i]*re[i]+im[i]*im[i])/(size*size*4);
  }
  return {power,binHz:sampleRate/size};
}
export function spectrumView(rendered) {
  const {power,binHz}=spectrumBins(rendered.left,rendered.sampleRate);
  const width=760,height=100,min=60,max=Math.min(18000,rendered.sampleRate*.45),count=90;
  const bars=Array.from({length:count},(_,i)=>{
    const lo=min*(max/min)**(i/count),hi=min*(max/min)**((i+1)/count);
    const a=Math.max(1,Math.floor(lo/binHz)),b=Math.min(power.length-1,Math.max(a,Math.floor(hi/binHz)));
    let average=0;for(let k=a;k<=b;k++)average+=power[k];average/=(b-a+1);
    const db=10*Math.log10(Math.max(1e-12,average));
    const value=Math.max(0,Math.min(1,(db+85)/65));
    return `<rect x="${i*width/count}" y="${78-value*66}" width="${width/count-2}" height="${value*66}" rx="1" fill="#a7c889" opacity=".8"/>`;
  }).join('');
  return `<div class="spectrum-caption">FREQUENCY CONTENT <span>Generated left channel · windowed FFT · fixed digital scale</span></div><svg class="spectrum-view" viewBox="0 0 ${width} ${height}" role="img" aria-label="Frequency spectrum of the generated sound. Low frequencies are on the left, high frequencies on the right. Bar heights use the same digital power scale across settings."><path d="M0 78H760" stroke="#ffffff" opacity=".15"/>${bars}${[100,1000,10000].map(f=>`<text x="${Math.log(f/min)/Math.log(max/min)*width}" y="95" fill="#91a994" font-size="10" font-family="monospace" text-anchor="middle">${f<1000?f:`${f/1000}k`} Hz</text>`).join('')}</svg>`;
}
