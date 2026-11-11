// SPDX-License-Identifier: AGPL-3.0-only
import en from './locales/en.js';

export const LANGUAGES = [
  { code: 'en', name: 'English', englishName: 'English', dir: 'ltr', speech: 'en-US' },
  { code: 'es', name: 'Español', englishName: 'Spanish', dir: 'ltr', speech: 'es-ES' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl', speech: 'ar-SA' },
  { code: 'fr', name: 'Français', englishName: 'French', dir: 'ltr', speech: 'fr-FR' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', dir: 'ltr', speech: 'pt-BR' },
  { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr', speech: 'id-ID' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', speech: 'hi-IN' },
  { code: 'ur', name: 'اردو', englishName: 'Urdu', dir: 'rtl', speech: 'ur-PK' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', dir: 'ltr', speech: 'ru-RU' },
  { code: 'de', name: 'Deutsch', englishName: 'German', dir: 'ltr', speech: 'de-DE' },
  { code: 'zh', name: '中文', englishName: 'Mandarin Chinese', dir: 'ltr', speech: 'zh-CN' },
  { code: 'bg', name: 'Български', englishName: 'Bulgarian', dir: 'ltr', speech: 'bg-BG' },
  { code: 'hu', name: 'Magyar', englishName: 'Hungarian', dir: 'ltr', speech: 'hu-HU' },
  { code: 'ro', name: 'Română', englishName: 'Romanian', dir: 'ltr', speech: 'ro-RO' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', dir: 'ltr', speech: 'it-IT' },
  { code: 'hr', name: 'Hrvatski', englishName: 'Croatian', dir: 'ltr', speech: 'hr-HR' },
];

export const LANGUAGE_BY_CODE = Object.fromEntries(LANGUAGES.map(l => [l.code, l]));

const ALIASES = {
  cmn: 'zh', yue: 'zh', in: 'id', sh: 'hr', hbs: 'hr',
};

const LOADERS = {
  en: async () => ({ default: en }),
  es: () => import('./locales/es.js'),
  ar: () => import('./locales/ar.js'),
  fr: () => import('./locales/fr.js'),
  pt: () => import('./locales/pt.js'),
  id: () => import('./locales/id.js'),
  hi: () => import('./locales/hi.js'),
  ur: () => import('./locales/ur.js'),
  ru: () => import('./locales/ru.js'),
  de: () => import('./locales/de.js'),
  zh: () => import('./locales/zh.js'),
  bg: () => import('./locales/bg.js'),
  hu: () => import('./locales/hu.js'),
  ro: () => import('./locales/ro.js'),
  it: () => import('./locales/it.js'),
  hr: () => import('./locales/hr.js'),
};

const cache = { en };
let currentCode = 'en';
let currentDict = en;

/** Match a BCP-47 tag (e.g. "pt-BR", "zh-Hans-CN", "es-419") to a supported language code, or null. */
export function matchLanguageTag(tag) {
  if (!tag || typeof tag !== 'string') return null;
  const cleaned = tag.trim().toLowerCase().replace(/_/g, '-');
  if (!cleaned) return null;
  if (LANGUAGE_BY_CODE[cleaned]) return cleaned;
  const primary = cleaned.split('-')[0];
  if (LANGUAGE_BY_CODE[primary]) return primary;
  if (ALIASES[primary]) return ALIASES[primary];
  return null;
}

/** Resolve the initial language from an explicit override, saved preference, or browser configuration. */
export function detectLanguage({ urlLang, saved, browserLanguages } = {}) {
  const fromUrl = matchLanguageTag(urlLang);
  if (fromUrl) return fromUrl;
  const fromSaved = matchLanguageTag(saved);
  if (fromSaved) return fromSaved;
  const list = Array.isArray(browserLanguages)
    ? browserLanguages
    : (typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : []);
  for (const candidate of list) {
    const matched = matchLanguageTag(candidate);
    if (matched) return matched;
  }
  return 'en';
}

export function getLanguage() { return currentCode; }
export function getLanguageMeta(code = currentCode) { return LANGUAGE_BY_CODE[code] || LANGUAGE_BY_CODE.en; }
export function isRtl(code = currentCode) { return getLanguageMeta(code).dir === 'rtl'; }

export async function loadLanguage(code) {
  const resolved = matchLanguageTag(code) || 'en';
  if (!cache[resolved]) {
    try {
      const mod = await LOADERS[resolved]();
      cache[resolved] = mod.default || en;
    } catch {
      cache[resolved] = en;
    }
  }
  currentCode = resolved;
  currentDict = cache[resolved];
  return currentDict;
}

function lookup(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Retrieve a raw value (such as an array of strings) from the active locale with English fallback. */
export function tRaw(path) {
  const val = lookup(currentDict, path);
  return val !== undefined ? val : lookup(en, path);
}

/** Translate a dot-path string and interpolate `{key}` placeholders. */
export function t(path, vars = null) {
  const raw = tRaw(path);
  const str = typeof raw === 'string' ? raw : String(raw ?? path);
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export const CATEGORY_ID_MAP = {
  'All experiments': 'all',
  Foundations: 'foundations',
  Perception: 'perception',
  Challenges: 'challenges',
  'Illusions & textures': 'illusions',
};

export function categoryIdOf(catName) {
  return CATEGORY_ID_MAP[catName] || catName || 'all';
}

export function localizedExperiment(exp) {
  if (!exp) return null;
  const tr = tRaw(`experiments.${exp.id}`) || {};
  const catId = categoryIdOf(exp.category);
  return {
    ...exp,
    title: tr.title || exp.title,
    short: tr.short || exp.short,
    time: tr.time || exp.time,
    description: tr.description || exp.description,
    question: tr.question || exp.question,
    steps: Array.isArray(tr.steps) && tr.steps.length === exp.steps.length ? tr.steps : exp.steps,
    explanation: tr.explanation || exp.explanation,
    detail: tr.detail || exp.detail,
    fact: tr.fact || exp.fact,
    sourceLabel: tr.sourceLabel || exp.sourceLabel,
    categoryId: catId,
    categoryLabel: t(`categories.${catId}`),
  };
}
