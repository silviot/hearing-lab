# Accessibility and privacy

## Interaction goals

Hearing Lab is an audio activity, but its navigation, instructions, controls, and conclusions should also be understandable without relying on sound alone. The app does not equate the ability to hear a demonstration with intelligence, effort, or success.

- Use native buttons, inputs, labels, headings, and visible focus states.
- Make the important numeric value readable beside every control.
- Keep explanatory text available beside visualizations; do not encode an answer only in colour.
- Provide a direct stop action and avoid automatic playback when navigating.
- Respect reduced-motion preferences. Animations illustrate a relationship; they must not be required to answer a challenge.
- Let listeners respond at their own pace. Challenges measure choices, not reaction time.
- Keep incorrect answers descriptive. A difficult or inaudible sound may reflect the output equipment, room, fatigue, attention, or the listener.

These are design and review requirements, not a claim of certified accessibility or compatibility with every assistive technology. [CONTRIBUTING](../CONTRIBUTING.md) describes how to record checks actually performed.

## Headphones and mono

Headphones make it possible to route different signals to the two ears. Speakers introduce room acoustics and cross-channel sound reaching both ears. Mono output combines the channels; phase or spatial demonstrations may change or disappear. Explain these conditions before interpreting a stereo result.

A listener using one ear can still explore many frequency, amplitude, timbre, beat, and noise relationships. Do not make a stereo task a prerequisite for using the rest of the lab.

## Children and shared devices

The language and controls are intended to be useful to adults and curious children. An adult should help a child set a quiet listening level and understand the demonstrations. The lab does not require names, age, an account, or a personal health history.

On a shared browser, local notebook entries remain visible to the next person using that browser profile. Export a copy before clearing data if you want to keep it.

## Data flow

| Activity | Where the data goes |
| --- | --- |
| Generating and playing a sound | The browser and the device's audio output. |
| Answering a challenge | In-memory app state, and local notebook storage when saved. |
| Writing a note | Browser-local storage, retaining up to 300 recent entries. |
| Dictating a note | The microphone, through the browser's own speech recognition. In most browsers the audio goes to the browser vendor's speech service; the app only receives the text. |
| Exporting JSON | A file download requested by the user. |
| Sharing an experiment link | Parameter settings in the URL fragment, copied to the clipboard on request; notebook text is excluded. |
| Loading a hosted app | The static host receives ordinary page/asset requests. |
| Opening a reference/source link | The browser navigates to that external site. |

The microphone is used only while the user dictates a note, after the browser's own permission prompt, and only through the browser's speech recognition; the app never reads or stores the audio. Browsers without that feature do not show the Dictate button. There is no audio recording, application telemetry, remote scoring service, advertising, or cloud notebook. A hosting provider can still keep access logs; self-hosting controls that part of the data flow.

## Persistence limits

Browser storage is not a backup. Private browsing, storage policies, quota, clearing site data, or changing origin can remove or separate saved entries. An exported JSON file is portable as data; do not assume that results from different devices or listening levels are directly comparable.

Lab-volume and setup preferences are also stored locally. A shared experiment URL carries the selected experiment settings in its fragment; sharing the URL does not share saved notebook observations or challenge records.

All sound assets are generated locally. A downloaded copy served on localhost works without internet access. A previously opened hosted page may continue to work while open, but an offline reload depends on what the browser has retained; no permanent offline installation is promised merely by visiting the site.
