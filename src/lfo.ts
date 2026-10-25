interface LfoUIOptions {
  root: HTMLElement;
  getScope: (slider: HTMLInputElement) => ControlScope;
  getBeat: () => number | null;
  isFrozen: () => boolean;
  setValue: (
    slider: HTMLInputElement,
    value: number,
    scope: ControlScope
  ) => unknown;
  fillTrack: (slider: HTMLInputElement) => void;
  onEnable?: (slider: HTMLInputElement) => void;
  isAvailable?: (slider: HTMLInputElement, scope: ControlScope) => boolean;
  onReset?: (slider: HTMLInputElement) => void;
}
interface LfoUIEntry {
  id: string;
  el: HTMLInputElement;
  limits: Required<LfoLimits>;
  box: HTMLDivElement;
  check: HTMLInputElement;
  fields: HTMLDivElement;
  x: HTMLButtonElement;
  y: HTMLButtonElement;
  beats: HTMLSelectElement;
  curve: HTMLSelectElement;
  bounds: HTMLDivElement;
  status: HTMLSpanElement;
  output: HTMLOutputElement | null | undefined;
}
interface ScopedLfoUIEntry extends LfoUIEntry {
  scope: ControlScope;
}
interface LfoUI {
  refresh(): void;
  engine: LfoEngine;
  disableWhere(predicate: (key: string) => boolean): void;
  tick(): void;
}
interface LfoUIApi extends LfoEngineApi {
  createUI(options: LfoUIOptions): LfoUI;
}
const PhosphorLFO = ((): LfoUIApi => {
  const { BEATS, CURVES, sanitize, valueAt, createEngine } =
    window.PhosphorLFOEngine;
  function createUI({
    root,
    getScope,
    getBeat,
    isFrozen,
    setValue,
    fillTrack,
    onEnable = (): void => {},
    isAvailable = (el): boolean => !el.disabled,
    onReset = (): void => {},
  }: LfoUIOptions): LfoUI {
    const doc = root.ownerDocument,
      storageKey = 'phosphor-min-lfo-v1';
    let saved: unknown = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      // This failure is non-fatal; retain the current state.
    }
    const bindings: Record<string, LfoConfig> = {};
    const entries = new Map<string, LfoUIEntry>();
    const resolve = (key: string): ScopedLfoUIEntry | null => {
      const [scope, id] = key.split(':');
      const entry = entries.get(id);
      return entry && (scope === 'global' || scope === 'A' || scope === 'B')
        ? { ...entry, scope }
        : null;
    };
    const engine = createEngine({
      bindings,
      resolve,
      apply: (entry, value): void => {
        if (!isAvailable(entry.el, entry.scope)) return;
        setValue(entry.el, value, entry.scope);
        if (entry.scope === 'global' || entry.scope === getScope(entry.el)) {
          entry.el.value = String(value);
          fillTrack(entry.el);
          if (entry.output)
            entry.output.value = String(Math.round(value * 100) / 100);
        }
      },
    });
    const save = (): void => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(bindings));
      } catch {
        // This failure is non-fatal; retain the current state.
      }
    };
    function refresh(): void {
      for (const entry of entries.values()) {
        const scope = getScope(entry.el),
          key = scope + ':' + entry.id;
        const config = sanitize(bindings[key], entry.limits);
        const active = config.enabled;
        entry.check.checked = active;
        entry.fields.hidden = !active;
        entry.box.classList.toggle('lfo-active', active);
        if (entry.box.classList.contains('slider-lfo-menu'))
          entry.box.hidden = !active;
        entry.check
          .closest('.slider-actions')
          ?.classList.toggle('lfo-active', active);
        entry.el.classList.toggle('lfo-active-slider', active);
        entry.beats.value = String(config.beats);
        entry.curve.value = config.curve;
        entry.bounds.hidden = !active;
        for (const endpoint of ['x', 'y'] as const) {
          const button = entry[endpoint],
            value = config[endpoint];
          const fraction =
            (value - entry.limits.min) /
            (entry.limits.max - entry.limits.min || 1);
          button.style.left = `calc(8px + (100% - 16px) * ${fraction})`;
          button.setAttribute('aria-valuenow', String(value));
          button.title = `${
            endpoint === 'x' ? 'From' : 'To'
          }: ${value}. Drag or use arrow keys.`;
          button.firstElementChild!.textContent = String(
            Math.round(value * 100) / 100
          );
        }
      }
    }
    const actions = PhosphorLFOState.createActions(
      engine,
      (key): void => {
        const entry = entries.get(key.split(':')[1]);
        if (entry) onEnable(entry.el);
      },
      (): void => {
        save();
        refresh();
      }
    );
    for (const [index, el] of [
      ...root.querySelectorAll<HTMLInputElement>(
        '.minimal-section input[type="range"]'
      ),
    ].entries()) {
      const route = el.closest<HTMLElement>('[data-music-route]');
      const id =
        el.id ||
        (route ? 'music-route-' + route.dataset.musicRoute : 'slider-' + index);
      const limits = {
        min: Number(el.min || 0),
        max: Number(el.max || 100),
        step: el.step === 'any' ? 0.01 : Number(el.step || 1),
      };
      const label = doc.querySelector(`label[for="${el.id}"]`);
      const name =
        label?.textContent?.trim() || el.getAttribute('aria-label') || id;
      const box = doc.createElement('div');
      box.className = 'lfo-control';
      const toggle = doc.createElement('label');
      toggle.className = 'lfo-toggle';
      const check = doc.createElement('input');
      check.type = 'checkbox';
      check.setAttribute('aria-label', name + ' LFO');
      toggle.append(check, 'LFO');
      box.appendChild(toggle);
      const fields = doc.createElement('div');
      fields.className = 'lfo-fields';
      fields.hidden = true;
      const beatLabel = doc.createElement('label');
      beatLabel.textContent = 'N';
      beatLabel.title = 'Full cycle in beats';
      const beats = doc.createElement('select');
      beats.setAttribute('aria-label', name + ' LFO beats');
      for (const count of BEATS) {
        const option = doc.createElement('option');
        option.value = String(count);
        option.textContent =
          count < 1 ? '1/' + Math.round(1 / count) : String(count);
        beats.appendChild(option);
      }
      beatLabel.appendChild(beats);
      fields.appendChild(beatLabel);
      const curve = doc.createElement('select');
      curve.setAttribute('aria-label', name + ' LFO curve');
      curve.title = 'Modulation curve';
      curve.className = 'lfo-curve';
      for (const [value, label] of Object.entries(CURVES)) {
        const option = doc.createElement('option');
        option.value = value;
        option.textContent = label;
        curve.appendChild(option);
      }
      const curveLabel = doc.createElement('label');
      curveLabel.textContent = 'Scaling';
      curveLabel.title = 'Shape of the X to Y to X motion';
      curveLabel.appendChild(curve);
      fields.appendChild(curveLabel);
      const status = doc.createElement('span');
      status.className = 'lfo-status';
      fields.appendChild(status);
      box.appendChild(fields);
      const reset = doc.createElement('button');
      reset.type = 'button';
      reset.className = 'mini-reset slider-reset';
      reset.textContent = '↺';
      reset.setAttribute('aria-label', 'Reset ' + name);
      reset.title = 'Reset';
      reset.addEventListener('click', (): void => {
        actions.reset(getScope(el) + ':' + id, (): void => onReset(el));
      });
      box.appendChild(reset);
      const anchor = el.closest('.music-strength, .vcr-time') || el;
      anchor.insertAdjacentElement('beforebegin', box);
      // Preserve existing controls and handlers while grouping slider actions.
      {
        let control = el.closest<HTMLElement>('.ctl'),
          head = control?.querySelector<HTMLElement>('.ctl-head');
        if (!head) {
          control = doc.createElement('div');
          control.className = 'ctl';
          box.insertAdjacentElement('beforebegin', control);
          control.append(box, anchor);
          head = doc.createElement('div');
          head.className = 'ctl-head';
          const title = doc.createElement('label');
          title.htmlFor = el.id;
          title.textContent = name;
          head.appendChild(title);
          control.prepend(head);
        }
        if (head) {
          control?.classList.add('slider-controls');
          toggle.lastChild?.remove();
          toggle.title = 'LFO';
          check.title = 'LFO';
          const resetGlyph = doc.createElement('span');
          resetGlyph.className = 'slider-action-glyph';
          resetGlyph.setAttribute('aria-hidden', 'true');
          resetGlyph.textContent = reset.textContent;
          reset.replaceChildren(resetGlyph);
          const actions = doc.createElement('div');
          actions.className = 'slider-actions';
          let output = head.querySelector('output');
          if (!output) {
            output = doc.createElement('output');
            output.htmlFor = el.id;
            output.value = el.value;
          }
          head.appendChild(actions);
          actions.append(reset, toggle);
          if (output) actions.appendChild(output);
          // Keep compact readouts aligned; retain the exact value on hover.
          const compactOutput = (): void => {
            const value = Number(el.value);
            const text = PhosphorLFOState.formatReadout(value);
            output.title = String(value);
            output.setAttribute('aria-label', name + ': ' + value);
            if (output.textContent !== text) output.textContent = text;
          };
          new MutationObserver(compactOutput).observe(output, {
            childList: true,
            characterData: true,
            subtree: true,
          });
          el.addEventListener('input', compactOutput);
          compactOutput();
          box.classList.add('slider-lfo-menu');
        }
      }
      const slider = doc.createElement('div');
      slider.className = 'lfo-slider';
      el.insertAdjacentElement('beforebegin', slider);
      slider.appendChild(el);
      const bounds = doc.createElement('div');
      bounds.className = 'lfo-bounds';
      bounds.hidden = true;
      slider.appendChild(bounds);
      const makeBound = (endpoint: 'x' | 'y'): HTMLButtonElement => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'lfo-bound lfo-bound-' + endpoint;
        button.setAttribute('role', 'slider');
        button.setAttribute(
          'aria-label',
          name + ' LFO ' + (endpoint === 'x' ? 'From' : 'To')
        );
        button.setAttribute('aria-valuemin', String(limits.min));
        button.setAttribute('aria-valuemax', String(limits.max));
        const valueLabel = doc.createElement('span');
        button.appendChild(valueLabel);
        bounds.appendChild(button);
        const update = (value: number): void => {
          const key = getScope(el) + ':' + id,
            config = sanitize(bindings[key], limits);
          const snapped =
            limits.min +
            Math.round((value - limits.min) / limits.step) * limits.step;
          engine.set(key, {
            ...config,
            [endpoint]: Math.max(limits.min, Math.min(limits.max, snapped)),
          });
          refresh();
        };
        let pointer: number | null = null;
        const move = (event: PointerEvent): void => {
          const rect = el.getBoundingClientRect();
          const fraction = Math.max(
            0,
            Math.min(
              1,
              (event.clientX - rect.left - 8) / Math.max(1, rect.width - 16)
            )
          );
          update(limits.min + fraction * (limits.max - limits.min));
        };
        button.addEventListener('pointerdown', (event): void => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          pointer = event.pointerId;
          button.setPointerCapture(pointer);
          button.focus();
          move(event);
        });
        button.addEventListener('pointermove', (event): void => {
          if (event.pointerId === pointer) move(event);
        });
        const finish = (event: PointerEvent): void => {
          if (event.pointerId !== pointer) return;
          pointer = null;
          save();
        };
        button.addEventListener('pointerup', finish);
        button.addEventListener('pointercancel', finish);
        button.addEventListener('keydown', (event): void => {
          const direction: Record<string, number> = {
            ArrowLeft: -1,
            ArrowDown: -1,
            ArrowRight: 1,
            ArrowUp: 1,
          };
          if (!(event.key in direction) && !['Home', 'End'].includes(event.key))
            return;
          event.preventDefault();
          event.stopPropagation();
          const config = sanitize(bindings[getScope(el) + ':' + id], limits);
          update(
            event.key === 'Home'
              ? limits.min
              : event.key === 'End'
              ? limits.max
              : config[endpoint] +
                direction[event.key] * limits.step * (event.shiftKey ? 10 : 1)
          );
          save();
        });
        return button;
      };
      const x = makeBound('x'),
        y = makeBound('y');
      const output =
        route?.querySelector('output') ||
        el.closest('.ctl')?.querySelector('output');
      const entry: LfoUIEntry = {
        id,
        el,
        limits,
        box,
        check,
        fields,
        x,
        y,
        beats,
        curve,
        bounds,
        status,
        output,
      };
      entries.set(id, entry);
      const commit = (): void => {
        const key = getScope(el) + ':' + id;
        const previous = sanitize(bindings[key], limits);
        actions.commit(key, {
          ...previous,
          enabled: check.checked,
          beats: Number(beats.value),
          curve: curve.value,
        });
      };
      // A manual gesture takes control before the app's normal slider handler runs.
      // Otherwise an enabled LFO overwrites the drag on the next animation frame.
      const release = (): void => actions.release(getScope(el) + ':' + id);
      el.addEventListener('pointerdown', release);
      el.addEventListener('keydown', (event): void => {
        if (
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
            'PageUp',
            'PageDown',
          ].includes(event.key)
        )
          release();
      });
      check.addEventListener('change', commit);
      for (const field of [beats, curve])
        field.addEventListener('change', commit);
    }
    Object.assign(
      bindings,
      PhosphorLFOState.restore(
        saved,
        (id): LfoLimits | null => entries.get(id)?.limits ?? null
      )
    );
    refresh();
    return {
      refresh,
      engine,
      disableWhere(predicate: (key: string) => boolean): void {
        for (const [key, config] of Object.entries(bindings))
          if (predicate(key) && config?.enabled)
            bindings[key] = { ...config, enabled: false };
        save();
        refresh();
      },
      tick(): void {
        const beat = getBeat();
        engine.tick(beat, isFrozen());
        for (const entry of entries.values())
          if (entry.check.checked) {
            const status = entry.el.disabled
              ? 'Slider inactive'
              : isFrozen()
              ? 'Paused'
              : Number.isFinite(beat)
              ? 'BPM synced · X → Y → X'
              : 'Waiting for BPM';
            if (entry.status.textContent !== status) {
              entry.status.textContent = status;
              entry.box.title = status;
            }
          }
      },
    };
  }
  return { BEATS, CURVES, sanitize, valueAt, createEngine, createUI };
})();

window.PhosphorLFO = PhosphorLFO;
