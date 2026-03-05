/**
 * build.js — generuje bundle.html: jeden samodzielny plik HTML
 * działający bezpośrednio z dysku (file://) bez potrzeby serwera.
 *
 * Uruchom: node build.js
 */

const fs = require('fs');

const html  = fs.readFileSync('index.html',  'utf8');
const css   = fs.readFileSync('style.css',   'utf8');
const js    = fs.readFileSync('app.js',      'utf8');
const words = fs.readFileSync('words.json',  'utf8');

// Podmieniamy loadWords() tak, by zwracała wbudowane dane zamiast fetchować plik
const patchedJs = js.replace(
  /async function loadWords\(\) \{[\s\S]*?\n\}/,
  `async function loadWords() {\n  return ${words};\n}`
);

// Wbudowujemy CSS i JS do HTML
let bundle = html;
bundle = bundle.replace(
  '<link rel="stylesheet" href="style.css">',
  `<style>\n${css}\n</style>`
);
bundle = bundle.replace(
  '<script src="app.js"></script>',
  `<script>\n${patchedJs}\n</script>`
);

fs.writeFileSync('bundle.html', bundle, 'utf8');
console.log('✓ bundle.html wygenerowany! Rozmiar:', Math.round(fs.statSync('bundle.html').size / 1024), 'KB');
console.log('  → Wyślij plik bundle.html komukolwiek — działa podwójnym klikiem.');
