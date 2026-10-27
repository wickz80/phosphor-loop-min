import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageSite } from './package.mjs';

describe('Static deployment package', (): void => {
  it('includes browser assets while excluding colocated tests and removed features', async (t): Promise<void> => {
    const parent = await mkdtemp(join(tmpdir(), 'phosphor-package-'));
    t.after(async (): Promise<void> => {
      await rm(parent, { recursive: true, force: true });
    });

    const out = await packageSite(join(parent, 'site'));
    const files = await readdir(out);
    const scripts = await readdir(join(out, 'js'), { recursive: true });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    const vendor = await readFile(
      join(out, 'vendor/essentia/essentia-wasm.es.js')
    );

    assert.deepEqual(
      files.sort(),
      [
        'index.html',
        'sw.js',
        'icon-180.png',
        'icon-192.png',
        'styles',
        'js',
        'vendor',
      ].sort()
    );
    assert.ok(scripts.every((path): boolean => !path.endsWith('.test.ts')));
    assert.doesNotMatch(html, /id="(?:nat|natOpen|natSave|natGrid)"/);
    assert.match(html, /id="pickPic"/);
    assert.ok(vendor.length > 1000);
  });

  it('stamps revisions while preserving relative URLs and module load order', async (t): Promise<void> => {
    const parent = await mkdtemp(join(tmpdir(), 'phosphor-package-'));
    t.after(async (): Promise<void> => {
      await rm(parent, { recursive: true, force: true });
    });

    const out = await packageSite(join(parent, 'site'), {
      revision: 'abcdef1234567',
    });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    const worker = await readFile(join(out, 'js/audio/rhythm.js'), 'utf8');
    const serviceWorker = await readFile(join(out, 'sw.js'), 'utf8');
    const routing = await readFile(join(out, 'js/control-routing.js'), 'utf8');

    for (const script of ['shaders', 'lfo', 'control-routing'])
      assert.ok(html.includes(`js/${script}.js?v=abcdef1234567`));
    assert.doesNotMatch(html, /(?:src|href)="\/(?:js|styles)\//);
    assert.ok(
      html.indexOf('js/video-grade.js') < html.indexOf('js/control-routing.js')
    );
    assert.ok(
      html.indexOf('js/control-routing.js') < html.indexOf('js/app.js')
    );
    assert.ok(html.indexOf('js/lfo-engine.js') < html.indexOf('js/lfo.js'));
    assert.match(serviceWorker, /app-abcdef1234567/);
    assert.match(worker, /new Worker\('js\/audio\/tempo-worker\.js'/);
    assert.match(routing, /Generated from src\/control-routing\.ts/);
  });

  it('refuses nonempty destinations and paths inside the repository', async (t): Promise<void> => {
    const parent = await mkdtemp(join(tmpdir(), 'phosphor-package-'));
    t.after(async (): Promise<void> => {
      await rm(parent, { recursive: true, force: true });
    });
    const occupied = await packageSite(join(parent, 'site'));

    const reuse = (): Promise<string> => packageSite(occupied);
    const insideRepository = (): Promise<string> =>
      packageSite('js/deploy-output');

    await assert.rejects(reuse, /empty/);
    await assert.rejects(insideRepository, /outside/);
  });
});
