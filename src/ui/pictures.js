// SPDX-License-Identifier: AGPL-3.0-only
// One explanatory picture per experiment. Each is drawn from the current
// settings, so it changes as the controls move. These are sketches of the idea,
// not measurements: the scope below them shows the generated signal itself.

const W = 760, H = 250;
const LEFT = '#75d6b1', RIGHT = '#b8a1f5', MIX = '#f1ecdc', WARM = '#f3c58f', DIM = '#9db3a3', LINE = '#ffffff';
const TAU = Math.PI * 2;

const r1 = value => Number(value.toFixed(1));
const r2 = value => Number(value.toFixed(2));
const hzText = f => f >= 1000 ? `${r2(f / 1000)} kHz` : `${Math.round(f)} Hz`;
const text = (x, y, content, { size = 12, fill = DIM, anchor = 'start', weight = 400, spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${content}</text>`;
const label = (x, y, content, fill = DIM, anchor = 'start') => text(x, y, content, { size: 10.5, fill, anchor, weight: 600, spacing: 1.1 });

/** A polyline for fn(u), u from 0 to 1, drawn between x0 and x1 around the centre line yc. */
function curve(fn, x0, x1, yc, amp, points = 240) {
  let d = '';
  for (let i = 0; i <= points; i++) {
    const u = i / points;
    d += `${i ? 'L' : 'M'}${(x0 + u * (x1 - x0)).toFixed(1)},${(yc - fn(u) * amp).toFixed(1)}`;
  }
  return d;
}
const stroke = (d, color, width = 2, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const baseline = (x0, x1, y) => `<path d="M${x0} ${y}H${x1}" stroke="${LINE}" stroke-opacity=".13"/>`;

// A fixed table of pseudo-random values, so "noise" looks the same on every redraw.
const NOISE = (() => {
  let state = 2463534242;
  return Float32Array.from({ length: 2048 }, () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) / 4294967296) * 2 - 1; });
})();
const noiseAt = u => NOISE[Math.floor((((u % 1) + 1) % 1) * (NOISE.length - 1))];

/** A head seen from the front, wearing headphones. Cup brightness shows how much reaches each ear. */
function headFront(cx, cy, leftLevel, rightLevel) {
  const cup = (x, color, level) => `<rect x="${x - 9}" y="${cy - 24}" width="18" height="48" rx="8" fill="${color}" fill-opacity="${(.12 + .88 * Math.min(1, level)).toFixed(2)}" stroke="${color}" stroke-width="1.5"/>`;
  return `<path d="M${cx - 50} ${cy - 16}A50 54 0 0 1 ${cx + 50} ${cy - 16}" fill="none" stroke="${DIM}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="${cx}" cy="${cy + 4}" rx="38" ry="44" fill="#2e4a40" stroke="${DIM}" stroke-opacity=".7"/>
    <circle cx="${cx - 13}" cy="${cy - 4}" r="2.4" fill="${DIM}"/><circle cx="${cx + 13}" cy="${cy - 4}" r="2.4" fill="${DIM}"/>
    <path d="M${cx - 10} ${cy + 20}Q${cx} ${cy + 27} ${cx + 10} ${cy + 20}" fill="none" stroke="${DIM}" stroke-width="1.6" stroke-linecap="round"/>
    ${cup(cx - 50, LEFT, leftLevel)}${cup(cx + 50, RIGHT, rightLevel)}
    ${label(cx - 50, cy + 44, 'L', LEFT, 'middle')}${label(cx + 50, cy + 44, 'R', RIGHT, 'middle')}`;
}

function phasePicture(p) {
  const f = Number(p.frequency), mode = p.source !== 'sine' && p.mode === 'phase' ? 'polarity' : p.mode;
  const degrees = Number(p.phase), inverted = mode === 'polarity' && degrees >= 90 && degrees < 270;
  const cycles = 3;
  // How far the right wave is shifted, in cycles of the drawn window.
  const shift = mode === 'phase' ? degrees / 360 : mode === 'delay' ? Number(p.delayMs) * f / 1000 : 0;
  const shape = p.source === 'complex' ? x => (Math.sin(x) + Math.sin(2 * x) / 2 + Math.sin(3 * x) / 4 + Math.sin(4 * x) / 8) / 1.45 : Math.sin;
  // Noise is drawn over a 5 ms window; a delay slides it sideways.
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
       <circle cx="412" cy="124" r="21" fill="#2e4a40" stroke="${MIX}" stroke-width="1.5"/>${text(412, 131, '+', { size: 22, fill: MIX, anchor: 'middle' })}
       ${label(412, 172, 'ADD, HALVE', MIX, 'middle')}
       ${baseline(446, 566, 124)}${stroke(curve(u => mixFn(u * .55), 446, 566, 124, 30, 120), MIX, 2.4)}
       ${mixLevel < .02 ? label(506, 104, 'FLAT = SILENCE', MIX, 'middle') : label(506, 84, 'WHAT IS LEFT', MIX, 'middle')}
       ${stroke(`M572 124H${hx - 62}`, MIX, 2, 'class="flow"')}${stroke(`M580 124V204Q580 222 598 222H${hx + 34}Q${hx + 50} 222 ${hx + 50} 204V${hy + 52}`, MIX, 2, 'class="flow"')}`
    : `${stroke(`M${x1 + 8} ${yl}H540Q${hx - 50} ${yl} ${hx - 50} ${hy - 30}`, LEFT, 2, 'class="flow"')}
       ${stroke(`M${x1 + 8} ${yr}H470Q500 ${yr} 500 198Q500 222 524 222H${hx + 34}Q${hx + 50} 222 ${hx + 50} 204V${hy + 52}`, RIGHT, 2, 'class="flow"')}
       ${label(430, yl - 10, 'STRAIGHT TO THE LEFT EAR', LEFT, 'middle')}${label(402, yr - 10, 'TO THE RIGHT EAR', RIGHT, 'middle')}`;
  const relation = mode === 'delay' ? `${r2(Number(p.delayMs))} ms late` : inverted || (mode === 'phase' && degrees === 180) ? 'upside down' : mode === 'phase' && degrees % 360 !== 0 ? `shifted ${Math.round(degrees)}°` : 'identical';
  const svg = `${guides}${baseline(x0, x1, yl)}${baseline(x0, x1, yr)}
    ${stroke(curve(leftFn, x0, x1, yl, 34), LEFT, 2.4)}${stroke(curve(rightFn, x0, x1, yr, 34), RIGHT, 2.4)}
    ${label(x0, 24, 'LEFT WAVE', LEFT)}${label(x0, 238, `RIGHT WAVE · ${relation.toUpperCase()}`, RIGHT)}
    ${wires}${headFront(hx, hy, mono ? mixLevel : 1, mono ? mixLevel : 1)}`;
  let caption;
  if (!mono) caption = relation === 'identical'
    ? 'Each ear gets its own copy of the same wave. Nothing is added together.'
    : `Each ear gets its own wave, and the right one is ${relation}. The two never meet, so nothing cancels. What changes is where the sound seems to sit.`;
  else if (mixLevel < .02) caption = 'Now the two waves are added before they reach you. Every peak of one meets a dip of the other, and the sum is a flat line: silence.';
  else if (mixLevel > .98) caption = 'The two waves are added before they reach you. They match, so the sum looks just like either one.';
  else caption = `The two waves are added before they reach you. They partly cancel: the sum is about ${Math.round(mixLevel * 100)}% as strong as one wave alone.`;
  if (mode === 'delay' && p.source !== 'noise') caption += ` At ${hzText(f)}, a ${r2(Number(p.delayMs))} ms delay is ${Math.round(shift * 360)}° of a cycle.`;
  return { svg, caption, title: 'Two waves, two ears' };
}

function beatsPicture(p) {
  const f = Number(p.frequency), difference = Number(p.difference), separate = p.routing === 'separate';
  const x0 = 44, x1 = 716, drawn = 36;
  const a = u => Math.sin(TAU * drawn * u), b = u => Math.sin(TAU * (drawn + difference) * u);
  const rows = `${baseline(x0, x1, 52)}${baseline(x0, x1, 112)}${baseline(x0, x1, 188)}
    ${stroke(curve(a, x0, x1, 52, 17, 900), LEFT, 1.5)}${stroke(curve(b, x0, x1, 112, 17, 900), RIGHT, 1.5)}`;
  const sum = `<g opacity="${separate ? .28 : 1}">${stroke(curve(u => (a(u) + b(u)) / 2, x0, x1, 188, 34, 1100), MIX, 1.5)}
    ${stroke(curve(u => Math.abs(Math.cos(Math.PI * difference * u)), x0, x1, 188, 34, 400), WARM, 2, 'stroke-dasharray="5 4"')}
    ${stroke(curve(u => -Math.abs(Math.cos(Math.PI * difference * u)), x0, x1, 188, 34, 400), WARM, 2, 'stroke-dasharray="5 4"')}</g>`;
  const half = x0 + (x1 - x0) / (2 * difference);
  const marks = `<path d="M${x0} 30V226" stroke="${WARM}" stroke-opacity=".55" stroke-dasharray="2 4"/>${label(x0 + 6, 228, 'IN STEP: LOUD', WARM)}
    ${half < x1 - 90 ? `<path d="M${half.toFixed(1)} 30V226" stroke="${WARM}" stroke-opacity=".55" stroke-dasharray="2 4"/>${label(half + 6, 242, 'OUT OF STEP: QUIET', WARM)}` : ''}`;
  const svg = `${rows}${sum}${separate ? '' : marks}
    ${label(x0, 24, `TONE A · ${hzText(f)}`, LEFT)}${label(x0, 86, `TONE B · ${r1(f + difference)} Hz`, RIGHT)}
    ${label(x0, 146, separate ? 'A + B · NOT ADDED ANYWHERE: ONE TONE PER EAR' : 'A + B · WHAT REACHES EACH EAR', MIX)}
    ${label(x1, 24, 'ONE SECOND →', DIM, 'end')}${label(x1, 146, `${r1(difference)} BEATS`, WARM, 'end')}`;
  const caption = separate
    ? 'Each ear now gets one steady tone, so the swelling sum below never exists as a sound. If you still sense a slow wobble, your brain built it from the two ears.'
    : `Tone B fits ${r1(difference)} more waves into each second than tone A. So ${r1(difference)} times a second they fall in step and add up, then drift out of step and cancel. (The waves are drawn slower than real, so you can see them.)`;
  return { svg, caption, title: 'Drifting in and out of step' };
}

function harmonicsPicture(p) {
  const f = Number(p.fundamental), amps = p.harmonics.map(Number);
  const active = amps.map((a, i) => a > .005 ? i + 1 : 0).filter(Boolean);
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const common = active.length ? active.reduce(gcd) : 1;
  const x0 = 62, x1 = 296, sx0 = 396, sx1 = 716, periods = 2;
  const partials = amps.map((a, i) => {
    const y = 30 + i * 37;
    return `<g opacity="${a > .005 ? 1 : .32}">${baseline(x0, x1, y)}${stroke(curve(u => Math.sin(TAU * periods * (i + 1) * u), x0, x1, y, 14 * Math.max(a, .005), 200), i ? LEFT : WARM, 1.7)}
      ${label(20, y + 4, i ? `${i + 1}×` : 'F₀', i ? LEFT : WARM)}${text(x1 + 8, y + 4, `${Math.round((i + 1) * f)}`, { size: 10.5 })}</g>`;
  }).join('');
  const total = u => amps.reduce((sum, a, i) => sum + a * Math.sin(TAU * periods * (i + 1) * u), 0);
  const count = periods * common, width = (sx1 - sx0) / count;
  const brackets = active.length ? Array.from({ length: count }, (_, i) => {
    const a = sx0 + i * width + 2, b = sx0 + (i + 1) * width - 2;
    return `<path d="M${a.toFixed(1)} 214v8H${b.toFixed(1)}v-8" fill="none" stroke="${WARM}" stroke-width="1.6"/>`;
  }).join('') : '';
  const svg = `${partials}${text(346, 132, '=', { size: 30, fill: MIX, anchor: 'middle' })}
    ${baseline(sx0, sx1, 124)}${stroke(curve(total, sx0, sx1, 124, 27, 500), MIX, 2.4)}
    ${label(sx0, 24, 'ALL OF THEM ADDED TOGETHER', MIX)}
    ${active.length ? label((sx0 + sx1) / 2, 242, `SAME SHAPE EVERY ${r2(1000 / (f * common))} ms = ${Math.round(f * common)} TIMES A SECOND`, WARM, 'middle') : ''}`;
  let caption;
  if (!active.length) caption = 'No waves, no sound. Raise a fader to add one back.';
  else if (active.length === 1) caption = `One wave alone is a pure tone at ${Math.round(f * active[0])} Hz: smooth and plain.`;
  else if (common > 1) caption = `Only multiples of ${common}× are left, so the pattern repeats ${common} times as often. The pitch jumps to ${Math.round(f * common)} Hz.`;
  else if (amps[0] <= .005) caption = `The lowest wave (${Math.round(f)} Hz) is gone, yet look at the brackets: the sum still repeats ${Math.round(f)} times a second. Your hearing follows that repeat rate, so the pitch stays put.`;
  else caption = `Add the simple waves on the left point by point and you get the one on the right. It repeats as often as the slowest wave, ${Math.round(f)} times a second: that sets the pitch. The mix of the others sets the tone colour.`;
  return { svg, caption, title: 'One sound, six ingredients' };
}

const SHAPES = {
  sine: { fn: x => Math.sin(x), recipe: h => h === 1 ? 1 : 0, note: 'A sine is the plainest sound there is: a single ingredient.' },
  triangle: { fn: x => 2 / Math.PI * Math.asin(Math.sin(x)), recipe: h => h % 2 ? 1 / (h * h) : 0, note: 'A triangle adds a pinch of odd harmonics (3×, 5×, 7×…) that fade quickly. It sounds soft, a little hollow.' },
  square: { fn: x => Math.sin(x) >= 0 ? 1 : -1, recipe: h => h % 2 ? 1 / h : 0, note: 'A square wave is a tall stack of odd harmonics (3×, 5×, 7×…). It sounds hollow and buzzy.' },
  sawtooth: { fn: x => 1 - 2 * ((((x + Math.PI) / TAU % 1) + 1) % 1), recipe: h => 1 / h, note: 'A sawtooth holds every harmonic (2×, 3×, 4×…). It sounds bright and brassy.' },
};
function amplitudePicture(p) {
  const shape = SHAPES[p.shape] || SHAPES.sine, db = Number(p.gainDb), gain = 10 ** (db / 20);
  const x0 = 44, x1 = 400, yc = 128, full = 88;
  const rules = [[0, 'full height'], [-6, 'half'], [-12, 'a quarter'], [-20, 'a tenth']].map(([value, name]) => {
    const y = yc - full * 10 ** (value / 20);
    return `<path d="M${x0} ${y.toFixed(1)}H${x1 + 14}" stroke="${LINE}" stroke-opacity=".2" stroke-dasharray="2 5"/>${text(x1 + 20, y + 4, `${value === 0 ? '0' : `−${-value}`} dB · ${name}`, { size: 11 })}`;
  }).join('');
  const bars = Array.from({ length: 9 }, (_, i) => {
    const h = i + 1, amount = shape.recipe(h), height = 150 * amount, x = 560 + i * 18;
    return `<rect x="${x}" y="${(204 - Math.max(height, 1.5)).toFixed(1)}" width="11" height="${Math.max(height, 1.5).toFixed(1)}" rx="2" fill="${amount ? WARM : DIM}" fill-opacity="${amount ? 1 : .35}"/>${text(x + 5.5, 220, h, { size: 10, anchor: 'middle' })}`;
  }).join('');
  const svg = `${rules}${baseline(x0, x1, yc)}
    ${stroke(curve(u => shape.fn(TAU * 2 * u), x0, x1, yc, full, 400), LINE, 1.2, 'stroke-opacity=".3" stroke-dasharray="4 4"')}
    ${stroke(curve(u => shape.fn(TAU * 2 * u), x0, x1, yc, full * gain, 400), LEFT, 2.6)}
    ${label(x0, 24, `THIS WAVE · ${Math.round(gain * 100)}% OF FULL HEIGHT`, LEFT)}
    ${label(560, 24, 'INGREDIENTS', WARM)}${text(560, 240, 'harmonic number (1 = the pitch itself)', { size: 10.5 })}${bars}`;
  const caption = `${db === 0 ? 'At 0 dB the wave is at full height.' : `−${-db} dB shrinks the wave to ${Math.round(gain * 100)}% of full height.`} Every 6 dB down halves it again. Loudness shrinks more slowly than height: a common rule of thumb is that “half as loud” takes about −10 dB. ${shape.note}`;
  return { svg, caption, title: 'How tall, and made of what' };
}

function spatialPicture(p) {
  const pan = Number(p.pan), delay = Number(p.delayMs), f = Number(p.frequency);
  const leftGain = Math.cos((pan + 1) * Math.PI / 4), rightGain = Math.sin((pan + 1) * Math.PI / 4);
  const cx = 380, cy = 128;
  // A sketch of the usual direction of the effect, not a model of any listener.
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
    if (!delay) return 'SAME MOMENT';
    return lag ? `${r2(lag)} ms LATER` : 'ARRIVES FIRST';
  };
  const svg = `${fronts(-1, leftGain, lagLeft)}${fronts(1, rightGain, lagRight)}
    <path d="M${cx - 9} ${cy - 54}L${cx} ${cy - 68}L${cx + 9} ${cy - 54}" fill="#2e4a40" stroke="${DIM}" stroke-opacity=".7"/>
    <ellipse cx="${cx - 55}" cy="${cy}" rx="7" ry="14" fill="${LEFT}" fill-opacity=".85"/><ellipse cx="${cx + 55}" cy="${cy}" rx="7" ry="14" fill="${RIGHT}" fill-opacity=".85"/>
    <circle cx="${cx}" cy="${cy}" r="52" fill="#2e4a40" stroke="${DIM}" stroke-opacity=".7"/>
    <path d="M${cx - 44} ${cy}H${cx + 44}" stroke="${LINE}" stroke-opacity=".18" stroke-dasharray="2 4"/>
    <circle cx="${(cx + image * 40).toFixed(1)}" cy="${cy}" r="17" fill="${WARM}" fill-opacity=".22"/><circle cx="${(cx + image * 40).toFixed(1)}" cy="${cy}" r="7.5" fill="${WARM}"/>
    ${label(cx, cy + 82, 'HEAD FROM ABOVE · DOT = WHERE THE SOUND TENDS TO SIT', WARM, 'middle')}
    ${label(44, 24, 'LEFT EAR', LEFT)}${label(44, 42, `LEVEL ${Math.round(leftGain * 100)}% · ${timing(-1)}`, LEFT)}
    ${label(716, 24, 'RIGHT EAR', RIGHT, 'end')}${label(716, 42, `LEVEL ${Math.round(rightGain * 100)}% · ${timing(1)}`, RIGHT, 'end')}`;
  const side = value => value < 0 ? 'left' : 'right';
  let caption;
  if (Math.abs(pan) < .02 && !delay) caption = 'Both ears get the same wave, equally strong, at the same moment. With no clue pointing either way, the sound sits in the middle of your head.';
  else if (!delay) caption = `The ${side(pan)} ear gets a stronger wave (thicker lines). Louder on one side reads as “over there”, so the sound leans ${side(pan)}.`;
  else if (Math.abs(pan) < .02) caption = `Same strength in both ears, but the ${side(delay)} ear gets each wave ${r2(Math.abs(delay))} ms late. Your brain reads “it reached the ${side(-delay)} ear first” and moves the sound ${side(-delay)}. Sound needs about 0.6 ms to cross a head.`;
  else if (Math.sign(pan) === Math.sign(-delay)) caption = `Both clues agree: the ${side(pan)} ear gets the wave stronger and sooner. The sound moves firmly ${side(pan)}.`;
  else caption = `The clues disagree: strength says ${side(pan)}, timing says ${side(-delay)}. Listen for which one wins, or whether the sound smears or splits.`;
  if (p.source === 'sine' && Math.abs(delay) * f / 1000 > .5) caption += ` At ${hzText(f)} this delay is more than half a wave, so “which ear was first” becomes ambiguous for a steady tone.`;
  return { svg, caption, title: 'Two clues: how strong, how soon' };
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
  const row = (y, fn, color, name) => `${baseline(x0, x1, y)}${stroke(curve(fn, x0, x1, y, 17, 900), color, 1.3)}${label(20, y + 4, name, color)}`;
  const pulses = Array.from({ length: 4 }, (_, i) => {
    const a = x0 + (i + .125) / 4 * (x1 - x0), b = x0 + (i + .875) / 4 * (x1 - x0);
    return `<rect x="${a.toFixed(1)}" y="18" width="${(b - a).toFixed(1)}" height="214" fill="${WARM}" fill-opacity=".07"/>`;
  }).join('');
  const svg = `${pulses}${label(x0 + 12, 14, 'TONE ON', WARM)}
    ${row(58, left, LEFT, 'LEFT')}${row(126, right, RIGHT, 'RIGHT')}
    <path d="M${x0} 162H${x1}" stroke="${LINE}" stroke-opacity=".25" stroke-dasharray="1 5"/>
    ${row(202, u => left(u) - right(u), MIX, 'L − R')}
    ${label(x1, 180, 'THE TWO EARS COMPARED', MIX, 'end')}`;
  let caption;
  if (mono && p.invertTone) caption = 'Mixed to mono, the opposite tones are added and cancel before they reach you. Only the noise is left in both ears.';
  else if (!p.invertTone) caption = 'The tone hides inside the noise during the shaded moments. Both ears get exactly the same signal, so comparing them (bottom row) shows nothing. The only clue is the tone poking above the noise.';
  else caption = 'Now the tone is flipped in the right ear, while the noise is still identical. Compare the ears (bottom row): the shared noise drops out and the tone stands alone. Your hearing can use a comparison like this to dig the tone out.';
  return { svg, caption, title: 'What differs between your ears?' };
}

const NOISES = {
  white: { color: '#f4f4ee', perHz: [92, 92], perOctave: i => 40 + i * 15, note: 'White noise puts the same power in every hertz. Each octave up is twice as wide as the one before, so it holds twice the power: the top end dominates and you hear a bright hiss.' },
  pink: { color: '#eeb6c9', perHz: [52, 152], perOctave: () => 92, note: 'Pink noise fades as the frequency rises, by just enough that every octave carries the same power. Many people find it sounds even, like steady rain.' },
  brown: { color: '#c79b6b', perHz: [36, 204], perOctave: i => 145 - i * 15, note: 'Brown noise fades twice as steeply as pink. Low octaves carry most of the power, so it rumbles like a distant waterfall.' },
};
function noisePicture(p) {
  const current = NOISES[p.color] || NOISES.pink;
  const lines = Object.entries(NOISES).map(([name, n]) => {
    const on = n === current;
    return `<path d="M60 ${n.perHz[0]}L340 ${n.perHz[1]}" stroke="${n.color}" stroke-width="${on ? 3.5 : 1.3}" stroke-opacity="${on ? 1 : .35}" stroke-linecap="round"/>${on ? '' : text(346, n.perHz[1] + 4, name, { size: 10.5, fill: n.color })}`;
  }).join('');
  const bars = Array.from({ length: 8 }, (_, i) => {
    const height = current.perOctave(i);
    return `<rect x="${448 + i * 34}" y="${208 - height}" width="24" height="${height}" rx="3" fill="${current.color}" fill-opacity=".9"/>`;
  }).join('');
  const axis = (x0, x1) => `<path d="M${x0} 208H${x1}" stroke="${LINE}" stroke-opacity=".3"/>${text(x0, 228, 'low', { size: 11 })}${text(x1, 228, 'high', { size: 11, anchor: 'end' })}${text((x0 + x1) / 2, 228, 'frequency →', { size: 11, anchor: 'middle' })}`;
  const svg = `${label(60, 24, 'POWER IN EACH HERTZ', current.color)}${lines}${axis(60, 340)}
    ${label(448, 24, 'POWER IN EACH OCTAVE', current.color)}${bars}${axis(448, 716)}`;
  return { svg, caption: current.note, title: 'Where the energy lives' };
}

function shepardPicture(p, live) {
  const direction = p.direction === 'down' ? -1 : 1, pitchClass = live?.pitchClass ?? 0;
  const x0 = 50, x1 = 716, base = 204, top = 138, lo = Math.log2(27.5), hi = Math.log2(12000), centre = Math.log2(700);
  const xOf = log => x0 + (log - lo) / (hi - lo) * (x1 - x0);
  const weight = log => Math.exp(-.5 * ((log - centre) / 1.15) ** 2);
  const bell = curve(u => weight(lo + u * (hi - lo)), x0, x1, base, top, 200);
  const bars = (pc, ghost) => Array.from({ length: 8 }, (_, i) => {
    const log = Math.log2(110) + i - 2 + pc / 12;
    if (log < Math.log2(30) || log >= hi) return '';
    const x = xOf(log), y = base - weight(log) * top;
    return ghost ? `<path d="M${x.toFixed(1)} ${base}V${y.toFixed(1)}" stroke="${LEFT}" stroke-opacity=".4" stroke-width="2" stroke-dasharray="3 4"/>`
      : `<path d="M${x.toFixed(1)} ${base}V${y.toFixed(1)}" stroke="${LEFT}" stroke-width="6" stroke-linecap="round"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${LEFT}"/>`;
  }).join('');
  const arrow = direction > 0 ? `M340 42h80m-9-7 9 7-9 7` : `M420 42h-80m9-7-9 7 9 7`;
  const svg = `${stroke(bell, WARM, 1.8, 'stroke-dasharray="5 4"')}<path d="M${x0} ${base}H${x1}" stroke="${LINE}" stroke-opacity=".3"/>
    ${bars(pitchClass + direction, true)}${bars(pitchClass, false)}
    ${stroke(arrow, MIX, 2)}${label(380, 24, `EVERY STEP, ALL TONES MOVE ${direction > 0 ? 'UP' : 'DOWN'}`, MIX, 'middle')}
    ${label(x0, 24, `STEP ${pitchClass + 1} OF 12`, LEFT)}${label(x1, 24, 'LOUDNESS LIMIT', WARM, 'end')}
    ${text(x0, 226, 'low', { size: 11 })}${text(xOf(centre), 226, '700 Hz', { size: 11, anchor: 'middle' })}${text(x1, 226, 'high', { size: 11, anchor: 'end' })}
    ${text((x0 + x1) / 2, 244, 'solid = sounding now · dashed = the next step', { size: 10.5, anchor: 'middle' })}`;
  const edge = direction > 0 ? ['top', 'bottom'] : ['bottom', 'top'];
  const caption = `Each bar is one tone, an octave from its neighbours. They all play at once and sound like a single note. Every step nudges all of them ${direction > 0 ? 'up' : 'down'} together, under a fixed hill that sets how loud each may be. Tones fade away at the ${edge[0]} while new ones sneak in at the ${edge[1]}. After 12 steps every bar stands where its neighbour stood: the picture is back where it began, and so is the sound.`;
  return { svg, caption, title: 'A climb that goes nowhere' };
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function pitchPicture(p) {
  const f = Number(p.frequency), x0 = 40, x1 = 720, firstNote = 43, lastNote = 108; // G2 … C8
  const noteWidth = (x1 - x0) / (lastNote - firstNote + 1);
  const midi = 69 + 12 * Math.log2(f / 440), nearest = Math.round(midi);
  const keys = Array.from({ length: lastNote - firstNote + 1 }, (_, i) => {
    const note = firstNote + i, black = [1, 3, 6, 8, 10].includes(note % 12), x = x0 + i * noteWidth;
    return `<rect x="${x.toFixed(1)}" y="150" width="${(noteWidth - 1).toFixed(1)}" height="${black ? 30 : 46}" rx="1.5" fill="${note === nearest ? WARM : black ? '#16261f' : '#dfe6d6'}"/>${note % 12 === 0 ? text(x + noteWidth / 2, 212, `C${note / 12 - 1}`, { size: 10.5, anchor: 'middle' }) : ''}`;
  }).join('');
  const mx = Math.max(x0, Math.min(x1, x0 + (midi - firstNote + .5) * noteWidth));
  const waves = f * .01;
  const svg = `${baseline(x0, x1, 72)}${stroke(curve(u => Math.sin(TAU * waves * u), x0, x1, 72, 30, 1400), LEFT, 1.8)}
    ${label(x0, 24, `10 MILLISECONDS OF THIS TONE · ${r1(waves)} WAVES`, LEFT)}
    ${keys}<path d="M${mx.toFixed(1)} 146l-7 -12h14z" fill="${WARM}"/>
    ${label(mx, 126, `${hzText(f)} · NEAR ${NOTE_NAMES[((nearest % 12) + 12) % 12]}${Math.floor(nearest / 12) - 1}`, WARM, mx < 150 ? 'start' : mx > 610 ? 'end' : 'middle')}
    ${text((x0 + x1) / 2, 238, 'piano notes, low to high · each C is double the frequency of the C before it', { size: 10.5, anchor: 'middle' })}`;
  const caption = `${hzText(f)} means the air pushes back and forth ${Math.round(f).toLocaleString('en')} times every second. More waves per second sounds higher. On the keyboard, every octave to the right doubles that number, so the same 10 Hz step is a big change at the low end and a tiny one at the top.`;
  return { svg, caption, title: 'Faster waves, higher note' };
}

function frequencyPicture(p) {
  const f = Number(p.frequency), x0 = 40, x1 = 720, lo = Math.log2(80), hi = Math.log2(18000);
  const xOf = hz => x0 + (Math.log2(hz) - lo) / (hi - lo) * (x1 - x0);
  const x = xOf(Math.max(80, Math.min(18000, f)));
  const band = (a, b, name, opacity) => `<rect x="${xOf(a).toFixed(1)}" y="34" width="${(xOf(b) - xOf(a) - 3).toFixed(1)}" height="24" rx="4" fill="${LINE}" fill-opacity="${opacity}"/>${label((xOf(a) + xOf(b)) / 2, 50, name, MIX, 'middle')}`;
  const ticks = [100, 250, 500, 1000, 2000, 4000, 8000, 16000].map(hz => `<path d="M${xOf(hz).toFixed(1)} 62v7" stroke="${DIM}"/>${text(xOf(hz), 82, hz < 1000 ? hz : `${hz / 1000}k`, { size: 10.5, anchor: 'middle' })}`).join('');
  // The inner-ear membrane, unrolled: wide and floppy at the far tip (low), narrow and stiff at the entrance (high).
  const ribbon = `M${x0} 132L${x1} 152V176L${x0} 196Z`;
  const bump = curve(u => Math.exp(-.5 * (((x0 + u * (x1 - x0)) - x) / 16) ** 2) * Math.sin((x0 + u * (x1 - x0) - x) / 5 + Math.PI / 2), x0, x1, 164, 26, 500);
  const ears = p.ear === 'left' ? 'LEFT EAR ONLY' : p.ear === 'right' ? 'RIGHT EAR ONLY' : 'BOTH EARS';
  const svg = `${band(80, 250, 'BASS · RUMBLE', .07)}${band(250, 4000, 'MOST OF SPEECH AND MUSIC', .12)}${band(4000, 18000, 'SPARKLE · HISS', .07)}${ticks}
    <path d="${ribbon}" fill="${RIGHT}" fill-opacity=".16" stroke="${RIGHT}" stroke-opacity=".5"/>
    ${stroke(bump, WARM, 2.4)}<path d="M${x.toFixed(1)} 62V208" stroke="${WARM}" stroke-dasharray="3 4"/>
    ${label(x, 24, `${hzText(f)} · ${ears}`, WARM, x < 150 ? 'start' : x > 610 ? 'end' : 'middle')}
    ${label(x0, 118, 'YOUR INNER EAR, UNROLLED', RIGHT)}
    ${text(x0, 226, '← far tip: low tones peak here', { size: 11 })}${text(x1, 226, 'entrance: high tones peak here →', { size: 11, anchor: 'end' })}`;
  const where = f < 250 ? 'Down here sits bass and rumble. Small earbuds and phone speakers often cannot produce it.' : f <= 4000 ? 'This is the busy middle, where most of speech and melody lives.' : f <= 10000 ? 'Up here are hiss, sparkle and the crisp edges of consonants.' : 'This is the very top. It is the first range to fade with age, and many headphones struggle here too.';
  const caption = `${where} Inside your inner ear, a membrane sorts sound by frequency: each tone makes one spot move the most. If a tone vanishes, the cause may be your headphones or the volume, not you.`;
  return { svg, caption, title: 'A place for every frequency' };
}

function gapPicture(p) {
  const gap = Number(p.gapMs), x0 = 40, x1 = 720, span = 100, per = (x1 - x0) / span, yc = 78;
  const a = x0 + (50 - gap / 2) * per, b = x0 + (50 + gap / 2) * per;
  const grains = Array.from({ length: 227 }, (_, i) => {
    const x = x0 + i * 3;
    if (x >= a - 1 && x <= b - 1) return '';
    const height = 8 + 34 * Math.abs(NOISE[i * 7 % NOISE.length]);
    return `<rect x="${x}" y="${(yc - height).toFixed(1)}" width="2" height="${(height * 2).toFixed(1)}" fill="${LEFT}" fill-opacity=".8"/>`;
  }).join('');
  const ruler = Array.from({ length: 11 }, (_, i) => `<path d="M${x0 + i * 10 * per} 134v7" stroke="${DIM}"/>${text(x0 + i * 10 * per, 156, `${i * 10}`, { size: 10.5, anchor: 'middle' })}`).join('');
  const reference = (y, ms, name) => `<rect x="${x0}" y="${y}" width="${(ms * per).toFixed(1)}" height="9" rx="3" fill="${RIGHT}" fill-opacity=".55"/>${text(x0 + ms * per + 8, y + 9, name, { size: 11 })}`;
  const svg = `${grains}<path d="M${a.toFixed(1)} 122v-8M${b.toFixed(1)} 122v-8M${a.toFixed(1)} 118H${b.toFixed(1)}" stroke="${WARM}" stroke-width="1.8" fill="none"/>
    ${label((a + b) / 2, 24, `${r1(gap)} ms OF SILENCE`, WARM, 'middle')}
    <path d="M${x0} 134H${x1}" stroke="${DIM}"/>${ruler}${text(x1, 172, 'milliseconds', { size: 10.5, anchor: 'end' })}
    ${reference(188, 16.7, 'one frame on a 60 Hz screen · 16.7 ms')}${reference(210, 41.7, 'one frame of cinema film · 41.7 ms')}
    ${reference(232, gap, 'this gap')}`;
  const caption = `This is a tenth of a second of noise, with the gap drawn to scale. ${gap >= 30 ? 'A gap this long is easy to hear: a clear stutter.' : gap >= 8 ? 'Shorter than a blink by far, yet most people still hear a clear tick or stutter.' : 'Now it is only a few thousandths of a second. Many listeners can still catch gaps of 2 to 5 ms, though noise has random dips of its own to confuse you.'} Eyes miss a flicker this brief. Ears are built for timing.`;
  return { svg, caption, title: 'How long is that silence?' };
}

const PICTURES = { phase: phasePicture, beats: beatsPicture, harmonics: harmonicsPicture, amplitude: amplitudePicture, spatial: spatialPicture, masking: maskingPicture, noise: noisePicture, shepard: shepardPicture, pitch: pitchPicture, frequency: frequencyPicture, gap: gapPicture };

/** Returns {svg, caption, title} for an experiment's current settings. */
export function picture(id, params, live = null) {
  const draw = PICTURES[id];
  if (!draw) return null;
  const { svg, caption, title } = draw(params, live);
  return {
    title, caption,
    svg: `<svg class="picture-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}. ${caption.replace(/"/g, '&quot;')}" font-family="Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${svg}</svg>`,
  };
}
