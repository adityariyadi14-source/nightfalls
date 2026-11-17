// Builds docs/index.html: the offline pass-and-play edition as a standalone page for GitHub Pages.
// GitHub Pages only serves static files, so online rooms (which need the Node server) are hidden.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
execSync('node scripts/build-artifact.mjs', { stdio: 'inherit' });
const page = fs.readFileSync('artifact/nightfall.html', 'utf8');
const split = page.indexOf('<div id="root"></div>');
const head = page.slice(0, split);
const body = page.slice(split);
const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}</head>
<body>
${body}</body>
</html>
`;
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/index.html', html);
console.log(`docs/index.html ${(html.length / 1024).toFixed(0)} KB`);
