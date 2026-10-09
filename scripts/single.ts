/**
 * Builds a self-contained single HTML file (JS, CSS, fonts and the AI worker inlined) at
 * dist-single/agent-vs-agent.html, for sharing a playable build without hosting.
 *   npx tsx scripts/single.ts
 */
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = 'dist-single';
await build({
  logLevel: 'warn',
  build: {
    outDir: out,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { codeSplitting: false } as never },
  },
});
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
html = html.replace(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/,
  (_m, f: string) => {
    const js = fs.readFileSync(path.join(out, f), 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script type="module">${js}</script>`;
  },
);
html = html.replace(
  /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/,
  (_m, f: string) => {
    return `<style>${fs.readFileSync(path.join(out, f), 'utf8')}</style>`;
  },
);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('un-inlined asset left in HTML');
const file = path.join(out, 'agent-vs-agent.html');
fs.writeFileSync(file, html);
console.log(file, (fs.statSync(file).size / 1024).toFixed(0) + ' KB');

// Artifact variant: the host wraps the page in its own <html>/<head>/<body> skeleton and already
// pads :root by the safe-area insets, so drop our wrapper and use height:100% instead of 100dvh.
const head = /<head>([\s\S]*?)<\/head>/.exec(html)![1]!;
const body = /<body>([\s\S]*?)<\/body>/.exec(html)![1]!;
const keepHead = head
  .split('\n')
  .filter(
    (l) => !/<meta charset|<meta name="viewport"|rel="manifest"|rel="apple-touch-icon"/.test(l),
  )
  .join('\n');
const override = `<style>html,body{height:100%}body{height:100%;background:#F6EEDC}#app{height:100%;padding-top:8px;padding-bottom:8px}#app{--board:min(calc(100vw - 32px),calc(100dvh - var(--hud-h) - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)))}</style>`;
const artifact = `${keepHead}\n${override}\n${body}`;
const artifactFile = process.env.ARTIFACT_OUT ?? path.join(out, 'agent-vs-agent.artifact.html');
fs.writeFileSync(artifactFile, artifact);
console.log(artifactFile, (fs.statSync(artifactFile).size / 1024).toFixed(0) + ' KB');
