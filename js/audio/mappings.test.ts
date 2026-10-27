import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { installScripts } from '../../tests/support/legacy-scripts.ts';

interface MappingRow {
  source: string;
  effect: string;
  strength: number;
}
interface Envelope {
  beat: number;
  low: number;
  mid: number;
  high: number;
}
interface MusicSample {
  bpmBeat?: number;
  pitch?: { midi: number };
  tonal?: number;
}
interface MappingOutput {
  forward: number;
  shimmer: number;
  color: number;
  hue: number;
}
interface MappingApi {
  defaults(): MappingRow[];
  sanitize(raw: unknown): MappingRow[];
  evaluate(
    rows: MappingRow[],
    envelope: Envelope,
    music: MusicSample | null
  ): MappingOutput;
  effects: Record<string, string>;
}
function createMappings(): MappingApi {
  const context = vm.createContext({ window: {} });
  installScripts(context, ['js/audio/mappings.js']);
  return context.window.PhosphorMappings as MappingApi;
}
const silent: Envelope = { beat: 0, low: 0, mid: 0, high: 0 };

describe('Music mappings', (): void => {
  it('routes the default pulse from BPM rather than detected kick timing', (): void => {
    const mapping = createMappings();
    const routes = mapping.defaults();

    const pulse = mapping.evaluate(
      routes,
      { ...silent, beat: 1 },
      { bpmBeat: 1 }
    );
    const kickWithoutGrid = mapping.evaluate(
      routes,
      { ...silent, beat: 1 },
      { bpmBeat: 0 }
    );
    const gridWithoutKick = mapping.evaluate(routes, silent, { bpmBeat: 1 });

    assert.equal(pulse.forward, 0.85);
    assert.equal(pulse.shimmer, 0);
    assert.equal(pulse.color, 0);
    assert.equal(kickWithoutGrid.forward, 0);
    assert.equal(gridWithoutKick.forward, 0.85);
  });

  it('routes percussion independently of forward motion', (): void => {
    const mapping = createMappings();

    const output = mapping.evaluate(
      mapping.defaults(),
      { ...silent, mid: 1 },
      null
    );

    assert.equal(output.forward, 0);
    assert.equal(output.shimmer, 0.4);
  });

  it('ignores disabled routes and caps stacked responses', (): void => {
    const mapping = createMappings();
    const disabled: MappingRow[] = [
      { source: 'kick', effect: 'none', strength: 100 },
    ];
    const stacked: MappingRow[] = Array.from(
      { length: 3 },
      (): MappingRow => ({ source: 'kick', effect: 'forward', strength: 100 })
    );

    const off = mapping.evaluate(disabled, { ...silent, beat: 1 }, null);
    const capped = mapping.evaluate(stacked, { ...silent, beat: 1 }, null);

    assert.equal(off.forward, 0);
    assert.equal(capped.forward, 1);
  });

  it('uses pitch class for color, consistently across octaves', (): void => {
    const mapping = createMappings();
    const routes = mapping.defaults();

    const lower = mapping.evaluate(routes, silent, {
      pitch: { midi: 69 },
      tonal: 1,
    });
    const octave = mapping.evaluate(routes, silent, {
      pitch: { midi: 81 },
      tonal: 1,
    });
    const otherNote = mapping.evaluate(routes, silent, {
      pitch: { midi: 72 },
      tonal: 1,
    });

    assert.equal(lower.hue, octave.hue);
    assert.notEqual(lower.hue, otherNote.hue);
    assert.equal(lower.color, 0.55);
  });

  it('sanitizes invalid saved routes and retired effects', (): void => {
    const mapping = createMappings();

    const invalid = mapping.sanitize([
      { source: 'invalid', effect: 'invalid', strength: 500 },
    ]);
    const missing = mapping.sanitize(null);
    const retired = mapping.sanitize([
      { source: 'bass', effect: 'surface', strength: 70 },
    ]);

    assert.equal(invalid[0].source, 'bpm');
    assert.equal(invalid[0].effect, 'forward');
    assert.equal(invalid[0].strength, 100);
    assert.equal(missing.length, 3);
    assert.equal(retired[0].effect, 'forward');
    for (const effect of ['travel', 'surface', 'orbit', 'turn45', 'turn90'])
      assert.equal(Object.hasOwn(mapping.effects, effect), false, effect);
  });
});
