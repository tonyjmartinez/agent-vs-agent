declare global {
  interface Window {
    __AVA__?: { ready: Promise<void>; clicks: { r: number; c: number }[] };
  }
}

export function installTestHooks(ready: Promise<void>, clicks: { r: number; c: number }[]): void {
  const enabled = import.meta.env.DEV || new URLSearchParams(location.search).has('test');
  if (enabled) window.__AVA__ = { ready, clicks };
}
