// Builds the server-less "pass & play" edition as ONE self-contained HTML file for claude.ai artifacts.
// Output: artifact/nightfall.html (no <html>/<head>/<body>: the artifact host wraps the page).
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('artifact/.build');
process.env.VITE_ARTIFACT = '1';
await build({ base: './', logLevel: 'warn', build: { outDir, emptyOutDir: true, assetsInlineLimit: 100_000_000, modulePreload: false } });

const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
const jsFile = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/)[1];
const cssFile = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/)[1];
const js = fs.readFileSync(path.join(outDir, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(outDir, cssFile), 'utf8').replace(/<\/style/gi, '<\\/style');

const page = `<title>Nightfall</title>
<meta name="theme-color" content="#060607">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500;700;800&display=swap">
<style>
/* Single deliberate dark look: a surveillance terminal, blood-red signal. */
:root { color-scheme: dark; }
html, body { height: 100%; }
body { background: #060607; color: #e8e2d8; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
fs.mkdirSync('artifact', { recursive: true });
fs.writeFileSync('artifact/nightfall.html', page);
fs.rmSync(outDir, { recursive: true, force: true });
console.log(`artifact/nightfall.html ${(page.length / 1024).toFixed(0)} KB`);
