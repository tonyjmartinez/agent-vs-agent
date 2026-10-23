/** localStorage wrapper that never throws (private mode, blocked storage, quota). */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const real = (): KV | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function load(key: string, store: KV | null = real()): string | null {
  try {
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
}

export function save(key: string, value: string, store: KV | null = real()): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* ignore: the app must work without storage */
  }
}

export const KEYS = { lastMode: 'ava.lastMode', coachDone: 'ava.coachDone' } as const;
