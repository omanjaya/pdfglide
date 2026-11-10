/**
 * Colour tones for tool pages. Class names are written out in full so Tailwind
 * keeps them. Pick a tone with `<ToolLayout tone="green">`; legacy pages that pass
 * `color="bg-gradient-to-br from-orange-500 to-red-500"` get their tone derived from it.
 */
export type ToolTone =
  | 'blue'
  | 'green'
  | 'emerald'
  | 'red'
  | 'orange'
  | 'amber'
  | 'purple'
  | 'cyan'
  | 'pink'
  | 'indigo'
  | 'teal';

export interface ToolTheme {
  /** Page background gradient */
  page: string;
  /** Header icon tile (gradient) */
  icon: string;
  /** Soft tinted surface (tiles, selected file card) */
  soft: string;
  /** Slightly stronger tinted surface (icon circles) */
  softStrong: string;
  /** Accent text on white / soft surfaces (AA) */
  text: string;
  /** Border accent (selected option, hover on drop zone) */
  border: string;
  hoverBorder: string;
  /** Drop zone while dragging */
  dragActive: string;
  /** Solid primary button (white text, AA) */
  solid: string;
  /** Focus ring colour */
  ring: string;
}

export const TOOL_THEMES: Record<ToolTone, ToolTheme> = {
  blue: {
    page: 'from-blue-50 via-white to-indigo-50',
    icon: 'from-blue-500 to-indigo-600',
    soft: 'bg-blue-50',
    softStrong: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-500',
    hoverBorder: 'hover:border-blue-400',
    dragActive: 'border-blue-500 bg-blue-50',
    solid: 'bg-blue-700 hover:bg-blue-800 text-white',
    ring: 'focus-visible:ring-blue-600',
  },
  green: {
    page: 'from-green-50 via-white to-emerald-50',
    icon: 'from-green-500 to-emerald-600',
    soft: 'bg-green-50',
    softStrong: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-500',
    hoverBorder: 'hover:border-green-400',
    dragActive: 'border-green-500 bg-green-50',
    solid: 'bg-green-700 hover:bg-green-800 text-white',
    ring: 'focus-visible:ring-green-600',
  },
  emerald: {
    page: 'from-emerald-50 via-white to-teal-50',
    icon: 'from-emerald-500 to-teal-600',
    soft: 'bg-emerald-50',
    softStrong: 'bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-500',
    hoverBorder: 'hover:border-emerald-400',
    dragActive: 'border-emerald-500 bg-emerald-50',
    solid: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    ring: 'focus-visible:ring-emerald-600',
  },
  red: {
    page: 'from-red-50 via-white to-orange-50',
    icon: 'from-red-500 to-rose-600',
    soft: 'bg-red-50',
    softStrong: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-500',
    hoverBorder: 'hover:border-red-400',
    dragActive: 'border-red-500 bg-red-50',
    solid: 'bg-red-700 hover:bg-red-800 text-white',
    ring: 'focus-visible:ring-red-600',
  },
  orange: {
    page: 'from-orange-50 via-white to-amber-50',
    icon: 'from-orange-500 to-red-500',
    soft: 'bg-orange-50',
    softStrong: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-500',
    hoverBorder: 'hover:border-orange-400',
    dragActive: 'border-orange-500 bg-orange-50',
    solid: 'bg-orange-700 hover:bg-orange-800 text-white',
    ring: 'focus-visible:ring-orange-600',
  },
  amber: {
    page: 'from-amber-50 via-white to-yellow-50',
    icon: 'from-amber-500 to-orange-500',
    soft: 'bg-amber-50',
    softStrong: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-500',
    hoverBorder: 'hover:border-amber-400',
    dragActive: 'border-amber-500 bg-amber-50',
    solid: 'bg-amber-700 hover:bg-amber-800 text-white',
    ring: 'focus-visible:ring-amber-600',
  },
  purple: {
    page: 'from-purple-50 via-white to-pink-50',
    icon: 'from-purple-500 to-pink-600',
    soft: 'bg-purple-50',
    softStrong: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-500',
    hoverBorder: 'hover:border-purple-400',
    dragActive: 'border-purple-500 bg-purple-50',
    solid: 'bg-purple-700 hover:bg-purple-800 text-white',
    ring: 'focus-visible:ring-purple-600',
  },
  cyan: {
    page: 'from-cyan-50 via-white to-sky-50',
    icon: 'from-cyan-500 to-blue-500',
    soft: 'bg-cyan-50',
    softStrong: 'bg-cyan-100',
    text: 'text-cyan-800',
    border: 'border-cyan-500',
    hoverBorder: 'hover:border-cyan-400',
    dragActive: 'border-cyan-500 bg-cyan-50',
    solid: 'bg-cyan-700 hover:bg-cyan-800 text-white',
    ring: 'focus-visible:ring-cyan-600',
  },
  pink: {
    page: 'from-pink-50 via-white to-rose-50',
    icon: 'from-pink-500 to-rose-600',
    soft: 'bg-pink-50',
    softStrong: 'bg-pink-100',
    text: 'text-pink-700',
    border: 'border-pink-500',
    hoverBorder: 'hover:border-pink-400',
    dragActive: 'border-pink-500 bg-pink-50',
    solid: 'bg-pink-700 hover:bg-pink-800 text-white',
    ring: 'focus-visible:ring-pink-600',
  },
  indigo: {
    page: 'from-indigo-50 via-white to-violet-50',
    icon: 'from-indigo-500 to-violet-600',
    soft: 'bg-indigo-50',
    softStrong: 'bg-indigo-100',
    text: 'text-indigo-700',
    border: 'border-indigo-500',
    hoverBorder: 'hover:border-indigo-400',
    dragActive: 'border-indigo-500 bg-indigo-50',
    solid: 'bg-indigo-700 hover:bg-indigo-800 text-white',
    ring: 'focus-visible:ring-indigo-600',
  },
  teal: {
    page: 'from-teal-50 via-white to-cyan-50',
    icon: 'from-teal-500 to-cyan-600',
    soft: 'bg-teal-50',
    softStrong: 'bg-teal-100',
    text: 'text-teal-700',
    border: 'border-teal-500',
    hoverBorder: 'hover:border-teal-400',
    dragActive: 'border-teal-500 bg-teal-50',
    solid: 'bg-teal-700 hover:bg-teal-800 text-white',
    ring: 'focus-visible:ring-teal-600',
  },
};

const ALIASES: Record<string, ToolTone> = {
  sky: 'cyan',
  rose: 'red',
  yellow: 'amber',
  violet: 'indigo',
  fuchsia: 'pink',
  lime: 'green',
  slate: 'blue',
  gray: 'blue',
};

/** Resolve a tone from an explicit tone name or from a legacy Tailwind colour class string. */
export function resolveTone(tone?: ToolTone, colorClass?: string): ToolTone {
  if (tone && TOOL_THEMES[tone]) return tone;
  const m = colorClass?.match(/(?:from|bg)-([a-z]+)-\d{2,3}/);
  if (m) {
    const name = m[1];
    if (name in TOOL_THEMES) return name as ToolTone;
    if (name in ALIASES) return ALIASES[name];
  }
  return 'blue';
}

export function getTheme(tone?: ToolTone, colorClass?: string): ToolTheme {
  return TOOL_THEMES[resolveTone(tone, colorClass)];
}
