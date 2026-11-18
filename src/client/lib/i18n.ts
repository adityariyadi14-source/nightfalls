import { getPrefs } from './prefs';
import { ID } from './i18n-id';

export type Lang = 'en' | 'id';
type Params = Record<string, string | number | undefined | null>;

const fill = (tpl: string, params: Params, tr: (s: string) => string) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? tr(v) : String(v);
  });

// Templates with {placeholders} become regexes so already-filled English sentences
// ("Ava was found dead in the kitchen.") can be translated after the fact.
interface Pattern { re: RegExp; keys: string[]; tpl: string }
let patterns: Pattern[] | null = null;
function getPatterns(): Pattern[] {
  if (patterns) return patterns;
  patterns = Object.keys(ID)
    .filter((k) => /\{\w+\}/.test(k))
    .map((k) => {
      const parts = k.split(/\{(\w+)\}/);
      const keys: string[] = [];
      let src = '';
      parts.forEach((part, i) => {
        if (i % 2 === 1) {
          keys.push(part);
          src += '(.+?)';
        } else src += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
      return { re: new RegExp(`^${src}$`, 's'), keys, tpl: k };
    })
    // most specific (longest literal text) first
    .sort((a, b) => b.tpl.replace(/\{\w+\}/g, '').length - a.tpl.replace(/\{\w+\}/g, '').length);
  return patterns;
}

const cache = new Map<string, string>();

function translateExact(s: string): string | undefined {
  return ID[s];
}

/** Translate a phrase into the current language. Unknown phrases fall back to English. */
export function t(text: string, params?: Params): string {
  if (text == null) return text;
  const lang = getPrefs().lang;
  if (lang !== 'id') return params ? fill(text, params, (x) => x) : text;
  const sub = (x: string) => translateExact(x) ?? x;
  if (params) return fill(ID[text] ?? text, params, sub);
  const exact = translateExact(text);
  if (exact !== undefined) return exact;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  let out = text;
  for (const p of getPatterns()) {
    const m = p.re.exec(text);
    if (m) {
      const ps: Params = {};
      p.keys.forEach((k, i) => (ps[k] = m[i + 1]));
      out = fill(ID[p.tpl], ps, (x) => t(x));
      break;
    }
  }
  if (cache.size > 2000) cache.clear();
  cache.set(text, out);
  return out;
}

export const currentLang = () => getPrefs().lang;
