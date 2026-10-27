import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

interface LifecycleEvent {
  waitUntil(work: Promise<void>): void;
}

describe('Offline cache isolation', (): void => {
  it('deletes obsolete caches only within this application scope', async (): Promise<void> => {
    const source = await readFile(new URL('./sw.js', import.meta.url), 'utf8');
    const handlers: Record<string, (event: LifecycleEvent) => void> = {};
    const deleted: string[] = [];
    const names = [
      'gatsby-cache',
      'pl-nature',
      'phosphor-loop:/:app-old',
      'phosphor-loop:/other/:app-old',
      'phosphor-loop:/loop/:app-old',
      'phosphor-loop:/loop/:nature',
    ];
    let work: Promise<void> = Promise.resolve();
    vm.runInNewContext(source, {
      URL,
      setTimeout,
      Request: class {
        url: string;
        constructor(url: string) {
          this.url = new URL(url, 'https://wix.fyi/loop/').href;
        }
      },
      fetch: async (): Promise<{ ok: boolean }> => ({ ok: false }),
      self: {
        registration: { scope: 'https://wix.fyi/loop/' },
        location: { origin: 'https://wix.fyi' },
        clients: { claim: async (): Promise<void> => {} },
        skipWaiting: async (): Promise<void> => {},
        addEventListener: (
          name: string,
          handler: (event: LifecycleEvent) => void
        ): void => {
          handlers[name] = handler;
        },
      },
      caches: {
        open: async (name: string): Promise<{ addAll(): Promise<void> }> => {
          names.push(name);
          return { addAll: async (): Promise<void> => {} };
        },
        keys: async (): Promise<string[]> => names,
        delete: async (name: string): Promise<void> => {
          deleted.push(name);
        },
      },
    });
    const event: LifecycleEvent = {
      waitUntil: (promise): void => {
        work = promise;
      },
    };

    handlers.install(event);
    await work;
    handlers.activate(event);
    await work;

    assert.deepEqual(deleted, [
      'phosphor-loop:/loop/:app-old',
      'phosphor-loop:/loop/:nature',
    ]);
  });
});
