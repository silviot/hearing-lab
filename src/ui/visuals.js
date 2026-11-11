// SPDX-License-Identifier: AGPL-3.0-only
import { t } from '../i18n/index.js';

const paths = {
  waves: '<path d="M2 8c4-9 6 9 10 0s6 9 10 0M2 16c4-9 6 9 10 0s6 9 10 0"/>',
  wave: '<path d="M2 12c4-15 6 15 10 0s6 15 10 0"/>',
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h3v-7H4Zm16 0h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-3v-7h2Z"/>',
  pulse: '<path d="M2 12h4l3-8 5 16 3-8h5"/>',
  bars: '<path d="M4 18V9m4 9V4m4 14V7m4 11V2m4 16V12"/>',
  steps: '<path d="M3 19h6v-5h6V9h6V4"/>',
  gap: '<path d="M2 8v8m3-12v16m3-12v8m8-8v8m3-12v16m3-12v8"/>',
  map: '<path d="m3 16 4-6 5 3 4-8 5 4M3 21h18M3 3v18"/><circle cx="7" cy="10" r="1.3"/><circle cx="16" cy="5" r="1.3"/>',
  noise: '<path d="m2 12 2-4 2 9 2-14 2 18 2-12 2 7 2-12 2 15 2-9 2 2"/>',
  infinity: '<path d="M12 12c-3-7-10-7-10 0s7 7 10 0 10-7 10 0-7 7-10 0Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  play: '<path d="m8.5 5 11 7-11 7V5Z"/>',
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
  sliders: '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"/>',
  sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>',
  chart: '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/><circle cx="7" cy="15" r="1.3"/><circle cx="11" cy="11" r="1.3"/><circle cx="14" cy="14" r="1.3"/><circle cx="19" cy="8" r="1.3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18"/>',
};
export const icon = (name, cls = '') => `<svg class="icon icon-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.wave}</svg>`;

function wave(fn, y, amp = 32, width = 640, x0 = 0, points = 240) {
  return Array.from({ length: points + 1 }, (_, i) => `${i ? 'L' : 'M'}${(x0 + i / points * width).toFixed(1)},${(y - fn(i / points) * amp).toFixed(1)}`).join(' ');
}

export function heroScope() {
  const leftWave = wave(t => Math.sin(t * Math.PI * 8), 58, 30, 640);
  const rightWave = wave(t => -Math.sin(t * Math.PI * 8), 134, 30, 640);
  const nodes = Array.from({ length: 8 }, (_, i) => {
    const x = ((i + 0.5) / 8 * 640).toFixed(1);
    return `<line x1="${x}" y1="28" x2="${x}" y2="210" stroke="#ffffff" stroke-opacity=".08" stroke-dasharray="2 4"/>`;
  }).join('');
  return `<svg class="hero-scope" dir="ltr" viewBox="0 0 640 240" role="img" aria-label="${t('home.heroAria').replace(/"/g, '&quot;')}">
    <defs>
      <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="currentColor" stroke-opacity=".09"/></pattern>
      <linearGradient id="hero-l" x1="0" y1="28" x2="0" y2="88" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#75d6b1" stop-opacity=".28"/><stop offset="1" stop-color="#75d6b1" stop-opacity="0"/></linearGradient>
      <linearGradient id="hero-r" x1="0" y1="104" x2="0" y2="164" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b8a1f5" stop-opacity=".28"/><stop offset="1" stop-color="#b8a1f5" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="640" height="240" rx="8" fill="url(#hero-grid)"/>
    ${nodes}
    <path d="M0 58H640M0 134H640M0 210H640" stroke="currentColor" opacity=".16"/>
    <path d="${leftWave} L640,58 L0,58 Z" fill="url(#hero-l)"/>
    <path d="${leftWave}" fill="none" stroke="#8ce8c4" stroke-width="2.6" stroke-linecap="round"/>
    <path d="${rightWave} L640,134 L0,134 Z" fill="url(#hero-r)"/>
    <path d="${rightWave}" fill="none" stroke="#c7b6f9" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M0 210H640" stroke="#f6f4e9" stroke-width="2.2" stroke-dasharray="6 5"/>
    <circle cx="320" cy="58" r="3.5" fill="#8ce8c4"/><circle cx="320" cy="134" r="3.5" fill="#c7b6f9"/><circle cx="320" cy="210" r="3.5" fill="#f6f4e9"/>
  </svg>`;
}

/** Bespoke miniature graphic for each of the 11 experiment cards. */
export function cardVisual(id) {
  switch (id) {
    case 'phase':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M4 22H150M4 50H150" stroke="currentColor" opacity=".18" stroke-dasharray="2 3"/>
        <path d="${wave(t => Math.sin(t * Math.PI * 4), 22, 13, 142, 4, 90)}" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="${wave(t => -Math.sin(t * Math.PI * 4), 50, 13, 142, 4, 90)}" fill="none" stroke="currentColor" opacity=".55" stroke-width="2"/>
        <path d="M148 22Q166 22 172 36M148 50Q166 50 172 36" fill="none" stroke="currentColor" opacity=".45" stroke-width="1.5"/>
        <circle cx="177" cy="36" r="8" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.6"/>
        <path d="M174 36h6M177 33v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M189 36H236" stroke="currentColor" stroke-width="2.2" stroke-dasharray="4 4"/>
      </svg>`;
    case 'beats':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M4 36H236" stroke="currentColor" opacity=".15"/>
        <path d="${wave(t => Math.cos(t * Math.PI * 3), 36, 26, 232, 4, 120)}" fill="none" stroke="currentColor" opacity=".4" stroke-width="1.4" stroke-dasharray="3 3"/>
        <path d="${wave(t => -Math.cos(t * Math.PI * 3), 36, 26, 232, 4, 120)}" fill="none" stroke="currentColor" opacity=".4" stroke-width="1.4" stroke-dasharray="3 3"/>
        <path d="${wave(t => Math.sin(t * Math.PI * 26) * Math.cos(t * Math.PI * 3), 36, 25, 232, 4, 180)}" fill="none" stroke="currentColor" stroke-width="1.8"/>
      </svg>`;
    case 'harmonics': {
      const amps = [1, 0.72, 0.52, 0.38, 0.27, 0.19];
      const bars = amps.map((a, i) => {
        const h = a * 48, x = 8 + i * 16;
        return `<rect x="${x}" y="${60 - h}" width="10" height="${h}" rx="2.5" fill="currentColor" opacity="${i === 0 ? .28 : .45 + a * .5}" ${i === 0 ? 'stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"' : ''}/>`;
      }).join('');
      const complex = wave(t => (0.65 * Math.sin(t * Math.PI * 8) + 0.45 * Math.sin(t * Math.PI * 12) + 0.3 * Math.sin(t * Math.PI * 16)) / 1.1, 36, 22, 114, 118, 120);
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M4 60H104M118 36H234" stroke="currentColor" opacity=".2"/>
        ${bars}
        <path d="${complex}" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>`;
    }
    case 'amplitude':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M4 14H236M4 36H236M4 58H236" stroke="currentColor" opacity=".14" stroke-dasharray="2 4"/>
        <path d="${wave(t => Math.sin(t * Math.PI * 4), 36, 24, 72, 4, 60)}" fill="none" stroke="currentColor" stroke-width="2.1"/>
        <path d="${wave(t => (Math.sin(t * Math.PI * 4) >= 0 ? 1 : -1), 36, 13, 72, 84, 80)}" fill="none" stroke="currentColor" opacity=".72" stroke-width="1.9"/>
        <path d="${wave(t => 1 - 2 * ((t * 2) % 1), 36, 6.5, 72, 164, 80)}" fill="none" stroke="currentColor" opacity=".48" stroke-width="1.8"/>
      </svg>`;
    case 'spatial':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M42 16Q28 36 42 56M62 20Q51 36 62 52M82 24Q74 36 82 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".75"/>
        <path d="M198 22Q208 36 198 50M178 26Q185 36 178 46" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".32"/>
        <ellipse cx="98" cy="38" rx="3.5" ry="7" fill="currentColor" opacity=".85"/>
        <ellipse cx="142" cy="38" rx="3.5" ry="7" fill="currentColor" opacity=".4"/>
        <circle cx="120" cy="38" r="19" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.8"/>
        <path d="M116 19L120 12L124 19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="109" cy="38" r="4.5" fill="currentColor"/>
        <circle cx="109" cy="38" r="9" fill="currentColor" fill-opacity=".22"/>
      </svg>`;
    case 'masking':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="${wave(t => Math.sin(t * 97) * Math.cos(t * 41), 36, 20, 232, 4, 160)}" fill="none" stroke="currentColor" opacity=".28" stroke-width="1.4"/>
        <rect x="74" y="10" width="92" height="52" rx="8" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 3"/>
        <path d="${wave(t => Math.sin(t * Math.PI * 6), 36, 18, 80, 80, 80)}" fill="none" stroke="currentColor" stroke-width="2.4"/>
      </svg>`;
    case 'pitch':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M12 52h42v-14h42v-10h42v-7h42v-4h44" fill="none" stroke="currentColor" opacity=".3" stroke-width="1.6" stroke-dasharray="2 3"/>
        <path d="M12 52h34M54 38h34M96 28h34M138 21h34M180 17h44" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="198" cy="17" r="4" fill="currentColor"/>
        <circle cx="155" cy="21" r="3.5" fill="currentColor" opacity=".6"/>
      </svg>`;
    case 'gap':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="${wave(t => (t > 0.40 && t < 0.60) ? 0 : Math.sin(t * 110) * (0.55 + 0.45 * Math.cos(t * 19)), 34, 23, 232, 4, 200)}" stroke="currentColor" fill="none" stroke-width="1.75"/>
        <path d="M98 56v6h44v-6" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <circle cx="120" cy="34" r="2.5" fill="currentColor" opacity=".5"/>
      </svg>`;
    case 'frequency':
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M8 22L232 30V46L8 54Z" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-opacity=".4" stroke-width="1.4"/>
        <path d="${wave(t => Math.exp(-0.5 * ((t - 0.62) / 0.08) ** 2) * Math.sin((t - 0.62) * 90), 38, 22, 224, 8, 160)}" fill="none" stroke="currentColor" stroke-width="2.2"/>
        <line x1="147" y1="12" x2="147" y2="60" stroke="currentColor" stroke-opacity=".5" stroke-dasharray="2 3"/>
        <circle cx="147" cy="18" r="3.5" fill="currentColor"/>
      </svg>`;
    case 'noise': {
      const bars = Array.from({ length: 18 }, (_, i) => {
        const h = 14 + 38 * Math.exp(-i / 10) + 6 * Math.sin(i * 1.9);
        return `<rect x="${8 + i * 12.5}" y="${62 - h}" width="7" height="${h}" rx="2" fill="currentColor" opacity="${(0.32 + 0.58 * (1 - i / 20)).toFixed(2)}"/>`;
      }).join('');
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        ${bars}
        <path d="M8 18L230 52" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M8 28L230 28" stroke="currentColor" opacity=".35" stroke-width="1.5" stroke-dasharray="3 3"/>
      </svg>`;
    }
    case 'shepard': {
      const dome = wave(t => Math.exp(-0.5 * ((t - 0.5) / 0.24) ** 2), 62, 48, 216, 12, 80);
      const stems = Array.from({ length: 7 }, (_, i) => {
        const u = (i + 0.4) / 7;
        const x = (12 + u * 216).toFixed(1);
        const h = Math.exp(-0.5 * ((u - 0.5) / 0.24) ** 2) * 46;
        return `<line x1="${x}" y1="62" x2="${x}" y2="${(62 - h).toFixed(1)}" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="${(0.35 + 0.65 * (h / 46)).toFixed(2)}"/><circle cx="${x}" cy="${(62 - h).toFixed(1)}" r="3" fill="currentColor"/>`;
      }).join('');
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true">
        <path d="M12 62H228" stroke="currentColor" opacity=".22"/>
        <path d="${dome}" fill="none" stroke="currentColor" opacity=".45" stroke-width="1.6" stroke-dasharray="4 3"/>
        ${stems}
      </svg>`;
    }
    default:
      return `<svg dir="ltr" viewBox="0 0 240 72" aria-hidden="true"><path d="${wave(t => Math.sin(t * Math.PI * 6), 36, 24, 240)}" stroke="currentColor" fill="none" stroke-width="1.8"/></svg>`;
  }
}

function channelDbText(samples) {
  let sum = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
    sum += v * v;
  }
  if (peak < 1e-4) return t('workbench.silence');
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const db = 20 * Math.log10(Math.max(1e-5, rms));
  return `${db >= -0.05 ? '0.0' : db.toFixed(1)} dBFS`;
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
  const names = ['L', 'R', 'MONO'];
  const monoArr = Float32Array.from({ length: left.length }, (_, i) => (left[i] + right[i]) / 2);
  const readouts = [channelDbText(left), channelDbText(right), channelDbText(monoArr)];
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
  const pathsMarkup = colors.map((color, i) => {
    const d = envelope ? envelopePath(i) : makePath(i);
    return `<path d="${d}" fill="${envelope ? color : 'none'}" fill-opacity=".38" stroke="${color}" stroke-width="${envelope ? .75 : 1.9}" stroke-linejoin="round"/>`;
  }).join('');
  const laneLabels = centers.map((y, i) =>
    `<g aria-hidden="true">
      <rect x="8" y="${y - 31}" width="42" height="15" rx="3" fill="#13231d" fill-opacity=".72"/>
      <text x="14" y="${y - 20.5}" fill="${colors[i]}" font-size="9.5" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-weight="600">${names[i]}</text>
      <rect x="668" y="${y - 31}" width="84" height="15" rx="3" fill="#13231d" fill-opacity=".72"/>
      <text x="746" y="${y - 20.5}" fill="${colors[i]}" fill-opacity=".88" font-size="9" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" text-anchor="end">${readouts[i]}</text>
    </g>`
  ).join('');
  return `<svg dir="ltr" viewBox="0 0 ${width} ${height}" class="signal-scope" role="img" aria-label="${t('workbench.scopeAria').replace(/"/g, '&quot;')}">
    <defs><pattern id="scope-grid" width="38" height="20" patternUnits="userSpaceOnUse"><path d="M38 0H0V20" fill="none" stroke="#ffffff" stroke-opacity=".055"/></pattern></defs>
    <rect width="760" height="260" fill="url(#scope-grid)"/>
    <path d="M0 90H760M0 170H760" stroke="#ffffff" stroke-opacity=".08" stroke-dasharray="3 5"/>
    ${centers.map(y => `<path d="M0 ${y}H760" stroke="#ffffff" stroke-opacity=".15"/>`).join('')}
    ${pathsMarkup}
    ${laneLabels}
    <line class="scope-playhead" x1="0" x2="0" y1="0" y2="260" stroke="#f3c58f" stroke-width="2" opacity="0"/>
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
  const width=760,height=112,min=60,max=Math.min(18000,rendered.sampleRate*.45),count=90,baseY=86,maxH=70;
  let peakVal = 0, peakIdx = -1, bestBin = 1;
  for (let k = 2; k < power.length - 1; k++) if (power[k] > power[bestBin]) bestBin = k;
  const pL = Math.log(Math.max(1e-18, power[bestBin - 1])), pC = Math.log(Math.max(1e-18, power[bestBin])), pR = Math.log(Math.max(1e-18, power[bestBin + 1]));
  const denom = pL - 2 * pC + pR;
  const delta = Math.abs(denom) > 1e-9 ? 0.5 * (pL - pR) / denom : 0;
  const peakHz = (bestBin + Math.max(-0.5, Math.min(0.5, delta))) * binHz;
  const pts = [];
  const bars=Array.from({length:count},(_,i)=>{
    const lo=min*(max/min)**(i/count),hi=min*(max/min)**((i+1)/count);
    const a=Math.max(1,Math.floor(lo/binHz)),b=Math.min(power.length-1,Math.max(a,Math.floor(hi/binHz)));
    let average=0;
    for(let k=a;k<=b;k++) average+=power[k];
    average/=(b-a+1);
    const db=10*Math.log10(Math.max(1e-12,average));
    const value=Math.max(0,Math.min(1,(db+85)/65));
    const x = i * width / count;
    const y = baseY - value * maxH;
    pts.push(`${i ? 'L' : 'M'}${(x + (width / count - 2) / 2).toFixed(1)},${y.toFixed(1)}`);
    if (value > peakVal) { peakVal = value; peakIdx = i; }
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(width/count-2).toFixed(1)}" height="${(value*maxH).toFixed(1)}" rx="1.5" fill="url(#spec-bar)" opacity="${(0.55 + 0.4 * value).toFixed(2)}"/>`;
  }).join('');
  const peakX = peakIdx >= 0 ? (peakIdx + 0.5) * width / count : 0;
  const peakY = baseY - peakVal * maxH;
  const peakStr = Math.round(peakHz) >= 1000 ? `${(Math.round(peakHz)/1000).toFixed(2)} kHz` : `${Math.round(peakHz)} Hz`;
  const peakLabel = peakVal > 0.15 ? `<g aria-hidden="true"><circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="3" fill="#f3c58f"/><text x="${Math.min(700, Math.max(60, peakX)).toFixed(1)}" y="${Math.max(12, peakY - 6).toFixed(1)}" fill="#f3c58f" font-size="9.5" font-family="ui-monospace,monospace" text-anchor="middle">${t('workbench.peakApprox', { v: peakStr })}</text></g>` : '';
  return `<div class="spectrum-caption">${t('workbench.spectrumTitle')} <span>${t('workbench.spectrumSub')}</span></div><svg dir="ltr" class="spectrum-view" viewBox="0 0 ${width} ${height}" role="img" aria-label="${t('workbench.spectrumAria').replace(/"/g, '&quot;')}">
    <defs><linearGradient id="spec-bar" x1="0" y1="16" x2="0" y2="86" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#75d6b1"/><stop offset="1" stop-color="#5d946f" stop-opacity=".45"/></linearGradient></defs>
    <path d="M0 32H760M0 59H760" stroke="#ffffff" opacity=".06" stroke-dasharray="2 4"/>
    <path d="M0 ${baseY}H760" stroke="#ffffff" opacity=".18"/>
    ${bars}
    <path d="${pts.join(' ')}" fill="none" stroke="#c8f2cf" stroke-width="1.25" stroke-opacity=".55"/>
    ${peakLabel}
    ${[100,250,500,1000,2000,4000,10000].map(f=>`<text x="${(Math.log(f/min)/Math.log(max/min)*width).toFixed(1)}" y="104" fill="#9db3a3" font-size="9.5" font-family="ui-monospace,monospace" text-anchor="middle">${f<1000?f:`${f/1000}k`} Hz</text>`).join('')}
  </svg>`;
}

/** Visual adaptive staircase plot for Pitch and Gap challenge results. */
export function staircaseChart(trials = [], reversals = [], kind = 'pitch') {
  if (!Array.isArray(trials) || !trials.length) return '';
  const W = 680, H = 185, x0 = 58, x1 = 656, y0 = 22, y1 = 152;
  const values = trials.map(tItem => Number(tItem.value)).filter(v => Number.isFinite(v) && v > 0);
  if (!values.length) return '';
  const minV = Math.min(...values) * 0.8, maxV = Math.max(...values) * 1.25;
  const lo = Math.log2(Math.max(0.1, minV)), hi = Math.log2(Math.max(minV + 0.5, maxV));
  const xOf = idx => trials.length === 1 ? (x0 + x1) / 2 : x0 + idx / (trials.length - 1) * (x1 - x0);
  const yOf = val => y1 - (Math.log2(Math.max(0.1, val)) - lo) / Math.max(0.01, hi - lo) * (y1 - y0);
  const revTrials = new Set((reversals || []).map(r => r.trial));
  const poly = trials.map((tItem, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(tItem.value).toFixed(1)}`).join(' ');
  const unit = kind === 'pitch' ? 'Hz' : 'ms';
  const gridVals = [minV / 0.8, Math.sqrt((minV / 0.8) * (maxV / 1.25)), maxV / 1.25];
  const grids = gridVals.map(v => {
    const y = yOf(v);
    const label = v >= 10 ? Math.round(v) : Number(v.toFixed(1));
    return `<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity=".1" stroke-dasharray="3 3"/><text x="${x0 - 8}" y="${(y + 3.5).toFixed(1)}" font-size="10" font-family="ui-monospace,monospace" fill="currentColor" opacity=".65" text-anchor="end">${label} ${unit}</text>`;
  }).join('');
  const dots = trials.map((tItem, i) => {
    const x = xOf(i).toFixed(1), y = yOf(tItem.value).toFixed(1);
    const isRev = revTrials.has(tItem.index || i + 1);
    return `${isRev ? `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="#c98a3b" stroke-width="1.6"/>` : ''}<circle cx="${x}" cy="${y}" r="${tItem.correct ? 4.2 : 3.8}" fill="${tItem.correct ? '#315d4b' : '#fffefa'}" stroke="${tItem.correct ? '#315d4b' : '#b85d43'}" stroke-width="2"/>`;
  }).join('');
  return `<figure class="challenge-chart-wrap"><figcaption class="challenge-chart-legend"><span><strong>${t('challenges.chartAdaptive')}</strong> ${t('challenges.chartRounds', { n: trials.length })}</span><span><i class="dot-correct"></i> ${t('challenges.chartCorrect')}</span><span><i class="dot-miss"></i> ${t('challenges.chartMissed')}</span><span><i class="dot-rev"></i> ${t('challenges.chartReversal')}</span></figcaption><svg dir="ltr" viewBox="0 0 ${W} ${H}" class="challenge-chart" role="img" aria-label="${t('challenges.chartAdaptive')}">
    ${grids}
    <path d="${poly}" fill="none" stroke="#315d4b" stroke-width="2" stroke-opacity=".65" stroke-linejoin="round"/>
    ${dots}
    <text x="${x0}" y="${H - 8}" font-size="10" fill="currentColor" opacity=".6">${t('challenges.chartRoundN', { n: 1 })}</text>
    <text x="${x1}" y="${H - 8}" font-size="10" fill="currentColor" opacity=".6" text-anchor="end">${t('challenges.chartRoundN', { n: trials.length })}</text>
  </svg></figure>`;
}

/** Visual frequency detection bar/pip map for Frequency challenge results. */
export function frequencyMapChart(points = []) {
  if (!Array.isArray(points) || !points.length) return '';
  const W = 680, H = 165, x0 = 46, x1 = 646, baseY = 126;
  const step = (x1 - x0) / Math.max(1, points.length);
  const cols = points.map((p, i) => {
    const cx = x0 + (i + 0.5) * step;
    const trials = Math.max(1, p.trials || 3);
    const ratio = (p.correct || 0) / trials;
    const barH = Math.max(4, ratio * 76);
    const pips = Array.from({ length: trials }, (_, k) => {
      const hit = k < p.correct;
      return `<circle cx="${(cx + (k - (trials - 1) / 2) * 11).toFixed(1)}" cy="24" r="4" fill="${hit ? '#315d4b' : 'none'}" stroke="${hit ? '#315d4b' : '#9aa899'}" stroke-width="1.6"/>`;
    }).join('');
    const lbl = p.frequencyHz >= 1000 ? `${Number((p.frequencyHz / 1000).toFixed(1))}k` : `${p.frequencyHz}`;
    return `<g>
      <rect x="${(cx - 16).toFixed(1)}" y="${(baseY - 76).toFixed(1)}" width="32" height="76" rx="5" fill="#e6ecdd" fill-opacity=".65"/>
      <rect x="${(cx - 16).toFixed(1)}" y="${(baseY - barH).toFixed(1)}" width="32" height="${barH.toFixed(1)}" rx="5" fill="#315d4b" fill-opacity="${(0.25 + 0.75 * ratio).toFixed(2)}"/>
      ${pips}
      <text x="${cx.toFixed(1)}" y="${baseY + 18}" font-size="10.5" font-family="ui-monospace,monospace" font-weight="600" fill="currentColor" text-anchor="middle">${lbl}</text>
      <text x="${cx.toFixed(1)}" y="${baseY + 32}" font-size="9.5" fill="currentColor" opacity=".65" text-anchor="middle">${p.correct}/${trials}</text>
    </g>`;
  }).join('');
  return `<figure class="challenge-chart-wrap"><figcaption class="challenge-chart-legend"><span><strong>${t('challenges.chartDetections')}</strong> ${t('challenges.chartFixedLevel')}</span><span>${t('challenges.chartThreeTries')}</span></figcaption><svg dir="ltr" viewBox="0 0 ${W} ${H}" class="challenge-chart" role="img" aria-label="${t('challenges.chartDetections')}">
    <line x1="${x0 - 10}" y1="${baseY}" x2="${x1 + 10}" y2="${baseY}" stroke="currentColor" stroke-opacity=".2"/>
    ${cols}
  </svg></figure>`;
}
