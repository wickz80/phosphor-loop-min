import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const runtimeFiles = [
  'index.html',
  'sw.js',
  'icon-180.png',
  'icon-192.png',
  'styles',
  'js',
  'vendor',
];
export async function packageSite(destination, { revision } = {}) {
  const root = fileURLToPath(new URL('../../', import.meta.url)),
    out = resolve(destination);
  const distance = relative(root, out);
  if (!(distance.startsWith('..' + sep) || isAbsolute(distance)))
    throw Error('Use an empty output directory outside the repository.');
  await mkdir(out, { recursive: true });
  if ((await readdir(out)).length)
    throw Error('Output directory must be empty.');
  for (const name of runtimeFiles)
    await cp(resolve(root, name), resolve(out, name), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  if (revision) {
    if (!/^[a-f0-9]{7,40}$/.test(revision))
      throw Error('Revision must be a Git commit SHA.');
    const index = resolve(out, 'index.html'),
      sw = resolve(out, 'sw.js');
    await writeFile(
      index,
      (
        await readFile(index, 'utf8')
      ).replace(
        /((?:src|href)="(?:js|styles)\/[^"?]+\?v=)[^"]+/g,
        (_, prefix) => prefix + revision
      )
    );
    await writeFile(
      sw,
      (
        await readFile(sw, 'utf8')
      ).replace(
        /const CACHE = CACHE_PREFIX \+ '[^']+';/,
        `const CACHE = CACHE_PREFIX + 'app-${revision}';`
      )
    );
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2])
    throw Error('Usage: node tools/deploy/package.mjs /empty/output/directory');
  console.log(
    await packageSite(process.argv[2], { revision: process.argv[3] })
  );
}
