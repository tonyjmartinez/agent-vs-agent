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

export const hex = (css: string): number => parseInt(css.slice(1), 16);
