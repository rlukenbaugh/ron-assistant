const fs = require('node:fs/promises');
const path = require('node:path');
async function build() {
  await fs.mkdir('dist', { recursive: true }); await fs.mkdir('build', { recursive: true });
  for (const file of ['index.html', 'app.css', 'fonts.css']) await fs.copyFile(path.join('src', file), path.join('dist', file));
  await require('esbuild').build({ entryPoints: ['src/app.js'], bundle: true, outfile: 'dist/app.js', platform: 'browser', target: 'chrome130', format: 'iife', legalComments: 'eof' });
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect x="8" y="8" width="240" height="240" rx="62" fill="#101719"/><rect x="26" y="26" width="204" height="204" rx="48" fill="none" stroke="#456452" stroke-width="3"/><path d="M78 185V70h49c33 0 49 12 49 36 0 18-10 30-29 35l35 44h-31l-32-41H103v41Zm25-62h22c18 0 26-5 26-17 0-11-8-16-26-16h-22Z" fill="#b3dac2"/><circle cx="190" cy="187" r="10" fill="#d8b778"/></svg>');
  const png = await require('sharp')(svg).png().toBuffer();
  await fs.writeFile('build/icon.png', png);
  const pngToIco = (await import('png-to-ico')).default;
  await fs.writeFile('build/icon.ico', await pngToIco(png));
  console.log('Built the desktop interface and Windows application icon.');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
