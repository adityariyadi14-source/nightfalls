export interface Theme {
  id: string;
  name: string;
  description: string;
  vars: Record<string, string>;
}

/** Each "map" is a terminal colour profile. Accent = signal colour, accent2 = system readouts. */
export const THEMES: Theme[] = [
  {
    id: 'blood',
    name: 'Bloodline',
    description: 'Blood-red signal on a dead screen.',
    vars: { '--c-accent': '222 28 48', '--c-accent2': '120 236 150', '--c-danger': '255 52 70', '--c-line': '64 46 48', '--fog': '120 10 20' }
  },
  {
    id: 'mainframe',
    name: 'Mainframe',
    description: 'Green phosphor. Old-school intrusion.',
    vars: { '--c-accent': '72 240 120', '--c-accent2': '190 255 210', '--c-danger': '255 64 64', '--c-line': '38 66 46', '--fog': '10 70 30' }
  },
  {
    id: 'amber',
    name: 'Amber Archive',
    description: 'Warm amber CRT in a police basement.',
    vars: { '--c-accent': '255 166 32', '--c-accent2': '255 222 150', '--c-danger': '255 70 50', '--c-line': '72 54 30', '--fog': '90 45 0' }
  },
  {
    id: 'cold',
    name: 'Cold Storage',
    description: 'Ice-blue morgue monitors.',
    vars: { '--c-accent': '86 196 255', '--c-accent2': '200 240 255', '--c-danger': '255 70 90', '--c-line': '36 54 72', '--fog': '10 40 80' }
  },
  {
    id: 'bone',
    name: 'Bone & Ink',
    description: 'Stark white type, red only for death.',
    vars: { '--c-accent': '236 228 214', '--c-accent2': '222 28 48', '--c-danger': '230 30 50', '--c-line': '70 66 62', '--fog': '50 40 40' }
  }
];

export const DEFAULT_THEME = 'blood';

export function themeById(id: string) {
  return THEMES.find((x) => x.id === id) ?? THEMES[0];
}

export function applyTheme(id: string) {
  const root = document.documentElement;
  Object.entries(themeById(id).vars).forEach(([k, v]) => root.style.setProperty(k, v));
}
