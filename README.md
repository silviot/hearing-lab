# Hearing Lab

**An open audio playground for curious ears.** Change a sound, hear what happens, and discover a little of the physics and perception behind it.

Hearing Lab brings eleven interactive experiments, three listening challenges, and a personal lab notebook to a browser. It is designed for curious adults and children exploring with an adult: approachable explanations, real controls, interactive diagrams, and room to experiment.

Available in **16 languages** — English, Español, العربية, Français, Português, Bahasa Indonesia, हिन्दी, اردو, Русский, Deutsch, 中文, Български, Magyar, Română, Italiano, and Hrvatski — automatically matching your browser's preferred language, with a language switcher in the header and full right-to-left layout support for Arabic and Urdu.

## Explore

| Experiment | Try this |
| --- | --- |
| Phase | Put two waves together. Discover when they reinforce or cancel. |
| Beats | Bring two pitches close together and hear a slow pulse emerge. |
| Harmonics | Build a timbre and listen for a fundamental that is absent from the signal. |
| Masking | Hide a tone in noise, then flip the tone in one ear and compare. |
| Spatial hearing | Compare differences in level and arrival time between your ears. |
| Noise colours | Listen to different distributions of energy across frequency. |
| Shepard tones | Follow a staircase of pitches that seems to keep rising or falling. |
| Amplitude | Compare the waveform's size, digital gain, and perceived loudness. |
| Frequency | Explore how a tone changes as its frequency changes. |
| Gaps | Listen for a brief silence inside a noise burst. |
| Pitch | Compare nearby pitches and explore small frequency differences. |

The **pitch**, **gap**, and **frequency** challenges hide the answer until you respond. Pitch and gap difficulty adapt to your answers. The frequency challenge reports repeated observations at fixed settings, rather than inventing a hearing age or a clinical cutoff. Save findings in the local notebook and export them as JSON. Experiment links can share your parameter settings while leaving notebook entries private.

## Run locally

Requires **Node.js 20 or newer**. There are no npm dependencies to install.

```sh
git clone https://github.com/silviot/hearing-lab.git
cd hearing-lab
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The server also runs directly:

```sh
node scripts/serve.mjs --port 8080
```

`PORT` and `HOST` environment variables are supported. The default binding is `0.0.0.0`; use `--host 127.0.0.1` to limit access to your own computer. The server is a development/static-preview utility.

```sh
npm test
npm run check
npm run build
node scripts/serve.mjs --dist
```

The build creates `dist/` by copying the application assets; it needs no bundler, package download, or network access. It also generates `dist/hearing-lab-source.tar.gz` with the full application source, tests, documentation, scripts, workflows, and license, for the app's source-download link. Keep the directory structure intact. Browser ES modules should be served over HTTP, rather than opened with `file://`.

## Before listening

Start with your device volume low and use the setup sound to find a quiet, comfortable level. Leave the volume there while comparing sounds. Use headphones for the spatial and stereo experiments; with speakers, both ears hear both channels and the room changes the result. System mono mode combines the channels and changes stereo demonstrations.

This is an educational playground, not a calibrated hearing assessment. The sound reaching your ears depends on the browser, device, headphones, fit, processing, and room. The app controls digital samples; it cannot measure the acoustic level at your ears. A tone you do not notice is not a reason to turn the volume up. Stop a sound if it is uncomfortable.

## Privacy and offline use

Sound is synthesized on your device. There is no account, analytics service, advertising, remote sound library, or application backend. Up to 300 recent notebook entries stay in that browser's local storage unless you export them. Listening preferences are stored locally too. Dictating a note is optional: it uses the browser's speech recognition, which asks for the microphone and, in most browsers, sends the audio to the browser vendor's speech service. Clearing site data removes local entries; an exported file is your own copy.

After downloading the project, the app runs with no internet connection using the local server above. A hosted visit still downloads the page and its assets from that host, which may keep normal access logs. Following a source or reference link opens the linked site. Browser cache alone is not a guarantee that a hosted copy will reload offline.

## Host it

Serve the contents of `dist/` with any static web server. Assets use relative paths so the same build can live at `/` or a project path such as `/hearing-lab/`.

CI runs tests, checks, and the build for pushes and pull requests. The included **Deploy GitHub Pages** workflow is manual: it does not publish on every push. To use it, select **GitHub Actions** under the repository's **Settings → Pages → Build and deployment → Source**, then run the workflow from **Actions**. The workflow reports the deployed URL after a successful run. See [deployment notes](docs/deployment.md).

## How it works

The app uses native browser ES modules and the Web Audio API. A small, dependency-free DSP layer generates the samples; the audio engine controls playback; challenge logic and interface code are separate. No framework or build-time transpiler is required.

- [Architecture](docs/architecture.md): boundaries, playback lifecycle, storage, and extension points.
- [Experiment methodology](docs/methodology.md): signal formulas, challenge procedures, and interpretation limits.
- [Accessibility and privacy](docs/accessibility-privacy.md): interaction design and local data handling.
- [References](docs/references.md): primary research and standards, with their relevance to this app.
- [Contributing](CONTRIBUTING.md): development and review expectations.

The research informs the demonstrations and adaptive procedures. It does not validate this particular app, hardware, or score as a clinical instrument.

## License

Copyright © 2026 Hearing Lab contributors. Licensed under the **GNU Affero General Public License, version 3 only** (`AGPL-3.0-only`). See the complete [LICENSE](LICENSE).

You can use, study, modify, and redistribute Hearing Lab under those terms. Keep the license and notices, and make corresponding source available as required by the license, including for modified versions offered for remote interaction. If you host a fork, its source link should identify the source for the version you actually serve. The software comes without warranty.

The license document is the unabridged AGPLv3 text from the SPDX license list. Its generic appendix contains an example “or later” notice; Hearing Lab's project license choice is explicitly **version 3 only**.

See [third-party notices](THIRD_PARTY_NOTICES.md) for the provenance of the license text and published signal-processing methods.
