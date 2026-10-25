import fs from 'node:fs';
import vm from 'node:vm';

const scriptExports = {
  'audio/beat-clock': 'PhosphorBeatClock',
  'control-dependencies': 'PhosphorDependencies',
  'control-routing': 'PhosphorControlRouting',
  'lfo-engine': 'PhosphorLFOEngine',
  'lfo-state': 'PhosphorLFOState',
  lfo: 'PhosphorLFO',
  'video-grade': 'PhosphorVideoGrade',
} as const satisfies Record<string, keyof Window>;
type BrowserScript = keyof typeof scriptExports;
type InstalledExport<Files extends readonly BrowserScript[]> =
  (typeof scriptExports)[Files[number]];

/** Compatibility harness: only claim globals requested and verified at runtime. */
export function loadBrowserScripts<
  const Files extends readonly BrowserScript[]
>(
  files: Files,
  saved: string | null = null
): Pick<Window, InstalledExport<Files>> {
  const context = {
    window: {} as Record<string, unknown>,
    localStorage: { getItem: (): string | null => saved, setItem(): void {} },
  };
  for (const file of files) {
    vm.runInNewContext(
      fs.readFileSync(new URL(`../../js/${file}.js`, import.meta.url), 'utf8'),
      context
    );
    if (context.window[scriptExports[file]] === undefined) {
      throw new Error(`${file} did not install ${scriptExports[file]}`);
    }
  }
  return context.window as Pick<Window, InstalledExport<Files>>;
}
