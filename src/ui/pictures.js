// SPDX-License-Identifier: AGPL-3.0-only
// One explanatory picture per experiment. Each is drawn from the current
// settings, so it changes as the controls move. These are sketches of the idea,
// not measurements: the scope below them shows the generated signal itself.
import { t, getLanguage } from '../i18n/index.js';

const W = 760, H = 250;
const LEFT = '#75d6b1', RIGHT = '#b8a1f5', MIX = '#f1ecdc', WARM = '#f3c58f', DIM = '#9db3a3', LINE = '#ffffff';
const TAU = Math.PI * 2;

const r1 = value => Number(value.toFixed(1));
const r2 = value => Number(value.toFixed(2));
const hzText = f => f >= 1000 ? `${r2(f / 1000)} kHz` : `${Math.round(f)} Hz`;
const xmlEsc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const text = (x, y, content, { size = 12, fill = DIM, anchor = 'start', weight = 400, spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" direction="ltr" unicode-bidi="isolate" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${xmlEsc(content)}</text>`;
const label = (x, y, content, fill = DIM, anchor = 'start') => {
  const rtlOrIndic = ['ar', 'ur', 'hi', 'zh'].includes(getLanguage());
  return text(x, y, content, { size: 10.5, fill, anchor, weight: 600, spacing: rtlOrIndic ? 0 : 1.1 });
};

/** A polyline for fn(u), u from 0 to 1, drawn between x0 and x1 around the centre line yc. */
function curve(fn, x0, x1, yc, amp, points = 240) {
  let d = '';
  for (let i = 0; i <= points; i++) {
    const u = i / points;
    d += `${i ? 'L' : 'M'}${(x0 + u * (x1 - x0)).toFixed(1)},${(yc - fn(u) * amp).toFixed(1)}`;
  }
  return d;
}
function areaCurve(fn, x0, x1, yc, amp, points = 240) {
  return `${curve(fn, x0, x1, yc, amp, points)}L${x1.toFixed(1)},${yc.toFixed(1)}L${x0.toFixed(1)},${yc.toFixed(1)}Z`;
}
const stroke = (d, color, width = 2, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const baseline = (x0, x1, y) => `<path d="M${x0} ${y}H${x1}" stroke="${LINE}" stroke-opacity=".14"/>`;

const SHARED_DEFS = `<defs>
  <pattern id="pic-grid" width="38" height="25" patternUnits="userSpaceOnUse"><path d="M38 0H0V25" fill="none" stroke="#ffffff" stroke-opacity=".035"/></pattern>
  <linearGradient id="grad-left" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LEFT}" stop-opacity=".28"/><stop offset="1" stop-color="${LEFT}" stop-opacity=".02"/></linearGradient>
  <linearGradient id="grad-right" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${RIGHT}" stop-opacity=".28"/><stop offset="1" stop-color="${RIGHT}" stop-opacity=".02"/></linearGradient>
  <linearGradient id="grad-warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WARM}" stop-opacity=".26"/><stop offset="1" stop-color="${WARM}" stop-opacity=".02"/></linearGradient>
  <radialGradient id="glow-warm" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${WARM}" stop-opacity=".42"/><stop offset="100%" stop-color="${WARM}" stop-opacity="0"/></radialGradient>
  <radialGradient id="head-fill" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#36584c"/><stop offset="100%" stop-color="#223830"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#pic-grid)"/>`;

// A fixed table of pseudo-random values, so "noise" looks the same on every redraw.
const NOISE = (() => {
  let state = 2463534242;
  return Float32Array.from({ length: 2048 }, () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) / 4294967296) * 2 - 1; });
})();
const noiseAt = u => NOISE[Math.floor((((u % 1) + 1) % 1) * (NOISE.length - 1))];

/** A studio acoustic head seen from the front, wearing headphones. Cup brightness and waves show what reaches each ear. */
function headFront(cx, cy, leftLevel, rightLevel) {
  const lClamped = Math.min(1, Math.max(0, leftLevel));
  const rClamped = Math.min(1, Math.max(0, rightLevel));
  const cup = (x, side, color, level) => {
    const meterH = Math.round(34 * level);
    const waveArc = level > 0.05 ? `<path class="arrive" d="M${x - side * 14} ${cy - 10}Q${x - side * 22} ${cy + 4} ${x - side * 14} ${cy + 18}" fill="none" stroke="${color}" stroke-width="1.8" stroke-opacity="${(0.3 + 0.65 * level).toFixed(2)}" stroke-linecap="round"/>` : '';
    return `<rect x="${x - 10}" y="${cy - 22}" width="20" height="48" rx="9" fill="#182a23" stroke="${color}" stroke-width="1.8"/>
      <rect x="${x - 6}" y="${cy + 22 - meterH}" width="12" height="${meterH}" rx="5" fill="${color}" fill-opacity="${(0.2 + 0.72 * level).toFixed(2)}"/>
      ${waveArc}`;
  };
  return `<path d="M${cx - 52} ${cy - 16}A52 55 0 0 1 ${cx + 52} ${cy - 16}" fill="none" stroke="${DIM}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M${cx - 28} ${cy - 66}A34 12 0 0 1 ${cx + 28} ${cy - 66}" fill="none" stroke="${MIX}" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="${cx}" cy="${cy + 4}" rx="38" ry="45" fill="url(#head-fill)" stroke="${DIM}" stroke-opacity=".75" stroke-width="1.4"/>
    <path d="M${cx - 18} ${cy - 6}Q${cx - 13} ${cy - 9} ${cx - 8} ${cy - 6}M${cx + 8} ${cy - 6}Q${cx + 13} ${cy - 9} ${cx + 18} ${cy - 6}" fill="none" stroke="${DIM}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M${cx} ${cy - 3}v11l-3 2" fill="none" stroke="${DIM}" stroke-opacity=".65" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M${cx - 9} ${cy + 22}Q${cx} ${cy + 27} ${cx + 9} ${cy + 22}" fill="none" stroke="${DIM}" stroke-width="1.6" stroke-linecap="round"/>
    ${cup(cx - 50, -1, LEFT, lClamped)}${cup(cx + 50, 1, RIGHT, rClamped)}
    ${label(cx - 50, cy + 44, 'L', LEFT, 'middle')}${label(cx + 50, cy + 44, 'R', RIGHT, 'middle')}`;
}

function phasePicture(p) {
  const f = Number(p.frequency), mode = p.source !== 'sine' && p.mode === 'phase' ? 'polarity' : p.mode;
  const degrees = Number(p.phase), inverted = mode === 'polarity' && degrees >= 90 && degrees < 270;
  const cycles = 3;
  const shift = mode === 'phase' ? degrees / 360 : mode === 'delay' ? Number(p.delayMs) * f / 1000 : 0;
  const shape = p.source === 'complex' ? x => (Math.sin(x) + Math.sin(2 * x) / 2 + Math.sin(3 * x) / 4 + Math.sin(4 * x) / 8) / 1.45 : Math.sin;
  const leftFn = p.source === 'noise' ? u => noiseAt(.2 + u * .1) : u => shape(TAU * cycles * u);
  const rightRaw = p.source === 'noise' ? u => noiseAt(.2 + (u - (mode === 'delay' ? Number(p.delayMs) / 5 : 0)) * .1) : u => shape(TAU * (cycles * u + (mode === 'phase' ? shift : -shift)));
  const rightFn = u => (inverted ? -1 : 1) * rightRaw(u);
  const mixFn = u => (leftFn(u) + rightFn(u)) / 2;
  let mixPower = 0, leftPower = 0;
  for (let i = 0; i < 300; i++) { mixPower += mixFn(i / 300) ** 2; leftPower += leftFn(i / 300) ** 2; }
  const mixLevel = Math.sqrt(mixPower / leftPower), mono = p.routing === 'mono';
  const x0 = 44, x1 = 300, yl = 74, yr = 176, hx = 655, hy = 118;
  const guides = p.source === 'noise' ? '' : Array.from({ length: cycles }, (_, i) => {
    const x = x0 + (i + .25) / cycles * (x1 - x0);
    return `<path d="M${x.toFixed(1)} ${yl - 40}V${yr + 40}" stroke="${LINE}" stroke-opacity=".22" stroke-dasharray="3 5"/>`;
  }).join('');
  const wires = mono
    ? `${stroke(`M${x1 + 8} ${yl}H370Q412 ${yl} 412 102`, LEFT, 2, 'class="flow"')}${stroke(`M${x1 + 8} ${yr}H370Q412 ${yr} 412 146`, RIGHT, 2, 'class="flow"')}
       <g class="pic-clickable" data-click-param="routing" data-click-value="stereo"><circle cx="412" cy="124" r="22" fill="#2e4a40" stroke="${MIX}" stroke-width="1.8"/>${text(412, 131, '+', { size: 22, fill: MIX, anchor: 'middle' })}
       ${label(412, 172, t('pictures.phase.addHalve'), MIX, 'middle')}</g>
       ${baseline(446, 566, 124)}${stroke(curve(u => mixFn(u * .55), 446, 566, 124, 30, 120), MIX, 2.4)}
       ${mixLevel < .02 ? label(506, 104, t('pictures.phase.flatSilence'), MIX, 'middle') : label(506, 84, t('pictures.phase.whatIsLeft'), MIX, 'middle')}
       ${stroke(`M572 124H${hx - 62}`, MIX, 2, 'class="flow"')}${stroke(`M580 124V204Q580 222 598 222H${hx + 34}Q${hx + 50} 222 ${hx + 50} 204V${hy + 52}`, MIX, 2, 'class="flow"')}`
    : `<g class="pic-clickable" data-click-param="routing" data-click-value="mono">${stroke(`M${x1 + 8} ${yl}H540Q${hx - 50} ${yl} ${hx - 50} ${hy - 30}`, LEFT, 2, 'class="flow"')}
       ${stroke(`M${x1 + 8} ${yr}H470Q500 ${yr} 500 198Q500 222 524 222H${hx + 34}Q${hx + 50} 222 ${hx + 50} 204V${hy + 52}`, RIGHT, 2, 'class="flow"')}
       ${label(430, yl - 10, t('pictures.phase.toLeftEar'), LEFT, 'middle')}${label(402, yr - 10, t('pictures.phase.toRightEar'), RIGHT, 'middle')}</g>`;
  const isIdentical = !(mode === 'delay' || inverted || (mode === 'phase' && degrees === 180) || (mode === 'phase' && degrees % 360 !== 0));
  const relation = mode === 'delay' ? t('pictures.phase.relDelay', { ms: r2(Number(p.delayMs)) })
    : inverted || (mode === 'phase' && degrees === 180) ? t('pictures.phase.relUpsideDown')
      : mode === 'phase' && degrees % 360 !== 0 ? t('pictures.phase.relShifted', { deg: Math.round(degrees) })
        : t('pictures.phase.relIdentical');
  const dragAttr = mode === 'phase' ? 'data-drag-param="phase" data-drag-min="0" data-drag-max="360" data-drag-x0="44" data-drag-x1="300"'
    : mode === 'delay' ? 'data-drag-param="delayMs" data-drag-min="0" data-drag-max="2" data-drag-x0="44" data-drag-x1="300"'
      : 'data-click-param="phase" data-click-value="' + (inverted ? 0 : 180) + '"';
  const svg = `${guides}${baseline(x0, x1, yl)}${baseline(x0, x1, yr)}
    <path d="${areaCurve(leftFn, x0, x1, yl, 34)}" fill="url(#grad-left)"/>
    <path d="${areaCurve(rightFn, x0, x1, yr, 34)}" fill="url(#grad-right)"/>
    ${stroke(curve(leftFn, x0, x1, yl, 34), LEFT, 2.5)}
    <g class="pic-interactive" ${dragAttr}>
      <rect x="${x0}" y="${yr - 38}" width="${x1 - x0}" height="76" fill="transparent"/>
      ${stroke(curve(rightFn, x0, x1, yr, 34), RIGHT, 2.5)}
    </g>
    ${label(x0, 24, t('pictures.phase.leftWave'), LEFT)}${label(x0, 238, t('pictures.phase.rightWave', { rel: relation.toUpperCase() }), RIGHT)}
    ${wires}${headFront(hx, hy, mono ? mixLevel : 1, mono ? mixLevel : 1)}`;
  let caption;
  if (!mono) caption = isIdentical ? t('pictures.phase.capStereoSame') : t('pictures.phase.capStereoDiff', { rel: relation });
  else if (mixLevel < .02) caption = t('pictures.phase.capMonoSilent');
  else if (mixLevel > .98) caption = t('pictures.phase.capMonoFull');
  else caption = t('pictures.phase.capMonoPartial', { pct: Math.round(mixLevel * 100) });
  if (mode === 'delay' && p.source !== 'noise') caption += t('pictures.phase.capDelayCycle', { hz: hzText(f), ms: r2(Number(p.delayMs)), deg: Math.round(shift * 360) });
  return { svg, caption, title: t('pictures.phase.title'), hint: mode === 'polarity' ? t('pictures.phase.hintPolarity') : t('pictures.phase.hintDrag') };
}

function beatsPicture(p) {
  const f = Number(p.frequency), difference = Number(p.difference), separate = p.routing === 'separate';
  const x0 = 44, x1 = 716, drawn = 36;
  const a = u => Math.sin(TAU * drawn * u), b = u => Math.sin(TAU * (drawn + difference) * u);
  const rows = `${baseline(x0, x1, 52)}${baseline(x0, x1, 112)}${baseline(x0, x1, 188)}
    ${stroke(curve(a, x0, x1, 52, 17, 900), LEFT, 1.5)}${stroke(curve(b, x0, x1, 112, 17, 900), RIGHT, 1.5)}`;
  const envUpper = curve(u => Math.abs(Math.cos(Math.PI * difference * u)), x0, x1, 188, 34, 400);
  const envLower = curve(u => -Math.abs(Math.cos(Math.PI * difference * u)), x0, x1, 188, 34, 400);
  const sum = `<g class="pic-interactive" data-drag-param="difference" data-drag-min="0.5" data-drag-max="20" data-drag-x0="${x0}" data-drag-x1="${x1}" opacity="${separate ? .28 : 1}">
    <rect x="${x0}" y="148" width="${x1 - x0}" height="80" fill="transparent"/>
    <path d="${areaCurve(u => Math.abs(Math.cos(Math.PI * difference * u)), x0, x1, 188, 34, 240)}" fill="url(#grad-warm)" opacity=".5"/>
    <path d="${areaCurve(u => -Math.abs(Math.cos(Math.PI * difference * u)), x0, x1, 188, 34, 240)}" fill="url(#grad-warm)" opacity=".5"/>
    ${stroke(curve(u => (a(u) + b(u)) / 2, x0, x1, 188, 34, 1100), MIX, 1.5)}
    ${stroke(envUpper, WARM, 2.1, 'stroke-dasharray="5 4" class="flow"')}
    ${stroke(envLower, WARM, 2.1, 'stroke-dasharray="5 4" class="flow"')}</g>`;
  const half = x0 + (x1 - x0) / (2 * difference);
  const marks = `<path d="M${x0} 30V226" stroke="${WARM}" stroke-opacity=".55" stroke-dasharray="2 4"/>${label(x0 + 6, 228, t('pictures.beats.inStep'), WARM)}
    ${half < x1 - 90 ? `<path d="M${half.toFixed(1)} 30V226" stroke="${WARM}" stroke-opacity=".55" stroke-dasharray="2 4"/>${label(half + 6, 242, t('pictures.beats.outStep'), WARM)}` : ''}`;
  const svg = `${rows}${sum}${separate ? '' : marks}
    ${label(x0, 24, t('pictures.beats.toneA', { hz: hzText(f) }), LEFT)}${label(x0, 86, t('pictures.beats.toneB', { hz: r1(f + difference) }), RIGHT)}
    ${label(x0, 146, separate ? t('pictures.beats.sumSeparate') : t('pictures.beats.sumTogether'), MIX)}
    ${label(x1, 24, t('pictures.beats.oneSecond'), DIM, 'end')}${label(x1, 146, t('pictures.beats.nBeats', { n: r1(difference) }), WARM, 'end')}`;
  const caption = separate ? t('pictures.beats.capSeparate') : t('pictures.beats.capTogether', { n: r1(difference) });
  return { svg, caption, title: t('pictures.beats.title'), hint: t('pictures.beats.hint') };
}

function harmonicsPicture(p) {
  const f = Number(p.fundamental), amps = p.harmonics.map(Number);
  const active = amps.map((a, i) => a > .005 ? i + 1 : 0).filter(Boolean);
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const common = active.length ? active.reduce(gcd) : 1;
  const x0 = 62, x1 = 296, sx0 = 396, sx1 = 716, periods = 2;
  const partials = amps.map((a, i) => {
    const y = 30 + i * 37;
    const color = i ? LEFT : WARM;
    return `<g class="pic-clickable" data-click-harmonic="${i}" opacity="${a > .005 ? 1 : .35}">
      <rect x="16" y="${y - 16}" width="${x1 + 36}" height="32" rx="4" fill="transparent"/>
      ${baseline(x0, x1, y)}
      ${stroke(curve(u => Math.sin(TAU * periods * (i + 1) * u), x0, x1, y, 14 * Math.max(a, .005), 200), color, 1.8)}
      ${label(20, y + 4, i ? `${i + 1}×` : 'F₀', color)}${text(x1 + 8, y + 4, `${Math.round((i + 1) * f)}`, { size: 10.5 })}</g>`;
  }).join('');
  const total = u => amps.reduce((sum, a, i) => sum + a * Math.sin(TAU * periods * (i + 1) * u), 0);
  const count = periods * common, width = (sx1 - sx0) / count;
  const brackets = active.length ? Array.from({ length: count }, (_, i) => {
    const a = sx0 + i * width + 2, b = sx0 + (i + 1) * width - 2;
    return `<path d="M${a.toFixed(1)} 214v8H${b.toFixed(1)}v-8" fill="none" stroke="${WARM}" stroke-width="1.7"/>`;
  }).join('') : '';
  const svg = `${partials}${text(346, 132, '=', { size: 30, fill: MIX, anchor: 'middle' })}
    ${baseline(sx0, sx1, 124)}
    <path d="${areaCurve(total, sx0, sx1, 124, 27, 300)}" fill="url(#grad-warm)" opacity=".55"/>
    ${stroke(curve(total, sx0, sx1, 124, 27, 500), MIX, 2.5)}
    ${label(sx0, 24, t('pictures.harmonics.addedTogether'), MIX)}
    ${brackets}
    ${active.length ? label((sx0 + sx1) / 2, 242, t('pictures.harmonics.sameShapeEvery', { ms: r2(1000 / (f * common)), hz: Math.round(f * common) }), WARM, 'middle') : ''}`;
  let caption;
  if (!active.length) caption = t('pictures.harmonics.capSilence');
  else if (active.length === 1) caption = t('pictures.harmonics.capSingle', { hz: Math.round(f * active[0]) });
  else if (common > 1) caption = t('pictures.harmonics.capMultiple', { n: common, hz: Math.round(f * common) });
  else if (amps[0] <= .005) caption = t('pictures.harmonics.capMissingFund', { hz: Math.round(f) });
  else caption = t('pictures.harmonics.capFull', { hz: Math.round(f) });
  return { svg, caption, title: t('pictures.harmonics.title'), hint: t('pictures.harmonics.hint') };
}

const SHAPES = {
  sine: { fn: x => Math.sin(x), recipe: h => h === 1 ? 1 : 0, noteKey: 'noteSine' },
  triangle: { fn: x => 2 / Math.PI * Math.asin(Math.sin(x)), recipe: h => h % 2 ? 1 / (h * h) : 0, noteKey: 'noteTriangle' },
  square: { fn: x => Math.sin(x) >= 0 ? 1 : -1, recipe: h => h % 2 ? 1 / h : 0, noteKey: 'noteSquare' },
  sawtooth: { fn: x => 1 - 2 * ((((x + Math.PI) / TAU % 1) + 1) % 1), recipe: h => 1 / h, noteKey: 'noteSawtooth' },
};
function amplitudePicture(p) {
  const shape = SHAPES[p.shape] || SHAPES.sine, db = Number(p.gainDb), gain = 10 ** (db / 20);
  const x0 = 44, x1 = 400, yc = 128, full = 88;
  const rules = [[0, t('pictures.amplitude.fullHeight')], [-6, t('pictures.amplitude.half')], [-12, t('pictures.amplitude.quarter')], [-20, t('pictures.amplitude.tenth')]].map(([value, name]) => {
    const y = yc - full * 10 ** (value / 20);
    return `<g class="pic-clickable" data-click-param="gainDb" data-click-value="${value}"><path d="M${x0} ${y.toFixed(1)}H${x1 + 14}" stroke="${LINE}" stroke-opacity=".22" stroke-dasharray="2 5"/>${text(x1 + 20, y + 4, `${value === 0 ? '0' : `−${-value}`} dB · ${name}`, { size: 11, fill: Math.abs(db - value) < 1 ? WARM : DIM, weight: Math.abs(db - value) < 1 ? 600 : 400 })}</g>`;
  }).join('');
  const bars = Array.from({ length: 9 }, (_, i) => {
    const h = i + 1, amount = shape.recipe(h), height = 150 * amount, x = 560 + i * 18;
    return `<rect x="${x}" y="${(204 - Math.max(height, 1.5)).toFixed(1)}" width="11" height="${Math.max(height, 1.5).toFixed(1)}" rx="2.5" fill="${amount ? WARM : DIM}" fill-opacity="${amount ? 0.92 : .3}"/>${text(x + 5.5, 220, h, { size: 10, anchor: 'middle' })}`;
  }).join('');
  const svg = `${rules}${baseline(x0, x1, yc)}
    ${stroke(curve(u => shape.fn(TAU * 2 * u), x0, x1, yc, full, 400), LINE, 1.2, 'stroke-opacity=".28" stroke-dasharray="4 4"')}
    <g class="pic-interactive" data-drag-param="gainDb" data-drag-axis="y" data-drag-min="-30" data-drag-max="0" data-drag-y0="216" data-drag-y1="40">
      <rect x="${x0}" y="38" width="${x1 - x0}" height="180" fill="transparent"/>
      <path d="${areaCurve(u => shape.fn(TAU * 2 * u), x0, x1, yc, full * gain, 240)}" fill="url(#grad-left)"/>
      ${stroke(curve(u => shape.fn(TAU * 2 * u), x0, x1, yc, full * gain, 400), LEFT, 2.7)}
    </g>
    ${label(x0, 24, t('pictures.amplitude.thisWave', { pct: Math.round(gain * 100) }), LEFT)}
    ${label(560, 24, t('pictures.amplitude.ingredients'), WARM)}${text(638, 240, t('pictures.amplitude.harmonicAxis'), { size: 10.5, anchor: 'middle' })}${bars}`;
  const caption = `${db === 0 ? t('pictures.amplitude.cap0db') : t('pictures.amplitude.capDb', { db: -db, pct: Math.round(gain * 100) })}${t('pictures.amplitude.capLoudness')}${t(`pictures.amplitude.${shape.noteKey}`)}`;
  return { svg, caption, title: t('pictures.amplitude.title'), hint: t('pictures.amplitude.hint') };
}

function spatialPicture(p) {
  const pan = Number(p.pan), delay = Number(p.delayMs), f = Number(p.frequency);
  const leftGain = Math.cos((pan + 1) * Math.PI / 4), rightGain = Math.sin((pan + 1) * Math.PI / 4);
  const cx = 380, cy = 128;
  const levelPull = pan, timePull = Math.max(-1, Math.min(1, -delay / .6));
  const image = Math.max(-1, Math.min(1, levelPull + timePull));
  const fronts = (side, gain, lag) => Array.from({ length: 5 }, (_, i) => {
    const distance = 74 + i * 44 + lag * 36;
    if (distance > 330) return '';
    const x = cx + side * distance, bend = side * 12;
    return `<path class="arrive" d="M${x} ${cy - 34}Q${x - bend} ${cy} ${x} ${cy + 34}" fill="none" stroke="${side < 0 ? LEFT : RIGHT}" stroke-width="${(1 + 4 * gain).toFixed(1)}" stroke-opacity="${(.25 + .75 * gain).toFixed(2)}" stroke-linecap="round"/>`;
  }).join('');
  const lagLeft = Math.max(0, -delay), lagRight = Math.max(0, delay);
  const timing = side => {
    const lag = side < 0 ? lagLeft : lagRight;
    if (!delay) return t('pictures.spatial.sameMoment');
    return lag ? t('pictures.spatial.msLater', { ms: r2(lag) }) : t('pictures.spatial.arrivesFirst');
  };
  const imgX = (cx + image * 40).toFixed(1);
  const svg = `${fronts(-1, leftGain, lagLeft)}${fronts(1, rightGain, lagRight)}
    <g class="pic-interactive" data-drag-param="pan" data-drag-min="-1" data-drag-max="1" data-drag-x0="260" data-drag-x1="500">
      <rect x="240" y="56" width="280" height="144" fill="transparent"/>
      <path d="M${cx - 9} ${cy - 54}L${cx} ${cy - 68}L${cx + 9} ${cy - 54}" fill="url(#head-fill)" stroke="${DIM}" stroke-opacity=".75"/>
      <ellipse cx="${cx - 55}" cy="${cy}" rx="7.5" ry="15" fill="${LEFT}" fill-opacity="${(0.35 + 0.65 * leftGain).toFixed(2)}"/>
      <ellipse cx="${cx + 55}" cy="${cy}" rx="7.5" ry="15" fill="${RIGHT}" fill-opacity="${(0.35 + 0.65 * rightGain).toFixed(2)}"/>
      <circle cx="${cx}" cy="${cy}" r="52" fill="url(#head-fill)" stroke="${DIM}" stroke-opacity=".75" stroke-width="1.5"/>
      <path d="M${cx - 44} ${cy}H${cx + 44}" stroke="${LINE}" stroke-opacity=".2" stroke-dasharray="2 4"/>
      <circle cx="${imgX}" cy="${cy}" r="24" fill="url(#glow-warm)"/>
      <circle cx="${imgX}" cy="${cy}" r="8" fill="${WARM}" stroke="#1f342d" stroke-width="1.5"/>
    </g>
    ${label(cx, cy + 82, t('pictures.spatial.headAbove'), WARM, 'middle')}
    ${label(44, 24, t('pictures.spatial.leftEar'), LEFT)}${label(44, 42, t('pictures.spatial.levelTiming', { pct: Math.round(leftGain * 100), timing: timing(-1) }), LEFT)}
    ${label(716, 24, t('pictures.spatial.rightEar'), RIGHT, 'end')}${label(716, 42, t('pictures.spatial.levelTiming', { pct: Math.round(rightGain * 100), timing: timing(1) }), RIGHT, 'end')}`;
  const side = value => value < 0 ? t('pictures.spatial.sideLeft') : t('pictures.spatial.sideRight');
  let caption;
  if (Math.abs(pan) < .02 && !delay) caption = t('pictures.spatial.capCenter');
  else if (!delay) caption = t('pictures.spatial.capPanOnly', { side: side(pan) });
  else if (Math.abs(pan) < .02) caption = t('pictures.spatial.capDelayOnly', { lagSide: side(delay), ms: r2(Math.abs(delay)), leadSide: side(-delay) });
  else if (Math.sign(pan) === Math.sign(-delay)) caption = t('pictures.spatial.capAgree', { side: side(pan) });
  else caption = t('pictures.spatial.capDisagree', { panSide: side(pan), timeSide: side(-delay) });
  if (p.source === 'sine' && Math.abs(delay) * f / 1000 > .5) caption += t('pictures.spatial.capAmbiguous', { hz: hzText(f) });
  return { svg, caption, title: t('pictures.spatial.title'), hint: t('pictures.spatial.hint') };
}

function maskingPicture(p) {
  const gain = 10 ** (Number(p.snr) / 20), sign = p.invertTone ? -1 : 1, mono = p.routing === 'mono';
  const x0 = 96, x1 = 716;
  const noise = u => .62 * noiseAt(u * .45) + .38 * noiseAt(.5 + u * .2);
  const tone = u => {
    const slot = (u * 4) % 1;
    if (slot < .125 || slot > .875) return 0;
    const edge = Math.min(1, (slot - .125) / .08, (.875 - slot) / .08);
    return 1.25 * gain * edge * Math.sin(TAU * 40 * u);
  };
  let left = u => noise(u) + tone(u), right = u => noise(u) + sign * tone(u);
  if (mono) { const a = left, b = right; left = right = u => (a(u) + b(u)) / 2; }
  const row = (y, fn, color, name) => `${baseline(x0, x1, y)}${stroke(curve(fn, x0, x1, y, 17, 900), color, 1.35)}${label(20, y + 4, name, color)}`;
  const pulses = Array.from({ length: 4 }, (_, i) => {
    const a = x0 + (i + .125) / 4 * (x1 - x0), b = x0 + (i + .875) / 4 * (x1 - x0);
    return `<rect class="arrive" x="${a.toFixed(1)}" y="18" width="${(b - a).toFixed(1)}" height="214" rx="4" fill="${WARM}" fill-opacity=".085"/>`;
  }).join('');
  const svg = `${pulses}${label(x0 + 12, 14, t('pictures.masking.toneOn'), WARM)}
    <g class="pic-interactive" data-drag-param="snr" data-drag-axis="y" data-drag-min="-30" data-drag-max="0" data-drag-y0="150" data-drag-y1="30">
      <rect x="${x0}" y="26" width="${x1 - x0}" height="130" fill="transparent"/>
      ${row(58, left, LEFT, t('pictures.masking.left'))}${row(126, right, RIGHT, t('pictures.masking.right'))}
    </g>
    <path d="M${x0} 162H${x1}" stroke="${LINE}" stroke-opacity=".25" stroke-dasharray="1 5"/>
    <g class="pic-clickable" data-click-param="invertTone" data-click-value="${!p.invertTone}">
      <rect x="16" y="168" width="${x1 - 16}" height="64" rx="6" fill="transparent"/>
      ${row(202, u => left(u) - right(u), MIX, 'L − R')}
      ${label(x1, 180, t('pictures.masking.earsCompared'), MIX, 'end')}
    </g>`;
  let caption;
  if (mono && p.invertTone) caption = t('pictures.masking.capMonoCancel');
  else if (!p.invertTone) caption = t('pictures.masking.capMatching');
  else caption = t('pictures.masking.capOpposite');
  return { svg, caption, title: t('pictures.masking.title'), hint: t('pictures.masking.hint') };
}

const NOISES = {
  white: { color: '#f4f4ee', perHz: [92, 92], perOctave: i => 40 + i * 15, noteKey: 'noteWhite' },
  pink: { color: '#eeb6c9', perHz: [52, 152], perOctave: () => 92, noteKey: 'notePink' },
  brown: { color: '#c79b6b', perHz: [36, 204], perOctave: i => 145 - i * 15, noteKey: 'noteBrown' },
};
function noisePicture(p) {
  const current = NOISES[p.color] || NOISES.pink;
  const area = `<path d="M60 ${current.perHz[0]}L340 ${current.perHz[1]}L340 208L60 208Z" fill="${current.color}" fill-opacity=".12"/>`;
  const lines = Object.entries(NOISES).map(([name, n]) => {
    const on = n === current;
    return `<g class="pic-clickable" data-click-param="color" data-click-value="${name}">
      <path d="M60 ${n.perHz[0]}L340 ${n.perHz[1]}" stroke="transparent" stroke-width="18"/>
      <path d="M60 ${n.perHz[0]}L340 ${n.perHz[1]}" stroke="${n.color}" stroke-width="${on ? 3.8 : 1.5}" stroke-opacity="${on ? 1 : .4}" stroke-linecap="round"/>
      ${text(346, n.perHz[1] + 4, t(`controls.${name}`).toLowerCase(), { size: 10.5, fill: n.color, weight: on ? 700 : 400 })}
    </g>`;
  }).join('');
  const bars = Array.from({ length: 8 }, (_, i) => {
    const height = current.perOctave(i);
    return `<rect x="${448 + i * 34}" y="${208 - height}" width="24" height="${height}" rx="3.5" fill="${current.color}" fill-opacity="${(0.65 + 0.3 * (height / 150)).toFixed(2)}"/>`;
  }).join('');
  const axis = (x0, x1) => `<path d="M${x0} 208H${x1}" stroke="${LINE}" stroke-opacity=".3"/>${text(x0, 228, t('pictures.noise.low'), { size: 11 })}${text(x1, 228, t('pictures.noise.high'), { size: 11, anchor: 'end' })}${text((x0 + x1) / 2, 228, t('pictures.noise.freqArrow'), { size: 11, anchor: 'middle' })}`;
  const svg = `${label(60, 24, t('pictures.noise.powerHz'), current.color)}${area}${lines}${axis(60, 340)}
    ${label(448, 24, t('pictures.noise.powerOct'), current.color)}${bars}${axis(448, 716)}`;
  return { svg, caption: t(`pictures.noise.${current.noteKey}`), title: t('pictures.noise.title'), hint: t('pictures.noise.hint') };
}

function shepardPicture(p, live) {
  const direction = p.direction === 'down' ? -1 : 1, pitchClass = live?.pitchClass ?? 0;
  const x0 = 50, x1 = 716, base = 204, top = 138, lo = Math.log2(27.5), hi = Math.log2(12000), centre = Math.log2(700);
  const xOf = log => x0 + (log - lo) / (hi - lo) * (x1 - x0);
  const weight = log => Math.exp(-.5 * ((log - centre) / 1.15) ** 2);
  const bell = curve(u => weight(lo + u * (hi - lo)), x0, x1, base, top, 200);
  const bellArea = areaCurve(u => weight(lo + u * (hi - lo)), x0, x1, base, top, 120);
  const bars = (pc, ghost) => Array.from({ length: 8 }, (_, i) => {
    const log = Math.log2(110) + i - 2 + pc / 12;
    if (log < Math.log2(30) || log >= hi) return '';
    const x = xOf(log), y = base - weight(log) * top;
    return ghost ? `<path d="M${x.toFixed(1)} ${base}V${y.toFixed(1)}" stroke="${LEFT}" stroke-opacity=".42" stroke-width="2" stroke-dasharray="3 4"/>`
      : `<path d="M${x.toFixed(1)} ${base}V${y.toFixed(1)}" stroke="${LEFT}" stroke-width="6" stroke-linecap="round"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${LEFT}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="${LEFT}" fill-opacity=".2"/>`;
  }).join('');
  const arrow = direction > 0 ? `M340 42h80m-9-7 9 7-9 7` : `M420 42h-80m9-7-9 7 9 7`;
  const nextDir = direction > 0 ? 'down' : 'up';
  const svg = `<path d="${bellArea}" fill="url(#grad-warm)" opacity=".55"/>${stroke(bell, WARM, 1.9, 'stroke-dasharray="5 4"')}<path d="M${x0} ${base}H${x1}" stroke="${LINE}" stroke-opacity=".3"/>
    ${bars(pitchClass + direction, true)}${bars(pitchClass, false)}
    <g class="pic-clickable" data-click-param="direction" data-click-value="${nextDir}">
      <rect x="240" y="10" width="280" height="44" rx="6" fill="transparent"/>
      ${stroke(arrow, MIX, 2.2)}${label(380, 24, direction > 0 ? t('pictures.shepard.moveUp') : t('pictures.shepard.moveDown'), MIX, 'middle')}
    </g>
    ${label(x0, 24, t('pictures.shepard.stepOf', { n: pitchClass + 1 }), LEFT)}${label(x1, 24, t('pictures.shepard.loudnessLimit'), WARM, 'end')}
    ${text(x0, 226, t('pictures.shepard.low'), { size: 11 })}${text(xOf(centre), 226, '700 Hz', { size: 11, anchor: 'middle' })}${text(x1, 226, t('pictures.shepard.high'), { size: 11, anchor: 'end' })}
    ${text((x0 + x1) / 2, 244, t('pictures.shepard.legend'), { size: 10.5, anchor: 'middle' })}`;
  const caption = direction > 0 ? t('pictures.shepard.capUp') : t('pictures.shepard.capDown');
  return { svg, caption, title: t('pictures.shepard.title'), hint: t('pictures.shepard.hint') };
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function pitchPicture(p) {
  const f = Number(p.frequency), x0 = 40, x1 = 720, firstNote = 43, lastNote = 108; // G2 … C8
  const noteWidth = (x1 - x0) / (lastNote - firstNote + 1);
  const midi = 69 + 12 * Math.log2(f / 440), nearest = Math.round(midi);
  const centsOff = Math.round((midi - nearest) * 100);
  const centsStr = centsOff === 0 ? '' : ` (${centsOff > 0 ? '+' : '−'}${Math.abs(centsOff)}¢)`;
  const keys = Array.from({ length: lastNote - firstNote + 1 }, (_, i) => {
    const note = firstNote + i, black = [1, 3, 6, 8, 10].includes(note % 12), x = x0 + i * noteWidth;
    const isNear = note === nearest;
    return `<rect x="${x.toFixed(1)}" y="150" width="${(noteWidth - 1).toFixed(1)}" height="${black ? 30 : 46}" rx="1.8" fill="${isNear ? WARM : black ? '#16261f' : '#dfe6d6'}"/>${note % 12 === 0 ? text(x + noteWidth / 2, 212, `C${note / 12 - 1}`, { size: 10.5, anchor: 'middle' }) : ''}`;
  }).join('');
  const mx = Math.max(x0, Math.min(x1, x0 + (midi - firstNote + .5) * noteWidth));
  const waves = f * .01;
  const noteName = `${NOTE_NAMES[((nearest % 12) + 12) % 12]}${Math.floor(nearest / 12) - 1}`;
  const svg = `${baseline(x0, x1, 72)}
    <path d="${areaCurve(u => Math.sin(TAU * waves * u), x0, x1, 72, 30, 600)}" fill="url(#grad-left)"/>
    ${stroke(curve(u => Math.sin(TAU * waves * u), x0, x1, 72, 30, 1400), LEFT, 1.85)}
    ${label(x0, 24, t('pictures.pitch.tenMs', { n: r1(waves) }), LEFT)}
    <g class="pic-interactive" data-drag-param="frequency" data-drag-log="true" data-drag-min="100" data-drag-max="4000" data-drag-x0="${x0}" data-drag-x1="${x1}">
      <rect x="${x0}" y="115" width="${x1 - x0}" height="100" fill="transparent"/>
      ${keys}
      <circle cx="${mx.toFixed(1)}" cy="158" r="18" fill="url(#glow-warm)"/>
      <path d="M${mx.toFixed(1)} 146l-7 -12h14z" fill="${WARM}"/>
    </g>
    ${label(mx, 126, t('pictures.pitch.nearNote', { hz: hzText(f), note: noteName, cents: centsStr }), WARM, mx < 150 ? 'start' : mx > 610 ? 'end' : 'middle')}
    ${text((x0 + x1) / 2, 238, t('pictures.pitch.pianoLegend'), { size: 10.5, anchor: 'middle' })}`;
  const caption = t('pictures.pitch.caption', { hz: hzText(f), count: Math.round(f).toLocaleString(getLanguage()) });
  return { svg, caption, title: t('pictures.pitch.title'), hint: t('pictures.pitch.hint') };
}

function frequencyPicture(p) {
  const f = Number(p.frequency), x0 = 40, x1 = 720, lo = Math.log2(80), hi = Math.log2(18000);
  const xOf = hz => x0 + (Math.log2(hz) - lo) / (hi - lo) * (x1 - x0);
  const x = xOf(Math.max(80, Math.min(18000, f)));
  const band = (a, b, name, opacity) => `<rect x="${xOf(a).toFixed(1)}" y="34" width="${(xOf(b) - xOf(a) - 3).toFixed(1)}" height="24" rx="4" fill="${LINE}" fill-opacity="${opacity}"/>${label((xOf(a) + xOf(b)) / 2, 50, name, MIX, 'middle')}`;
  const ticks = [100, 250, 500, 1000, 2000, 4000, 8000, 16000].map(hz => `<path d="M${xOf(hz).toFixed(1)} 62v7" stroke="${DIM}"/>${text(xOf(hz), 82, hz < 1000 ? hz : `${hz / 1000}k`, { size: 10.5, anchor: 'middle' })}`).join('');
  const ribbon = `M${x0} 132L${x1} 152V176L${x0} 196Z`;
  const bump = curve(u => Math.exp(-.5 * (((x0 + u * (x1 - x0)) - x) / 16) ** 2) * Math.sin((x0 + u * (x1 - x0) - x) / 5 + Math.PI / 2), x0, x1, 164, 26, 500);
  const ears = p.ear === 'left' ? t('pictures.frequency.leftOnly') : p.ear === 'right' ? t('pictures.frequency.rightOnly') : t('pictures.frequency.bothEars');
  const svg = `<g class="pic-interactive" data-drag-param="frequency" data-drag-log="true" data-drag-min="80" data-drag-max="18000" data-drag-x0="${x0}" data-drag-x1="${x1}">
    <rect x="${x0}" y="28" width="${x1 - x0}" height="184" fill="transparent"/>
    ${band(80, 250, t('pictures.frequency.bandBass'), .07)}${band(250, 4000, t('pictures.frequency.bandMid'), .12)}${band(4000, 18000, t('pictures.frequency.bandHigh'), .07)}${ticks}
    <path d="${ribbon}" fill="${RIGHT}" fill-opacity=".18" stroke="${RIGHT}" stroke-opacity=".55"/>
    <circle cx="${x.toFixed(1)}" cy="164" r="28" fill="url(#glow-warm)"/>
    ${stroke(bump, WARM, 2.5)}<path d="M${x.toFixed(1)} 62V208" stroke="${WARM}" stroke-dasharray="3 4"/>
    <circle cx="${x.toFixed(1)}" cy="62" r="4.5" fill="${WARM}"/>
  </g>
    ${label(x, 24, `${hzText(f)} · ${ears}`, WARM, x < 150 ? 'start' : x > 610 ? 'end' : 'middle')}
    ${label(x0, 118, t('pictures.frequency.innerEar'), RIGHT)}
    ${text(x0, 226, t('pictures.frequency.farTip'), { size: 11 })}${text(x1, 226, t('pictures.frequency.entrance'), { size: 11, anchor: 'end' })}`;
  const where = f < 250 ? t('pictures.frequency.whereLow') : f <= 4000 ? t('pictures.frequency.whereMid') : f <= 10000 ? t('pictures.frequency.whereSparkle') : t('pictures.frequency.whereTop');
  const caption = `${where}${t('pictures.frequency.captionTail')}`;
  return { svg, caption, title: t('pictures.frequency.title'), hint: t('pictures.frequency.hint') };
}

function gapPicture(p) {
  const gap = Number(p.gapMs), x0 = 40, x1 = 720, span = 100, per = (x1 - x0) / span, yc = 78;
  const a = x0 + (50 - gap / 2) * per, b = x0 + (50 + gap / 2) * per;
  const grains = Array.from({ length: 227 }, (_, i) => {
    const x = x0 + i * 3;
    if (x >= a - 1 && x <= b - 1) return '';
    const height = 8 + 34 * Math.abs(NOISE[i * 7 % NOISE.length]);
    return `<rect x="${x}" y="${(yc - height).toFixed(1)}" width="2" height="${(height * 2).toFixed(1)}" rx="1" fill="${LEFT}" fill-opacity=".82"/>`;
  }).join('');
  const ruler = Array.from({ length: 11 }, (_, i) => `<path d="M${x0 + i * 10 * per} 134v7" stroke="${DIM}"/>${text(x0 + i * 10 * per, 156, `${i * 10}`, { size: 10.5, anchor: 'middle' })}`).join('');
  const reference = (y, ms, name, highlight = false) => `<rect x="${x0}" y="${y}" width="${(ms * per).toFixed(1)}" height="9" rx="3" fill="${highlight ? WARM : RIGHT}" fill-opacity="${highlight ? .85 : .55}"/>${text(x0 + ms * per + 8, y + 9, name, { size: 11, fill: highlight ? WARM : DIM, weight: highlight ? 600 : 400 })}`;
  const svg = `<g class="pic-interactive" data-drag-param="gapMs" data-drag-min="1" data-drag-max="64" data-drag-x0="${x0}" data-drag-x1="${x1}">
    <rect x="${x0}" y="28" width="${x1 - x0}" height="106" fill="transparent"/>
    <rect x="${a.toFixed(1)}" y="36" width="${Math.max(2, b - a).toFixed(1)}" height="84" rx="3" fill="${WARM}" fill-opacity=".09"/>
    ${grains}
    <path d="M${a.toFixed(1)} 122v-10M${b.toFixed(1)} 122v-10M${a.toFixed(1)} 117H${b.toFixed(1)}" stroke="${WARM}" stroke-width="2" fill="none"/>
  </g>
    ${label((a + b) / 2, 24, t('pictures.gap.msSilence', { ms: r1(gap) }), WARM, 'middle')}
    <path d="M${x0} 134H${x1}" stroke="${DIM}"/>${ruler}${text(x1, 172, t('pictures.gap.milliseconds'), { size: 10.5, anchor: 'end' })}
    ${reference(188, 16.7, t('pictures.gap.refScreen'))}${reference(210, 41.7, t('pictures.gap.refCinema'))}
    ${reference(232, gap, t('pictures.gap.refThisGap', { ms: r1(gap) }), true)}`;
  const caption = gap >= 30 ? t('pictures.gap.capLong') : gap >= 8 ? t('pictures.gap.capMid') : t('pictures.gap.capShort');
  return { svg, caption, title: t('pictures.gap.title'), hint: t('pictures.gap.hint') };
}

const PICTURES = { phase: phasePicture, beats: beatsPicture, harmonics: harmonicsPicture, amplitude: amplitudePicture, spatial: spatialPicture, masking: maskingPicture, noise: noisePicture, shepard: shepardPicture, pitch: pitchPicture, frequency: frequencyPicture, gap: gapPicture };

/** Returns {svg, caption, title, hint} for an experiment's current settings. */
export function picture(id, params, live = null) {
  const draw = PICTURES[id];
  if (!draw) return null;
  const { svg, caption, title, hint = '' } = draw(params, live);
  return {
    title, caption, hint,
    svg: `<svg dir="ltr" class="picture-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title.replace(/"/g, '&quot;')}. ${caption.replace(/"/g, '&quot;')}" font-family="Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${SHARED_DEFS}${svg}</svg>`,
  };
}
