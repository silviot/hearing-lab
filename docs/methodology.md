# Experiment methodology

This document describes the signals and informal procedures implemented by Hearing Lab. The numerical definitions are reproducible; the acoustic output and a listener's responses also depend on the playback system and environment. These are educational adaptations, not validated clinical protocols. Primary references are collected in [references.md](references.md).

## Shared signal conventions

Samples are floating-point digital amplitudes. For sample index `n`, sample rate `fs`, frequency `f`, phase `phi`, and amplitude `A`, a sine is:

```text
x[n] = A sin(2π f n/fs + phi)
```

The renderer uses the actual audio-context sample rate. Tone generation is bounded by `min(20,000 Hz, 0.45 × fs)`, leaving space below Nyquist (`fs/2`). Complex waveforms omit harmonics above that band. The upper bound is a digital synthesis constraint, not a claim about headphone output or human audibility.

Most demonstrations have 20 ms smooth onset and offset ramps. The raised-cosine ramp is equivalent to `sin²(πt / 2T)` for elapsed ramp time `t` from zero to duration `T`. It reduces the broadband transient caused by abruptly switching a signal on. First and last samples are zero. Demonstrations are finite, with an eight-second engine maximum; the UI can request a shorter duration than a generator's default.

The engine's fallback master gain is `0.08`, capped at `0.18`. The app initializes its lab-volume control to 35% of that cap (`0.063` actual gain), or a saved preference. Playback accepts only finite sample values with magnitude at most `0.95`. These are engineering bounds on digital values. They cannot guarantee a particular sound pressure level at the ear.

`20 log10(A₂/A₁)` expresses an amplitude ratio in decibels. A gain of −6 dB is approximately half the amplitude; it is not a claim of half the perceived loudness. The app's gain and SNR values are not dB HL. It does not infer dB SPL from a system-volume percentage.

## Phase, polarity, and delay

The phase experiment can send related signals to separate channels or mix them to mono:

```text
mono[n] = (left[n] + right[n]) / 2
```

An exact polarity inversion gives `right[n] = −left[n]`, so the software mono sum is zero. Sending those signals to separate headphone drivers does not add them at one physical point and does not guarantee silence. The percept may instead change in location or diffuseness.

For a sine, a half-cycle phase shift is the same as polarity inversion. A delay `τ` produces a frequency-dependent phase shift `−2πfτ`; it is not one constant phase shift for every harmonic. For complex or noise sources the renderer offers polarity inversion or delay, while arbitrary phase rotation is reserved for a sine. Delayed noise is generated from a shared seeded source with interpolation.

## Beats

The default ingredients are 440 and 444 Hz:

```text
sin(2πf₁t) + sin(2πf₂t)
  = 2 cos(π(f₂−f₁)t) sin(π(f₁+f₂)t)
```

The repeated maxima in envelope magnitude occur at `|f₂−f₁|`, giving four beats per second in this example. The mixed condition sends the sum to each ear. The separate condition sends one component to each ear. Each component retains its digital peak amplitude of `0.3`; total level therefore differs between these conditions. They are not loudness-matched.

The separate-ear condition can have a different, subtler binaural percept. The app makes no claim that binaural beats improve sleep, concentration, or health.

## Harmonics and missing fundamental

Six sliders control components at `f₀, 2f₀, …, 6f₀`; the default fundamental is 200 Hz. The synthesized signal is:

```text
x[n] = 0.14 × sum(a[k] sin(2π k f₀ n/fs)), k = 1…6
```

Each slider weight `a[k]` is between zero and one. A fixed scale preserves the amplitude of remaining components when another is removed. The result is not renormalized after removing the fundamental.

With harmonics 2–6 present, spacing and periodicity can preserve the impression of a 200 Hz pitch. That frequency is absent from the generated waveform when its slider is zero. Headphone or other nonlinear distortion may reintroduce acoustic components, so the app does not establish that no 200 Hz energy reaches the ear.

## Binaural masking

The same seeded noise is sent to both ears. A pulsed tone is mixed with it either with the same polarity in both ears or inverted in one ear:

```text
matching: left = noise + tone; right = noise + tone
opposite: left = noise + tone; right = noise − tone
SNR dB = 20 log10(RMS(tone) / RMS(noise))
```

The default tone is 500 Hz. The continuous masker is white noise passed through a constant-peak-gain band-pass biquad centered on the tone, with `Q = 2.5`. At the default frequency its nominal bandwidth is about 200 Hz, with smooth filter skirts; it is not a 400–600 Hz brickwall filter. The noise source is prepared once toward RMS `0.07`, with peak capped at `0.25`.

Four tone pulses occupy 75% of each of four equal clip slots, with 20 ms tone ramps. Noise continues between pulses. SNR compares tone RMS with total masker RMS over the four tone windows, including their tapers and accounting for the outer envelope; the gaps between pulses are excluded. It does not describe noise power in a one-hertz band. Tone polarity and channel routing do not independently renormalize the two conditions.

The biquad uses the standard constant-peak band-pass equations in Robert Bristow-Johnson's [Audio EQ Cookbook](https://webaudio.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html):

```text
w = 2π f/fs; alpha = sin(w)/(2Q); a0 = 1 + alpha
b0 = alpha/a0; b1 = 0; b2 = −alpha/a0
a1 = −2cos(w)/a0; a2 = (1−alpha)/a0
y[n] = b0 x[n] + b2 x[n−2] − a1 y[n−1] − a2 y[n−2]
```

Only the tone changes polarity. This distinction is necessary to demonstrate a change in binaural signal/noise relationship. Mixing the opposite condition to mono cancels the tone in software; that is a separate operation from binaural unmasking through headphones. This demonstration does not measure a clinical masking-level difference.

## Spatial hearing

Level balance and waveform delay are adjustable independently. The panner uses equal-power coefficients:

```text
left gain  = cos((pan + 1)π/4)
right gain = sin((pan + 1)π/4), where −1 ≤ pan ≤ 1
```

Positive delay means the right waveform is delayed relative to the left. The delay range is ±1 ms. The source can be a tone or seeded noise. The onset/offset envelope is shared; this is a waveform timing comparison, not a complete physical sound-source simulation.

No individualized head-related transfer function, room reflections, elevation, or head tracking is modeled. A sound may remain inside the head, and periodic tones can have ambiguous timing cues. A pan setting is not an angle in degrees.

## Noise colours

White noise uses independent uniform pseudorandom samples. Pink noise uses an original octave-rate sample-and-hold implementation inspired by Voss/McCartney methods: `ceil(log₂(fs/20))` independent rows change every 2, 4, 8, … samples, and an independent white component is added at every sample. At 48 kHz this gives twelve held rows plus white. The sum is divided by the number of components, and the finite excerpt's DC mean is removed. Brown noise uses a leaky integrator.

These are finite digital approximations to the characteristic spectral tendencies: white power is roughly constant per hertz, pink power roughly constant per octave, and brown power decreases more steeply at high frequency. The octave-rate pink method has spectral ripples; it is not a precision `1/f` source.

Generated noise is approximately RMS-matched with a peak ceiling before it is shared across comparison conditions. This neither guarantees equal perceived loudness nor makes these files precision noise references. The seed is part of reproducibility; it does not replace an acoustic calibration.

## Shepard staircase

Each step adds sine components separated by octaves. A fixed Gaussian weighting in log-frequency space is centered near 700 Hz. Pitch classes advance or retreat in semitone steps while components fade through this spectral envelope. The default renderer makes twelve 450 ms steps, with 40 ms internal envelopes. A UI setting can use a different overall duration.

This is a finite, stepped Shepard demonstration. Replaying a cycle can suggest continued ascent or descent, but the engine does not run an endless loop. Apparent circularity depends on spectrum, equipment, and listener. The component display describes the generated signal rather than a measured percept.

## Wave shape and amplitude

Sine, triangle, square, and sawtooth options share a fixed digital scale and fundamental frequency. Non-sinusoidal options are constructed from harmonic sums, limited both by the sample rate and by a maximum of 48 harmonics. Headroom accommodates overshoot in truncated harmonic reconstructions.

The gain control applies `10^(gainDb/20)` to the waveform. Different shapes are not RMS- or loudness-matched: changing their harmonic content also changes average energy and perceived brightness. That difference is part of the experiment.

## Frequency and gap explorers

The frequency explorer plays a short sine with the selected channel routing and fixed digital amplitude. Device response can have peaks and dips, so audibility need not vary monotonically with frequency. No maximum hearing frequency is inferred from moving a slider.

The gap explorer inserts two gaps in a finite white-noise signal. Its gap value is the fully silent plateau, with an additional 2 ms taper on each side. Zero gap inserts no center dip at all. The explorer is intentionally separate from the scored gap challenge, whose shorter edge ramps are specified below.

## Listening challenges

The full interval sequence for a trial is rendered into one stereo buffer on a common sample clock. Both ears receive the same signal. The listener identifies an interval without a reaction-time deadline. The target interval is randomized, and the answer is withheld during playback. Replay is permitted and recorded.

### Adaptive rule shared by pitch and gap

Two consecutive correct responses make the task harder; one incorrect response makes it easier. Difficulty is multiplied or divided by two until two actual movement reversals, then by `√2`. A reversal means a nonzero parameter change switches direction; a repeated value at a bound is not a reversal.

Under the stationary assumptions of the transformed up-down method with symmetric steps in log space, this rule targets approximately 70.7% correct. The short app sessions, allowed replay, practice, lapses, and trial caps affect estimation. This target is a property of the procedure, not a pass mark or a promise of statistical confidence.

The target is eight reversals. The final six reversals after the two coarse reversals are averaged geometrically. Four or five available fine reversals permit only a provisional estimate; fewer produce no numeric estimate. Three repeated attempts beyond a stimulus boundary end the run with a boundary result, not a fabricated threshold. Trial-limit termination is preserved in the result.

| Parameter | Pitch challenge | Gap challenge |
| --- | --- | --- |
| Response | Which of two tones is higher? | Which of three noise bursts has a gap? |
| Starting difference | 100 Hz above a 1,000 Hz reference | 32 ms silent plateau |
| Parameter bounds | 0.5–400 Hz difference | 1–64 ms plateau |
| Interval duration | 250 ms | 500 ms |
| Between intervals | 300 ms silence | 250 ms silence |
| Outer ramps | 20 ms | 20 ms |
| Inner gap edges | Not applicable | 0.5 ms additional ramp on each side |
| Scored-trial cap | 40 | 30 |
| Chance performance | 1 in 2 | 1 in 3 |

Pitch tones use the same digital peak amplitude. Results may also express the difference in cents: `1200 log₂((1000 + Δf)/1000)`. Pitch practice trials are excluded from scored state.

Gap intervals have equal total duration. Their noise is not amplified to compensate for missing samples. The reference intervals have no internal attenuation dip. Plateau durations are rounded to the sample grid; ramps add transition time outside the plateau. A result is tied to this exact noise, timing, and ramp convention.

### Frequency field notes

The frequency task uses three intervals; one contains a 350 ms sine and the others contain silence. Intervals are separated by 250 ms. The digital sine peak remains `0.5` before master gain, with 20 ms outer ramps. It samples 250, 500, 1,000, 2,000, 4,000, 8,000, 10,000, and 12,000 Hz, excluding unsupported frequencies above the synthesis band for the actual sample rate.

Three shuffled rounds produce three observations at each frequency. Results show correct responses and trial count at each point. Guessing succeeds one time in three, so three observations are a small field note, not a reliable threshold estimate or highest audible frequency. No hearing age, hearing-loss percentage, or health category is calculated.

## Reading a result

Compare the outcome with the question and conditions actually tested. A change in device, volume, fit, noise, attention, or practice can change the result. Even identical JSON parameters do not ensure identical sound pressure on another setup. Keep the protocol, raw trials, termination reason, and context with a saved observation. Do not turn an exploratory score into a clinical claim.

## What the visualizations show

Waveform panels show generated left, right, and software-mono signals on a shared fixed digital scale. For longer temporal patterns, the panel shows peak envelopes over the clip instead of drawing every oscillation. A displayed cancellation is calculated from sample values, not measured through a microphone.

The spectrum uses a 4,096-point radix-2 FFT of the generated left channel, averaged over four Hann-windowed excerpts. Bars average bin power within logarithmically spaced frequency ranges, using a fixed display scale. This makes timbre and noise-spectrum comparisons useful while preserving level changes. The bars are an explanatory spectrum view, not calibrated acoustic levels, a precision power-spectral-density measurement, or a measurement of headphone response.
