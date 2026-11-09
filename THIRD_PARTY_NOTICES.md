# Third-party notices and method provenance

Hearing Lab's code, documentation, and original icon are offered under **AGPL-3.0-only**, with the published-method and public-domain origins described below. The application has no bundled npm packages, recorded sound assets, web fonts, or icon libraries. Browser APIs and Node.js are supplied by the environment.

## Pseudorandom number generators

`createSeededRandom` in `src/audio/dsp.js` implements **Mulberry32**, designed by **Tommy Ettinger (2017)**. The [original C implementation](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) carries a worldwide public-domain dedication referring to [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The compact JavaScript form is also documented in **bryc's** [PRNG collection](https://github.com/bryc/code/blob/master/jshash/PRNGs.md), which explicitly marks its implementations as public domain.

The challenge randomizer uses the **xorshift32** recurrence with shifts 13, 17, and 5, associated with George Marsaglia's xorshift family. The same public-domain PRNG collection documents that recurrence. These generators support repeatable demonstrations and shuffled trials; they are not cryptographic random generators or claims of research-grade randomness.

## Published signal-processing methods

The following references identify mathematical methods and algorithm ideas. Hearing Lab implements them in its own code; it does not bundle the referenced articles or their source files.

- **Pink noise:** an original octave-rate sample-and-hold implementation, inspired by Voss/McCartney-style generation. Robin Whittle's [DSP generation of pink noise archive](https://www.firstpr.com.au/dsp/pink-noise/) collects the algorithm's history and discussion of spectral limitations. No external pink-noise filter implementation or coefficient table is included.
- **Masking filter:** the standard constant-peak-gain band-pass biquad equations described in Robert Bristow-Johnson's [Audio EQ Cookbook](https://webaudio.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html). Filter coefficients are calculated from frequency, sample rate, and Q.
- **Spectral visualization:** an original radix-2 FFT implementation with Hann-windowed excerpts. No FFT library is bundled.

The psychoacoustic research behind individual demonstrations and adaptive procedures is listed in [references](docs/references.md).

## License document

The complete [LICENSE](LICENSE) is the GNU Affero General Public License version 3, copyright © 2007 Free Software Foundation, Inc. The license text permits verbatim copying and distribution while prohibiting changes to the license document itself. It is included unchanged from the SPDX [AGPL-3.0-only text](https://github.com/spdx/license-list-data/blob/main/text/AGPL-3.0-only.txt), Git blob `0c97efd25b5974b974ed9a8a18207bc4f55bb338`.

Hearing Lab's choice is version 3 only. Public-domain algorithm origins and external research citations do not change that project license choice.
