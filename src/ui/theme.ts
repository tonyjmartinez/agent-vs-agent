/** Palette tokens (PLAN 3.2). Mirrored as CSS variables in styles.css. */
export const theme = {
  paper: '#F6EEDC',
  board: '#EADBC0',
  tileA: '#F3E6CC',
  tileB: '#E6D3B1',
  ink: '#2B2A33',
  red: '#E4572E',
  teal: '#17A6A3',
  mustard: '#F2B84B',
  plum: '#6C4E8C',
  olive: '#7A8B3C',
  danger: '#C0392B',
} as const;

export type ThemeKey = keyof typeof theme;

export const hex = (c: string): number => parseInt(c.slice(1), 16);

/** Colour per player index. */
export const playerColors = [theme.red, theme.teal, theme.plum, theme.olive] as const;
export const playerNames = ['Red', 'Teal', 'Plum', 'Olive'] as const;
