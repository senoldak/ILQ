const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

function copy(file) {
  fs.copyFileSync(path.join(SRC, file), path.join(DIST, file));
  console.log('copied', file);
}

function copyDir(dir) {
  fs.mkdirSync(path.join(DIST, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, dir))) {
    fs.copyFileSync(path.join(SRC, dir, f), path.join(DIST, dir, f));
  }
  console.log('copied dir', dir);
}

async function main() {
  fs.mkdirSync(DIST, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(SRC, 'offscreen.js')],
    bundle: true,
    outfile: path.join(DIST, 'offscreen.js'),
    platform: 'browser',
    format: 'iife',
    target: ['chrome110'],
    define: {
      'process.env.NODE_ENV': '"production"',
      global: 'globalThis',
    },
    external: ['path', 'fs', 'os', 'crypto', 'util', 'stream', 'net', 'http', 'https', 'url'],
  });
  console.log('bundled offscreen.js');

  await esbuild.build({
    entryPoints: [path.join(SRC, 'popup.js')],
    bundle: true,
    outfile: path.join(DIST, 'popup.js'),
    platform: 'browser',
    format: 'iife',
    target: ['chrome110'],
  });
  console.log('bundled popup.js');

  copy('manifest.json');
  copy('background.js');
  copy('offscreen.html');
  copy('popup.css');
  copy('sidepanel.html');
  copy('sidepanel.css');
  copyDir('fonts');
  console.log('build ok -> dist/');
}

main().catch((e) => { console.error(e); process.exit(1); });