# References and provenance

These sources support the signal definitions, experiment ideas, and implementation decisions. They do not validate Hearing Lab's short challenges as clinical assessments. All app sounds are synthesized locally; the project includes no borrowed speech-test recordings or clinical normative corpus.

## Audio implementation

1. **W3C, Web Audio API 1.0 Recommendation.** [Specification](https://www.w3.org/TR/webaudio-1.0/). Defines audio buffers, sample rates, channel routing, gain, source scheduling, and the audio-context clock. The app uses these mechanisms directly, with no audio framework dependency.

2. **MDN, GainNode.** [API documentation](https://developer.mozilla.org/en-US/docs/Web/API/GainNode). Explains gain multiplication and smooth parameter changes. A digital gain setting is not an acoustic calibration.

3. **Florian Wickelmaier, University of Tübingen: Calibration of Headphones.** [Laboratory procedure](https://www.mathpsy.uni-tuebingen.de/acoulab/calibration.html). Illustrates the measured physical chain needed to relate digital signals to headphone sound pressure. It explains why the app's comfort setup is not called calibration.

Additional signal-processing references: Robert Bristow-Johnson's [Audio EQ Cookbook](https://webaudio.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html) specifies the band-pass biquad used for the masking demo. Robin Whittle's [DSP generation of pink noise archive](https://www.firstpr.com.au/dsp/pink-noise/) records Voss/McCartney-style octave-rate noise methods and their spectral limitations. [Third-party notices](../THIRD_PARTY_NOTICES.md) distinguish published methods from code and assets included in this repository.

## Psychoacoustics and demonstrations

4. **Levitt, H. (1971). Transformed Up-Down Methods in Psychoacoustics.** [Publication record](https://pubmed.ncbi.nlm.nih.gov/5541744/), [DOI: 10.1121/1.1912375](https://doi.org/10.1121/1.1912375). Foundation for transformed adaptive procedures. Hearing Lab uses a short two-down/one-up adaptation; its stopping rules and interface are app-specific.

5. **Shepard, R. N. (1964). Circularity in Judgments of Relative Pitch.** [DOI: 10.1121/1.1919362](https://doi.org/10.1121/1.1919362). Original work on pitch circularity using octave-related components. The app synthesizes its own finite ascending/descending staircase rather than reproducing a research stimulus file.

6. **Licklider, J. C. R. (1951). A Duplex Theory of Pitch Perception.** [Publication record](https://pubmed.ncbi.nlm.nih.gov/14831572/). Historical research on how pitch relates to periodic structure. Relevant to explaining why perceived pitch is not simply the frequency of one spectral component; not a complete modern account of pitch perception.

7. **Stecker, G. C., and Bibee, J. M. (2014). Nonuniform temporal weighting of interaural time differences in 500 Hz tones.** [Open article](https://pmc.ncbi.nlm.nih.gov/articles/PMC4048440/), [DOI: 10.1121/1.4876179](https://doi.org/10.1121/1.4876179). Shows that binaural timing judgments depend on how cues occur over a sound, with differences between listeners. Supports treating the spatial controls as a demonstration rather than a universal location scale.

8. **Wack, D. S., et al. (2012). Functional Anatomy of the Masking Level Difference, an fMRI Study.** [Open article](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0041263), [DOI: 10.1371/journal.pone.0041263](https://doi.org/10.1371/journal.pone.0041263). Describes matched and opposite-polarity signal/noise configurations. Hearing Lab changes tone polarity while preserving the shared masker; its masker and procedure are not a replication of that study.

9. **PSYCHOACOUSTICS-WEB: A free online tool for the estimation of auditory thresholds (2024).** [Open article](https://pmc.ncbi.nlm.nih.gov/articles/PMC11362506/), [DOI: 10.3758/s13428-024-02430-3](https://doi.org/10.3758/s13428-024-02430-3). An example of browser psychoacoustics and explicit adaptive methods. Useful context for the distinction between implementing a method and validating a particular test.

## Open-source research tools considered

- **jsPsych**, [repository](https://github.com/jspsych/jsPsych), [audio-response documentation](https://www.jspsych.org/v8/plugins/audio-keyboard-response/). MIT-licensed behavioral-experiment framework. A useful reference for trials and response handling; not bundled as a dependency.
- **slab**, [repository](https://github.com/DrMarc/slab), [JOSS paper](https://joss.theoj.org/papers/10.21105/joss.03284). MIT-licensed Python toolkit for sound manipulation and psychoacoustic experiments. A reference for stimuli, staircases, and numerical checks; not bundled as a dependency.

## License provenance

The project's [LICENSE](../LICENSE) is the complete, unchanged text retrieved from the SPDX [AGPL-3.0-only license-list entry](https://github.com/spdx/license-list-data/blob/main/text/AGPL-3.0-only.txt), Git blob `0c97efd25b5974b974ed9a8a18207bc4f55bb338`. The SPDX [identifier page](https://spdx.org/licenses/AGPL-3.0-only.html) distinguishes version 3 only from version 3 or later.

Hearing Lab chooses **AGPL-3.0-only** in its project notice and package metadata. The generic “How to Apply” appendix remains verbatim, including its example notice. Original code, documentation, and icon are provided under the project's license. References link to external works; they do not claim those works as project assets.
