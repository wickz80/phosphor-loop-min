import fs from 'node:fs';
import vm from 'node:vm';

/** Temporary harness for JavaScript boundaries that have not been extracted yet. */
export function readScript(path: string): string {
  return fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}
export function section(source: string, start: string, end: string): string {
  const first = source.indexOf(start),
    last = source.indexOf(end, first);
  if (first < 0 || last <= first)
    throw new Error(`Missing legacy script boundary: ${start} … ${end}`);
  return source.slice(first, last);
}
export function installScripts(
  context: vm.Context,
  paths: readonly string[]
): void {
  for (const path of paths)
    vm.runInContext(readScript(path), context, { filename: path });
}
