# Architecture

Hearing Lab is a static application built from native browser ES modules. Node.js is used for development scripts and numerical tests; it is not an application backend.

## Boundaries

| Part | Responsibility |
| --- | --- |
| `index.html` and app UI | Navigation, labelled controls, explanations, visualizations, setup, notebook, and user actions. |
| `src/audio/dsp.js` | Generate finite sample buffers, apply envelopes, and report digital peak/RMS values. |
| `src/audio/engine.js` | Own the audio context, bounded playback, master gain, interruption handling, and stop path. |
| `src/lib/catalog.js` | Experiment descriptions, defaults, learning prompts, and reference links. |
| `src/ui/visuals.js` | Explanatory signal visualizations. |
| `src/lib/challenges.js` | Pure challenge state, randomization, adaptive updates, observations, and result summaries. |
| `src/ui/challenges.js` | Present intervals and response controls; connect challenge state to the audio engine and notebook. |
| `src/lib/notebook.js` | Store the user's notebook locally; support a downloadable JSON export. |
| `scripts/` | Local static server, asset-copy build, and project checks. |
| `tests/` | Node-native tests for numerical and state-machine properties. |

Keep signal generation independent of the DOM and `AudioContext` where practical. This makes a waveform inspectable and the challenge procedure reproducible without pretending that numerical tests validate a listener's hardware.

## Playback lifecycle

Audio starts after a user action. The engine owns the context, output level, current sources, and stop path. Starting a new sound must retire the previous one. Use bounded sounds, smooth onset/offset envelopes, and a consistent master level; do not compensate for an inaudible frequency by automatically boosting it.

Schedule the samples or sources against `AudioContext.currentTime`. UI timers may update a display, but do not define fine acoustic timing. Visualizations are explanatory views of generated signals, not measurements made inside the user's ear.

On a background or interruption event that the browser exposes, stop or suspend playback and let the user restart deliberately. A browser does not reliably expose every system output-route change. Headphone disconnection and Bluetooth behaviour therefore belong in manual device testing, not an unconditional software guarantee.

## Digital and acoustic levels

A normalized sample is a number. The application can constrain its magnitude and describe ratios between signals. The sound pressure produced by that number also depends on the DAC, amplifier, system volume, headphones, coupling to the ear, and signal processing.

The master level is a listening preference, not acoustic calibration. Frequency-response plots in the app represent synthesized content or observed performance on this setup. They are not headphone measurements or clinical audiograms.

## Challenge records

Keep trial-level observations with their parameters rather than storing only a final score. Useful records include the challenge and procedure version, actual sample rate, stimulus value, interval order, answer, correctness, replay count, bounds, reversal history, and termination reason. Preserve whether an estimate is completed, provisional, bounded, or absent.

Randomization hides the target interval. A seed, if retained, allows a developer to reproduce the sequence; it does not make sessions across different output hardware acoustically equivalent. Separate practice from scored trials. Never infer a population rank from these local records.

## Notebook and exports

The browser is the storage boundary. Export is an explicit download; there is no upload endpoint or background synchronization. Local storage can be unavailable, cleared, or full, so storage failure should not prevent listening. A JSON download gives the user an independent copy of observations.

Treat user-entered notes as text when rendering them. Do not build HTML from notes or imported content. Avoid recording device identifiers or personal details that are unnecessary for an experiment.

## Static deployment

The build copies `index.html`, `src/`, and `public/` without changing import paths. It also includes the license, README, and documentation. Relative asset paths preserve operation under a repository subpath. There is no runtime CDN or package registry dependency.

Every build creates `hearing-lab-source.tar.gz`, containing the corresponding application source, tests, scripts, workflows, documentation, and license. A small original USTAR writer uses Node's built-in gzip support. It accepts only an explicit list of source files and directories, refuses symlinks, sorts entries, and uses fixed archive timestamps. Repository metadata, local runtime state, temporary QA pages, and `dist/` are not included. Update the allowlist in `scripts/archive.mjs` when adding a new source root.

The development server resolves requests against a fixed root, rejects hidden and traversal path segments, and checks real paths to prevent symlinks escaping that root. It supports GET and HEAD, uses explicit MIME types, and is intended for local development and previews.

## Adding an experiment

Define one question a listener can investigate. Implement the smallest signal generator that makes the question audible; give its parameters units and bounds. Add controls and a textual explanation, then verify the mathematical properties and the interaction. Cite the primary method where relevant, and distinguish the app's demonstration from a validated experimental or clinical protocol.

Prefer a small pure function and a clear experiment definition over a new dependency or a second audio graph. If a signal needs recorded assets, keep its source, license, preprocessing, and version alongside those assets.
