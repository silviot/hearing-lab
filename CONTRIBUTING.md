# Contributing to Hearing Lab

Useful contributions make a sound easier to explore, an explanation more accurate, or the app easier to use. Keep the project approachable for someone opening the code for the first time.

## Development

Use Node.js 20 or newer. No dependency installation is needed.

```sh
npm run dev
npm test
npm run check
npm run build
```

Tests use Node's built-in test runner. The checks validate JavaScript syntax, local file references, JSON, and essential project metadata. They do not replace listening and browser interaction checks.

## Changes to sound

Keep mathematical signal generation separate from browser playback and UI. Describe the intended signal, sample rate assumptions, normalization, peak bound, timing, and ramp convention. Include a meaningful numerical test when a change could alter a frequency, envelope, channel assignment, or adaptive result. A test should independently verify the property being claimed.

Use the audio clock to schedule intervals. Do not use a UI timeout as the source of precise sound timing. Preserve the stop path and bounded playback. Keep explanatory and scoring displays independent of the hidden correct answer during a trial.

Do not label an uncalibrated digital level as dB SPL or dB HL. Do not add health grades, hearing ages, diagnostic interpretations, or population percentiles without evidence for the exact procedure and a separately reviewed product decision. A cited paper is not validation of a new implementation.

## Changes to the interface

Use semantic controls with visible labels, keyboard access, and clear focus states. Keep values and important findings available as text, not only a chart or colour. Respect reduced-motion preferences. Avoid automatic playback, audio-only instructions, timed response demands, or celebratory sounds that interfere with listening.

Make unfamiliar terms understandable in context. Explain what a control changes and invite a concrete comparison. Put deeper mathematics in the documentation or an optional explanation.

## Browser review

For a change that affects playback or interaction, record the browser, OS, output device type, and what you actually checked. Relevant cases include play/stop, switching experiments, keyboard operation, narrow screens, interrupted audio, mono output, and repeated trials. Do not describe a browser as verified unless it was tested.

## Assets, privacy, and licensing

Prefer synthesized signals and original assets. If external material is necessary, record its origin and exact license, including any attribution or redistribution conditions. A publicly accessible recording or repository is not automatically reusable.

The app has no microphone access, tracking, accounts, or remote API dependency. Discuss a change to that model before introducing it. Do not include personal notebook exports in issues unless the contributor intentionally chooses to share them.

By contributing, you offer your contribution under the project's **AGPL-3.0-only** license. Retain existing notices and add the following identifier to new code files:

```js
// SPDX-License-Identifier: AGPL-3.0-only
```

Keep the source link accurate for redistributed or hosted modifications. The full terms are in [LICENSE](LICENSE).

## A useful pull request

Explain the problem, the change in observable behaviour, and the evidence used to check it. For a new experiment, include its learning goal, signal definition, interpretation limits, and primary references. Small, focused changes are easier to assess than a new framework or a broad dependency update.
