import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + req.url.split('?')[0]);
    if (!path.startsWith(root + '/')) throw Error('path');
    res.setHeader(
      'Content-Type',
      extname(path) === '.js' ? 'text/javascript' : 'text/html'
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();
  await page.goto(
    `http://127.0.0.1:${server.address().port}/tests/rhythm-host.html`
  );
  const results = await page.evaluate(async () => {
    async function fixture(rate, bpm, silent = false) {
      const ctx = new OfflineAudioContext(1, rate * 18, rate);
      await ctx.audioWorklet.addModule('/js/audio/rhythm-worklet.js');
      const buffer = ctx.createBuffer(1, rate * 18, rate),
        data = buffer.getChannelData(0);
      const expected = [];
      if (!silent)
        for (let t = 0.5; t < 16; t += 60 / bpm) {
          expected.push(t);
          for (let i = 0; i < rate * 0.16; i++) {
            const x = i / rate;
            data[Math.round(t * rate) + i] +=
              0.8 *
              Math.sin(2 * Math.PI * (65 * x + 5 * (1 - Math.exp(-x * 35)))) *
              Math.exp(-x * 32);
          }
        }
      const node = new AudioWorkletNode(ctx, 'phosphor-rhythm'),
        src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(node);
      node.connect(ctx.destination);
      const events = [],
        features = [];
      node.port.onmessage = ({ data }) => {
        if (data.type === 'features') {
          features.push(data);
          if (data.kick) events.push(data.time);
        }
      };
      src.start();
      await ctx.startRendering();
      // Flush queued port messages with a round trip, rather than a timed pause.
      await new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = resolve;
        channel.port2.postMessage(0);
      });
      const worker = new Worker('/js/audio/tempo-worker.js', {
        type: 'module',
      });
      const tempo = await new Promise((resolve, reject) => {
        worker.onerror = (e) => reject(Error(e.message));
        worker.onmessage = ({ data: message }) => {
          if (message.type === 'error') reject(Error(message.message));
          if (message.type === 'tempo') resolve(message);
          if (message.type === 'ready')
            worker.postMessage({
              type: 'samples',
              samples: data,
              rate,
              end: 18,
            });
        };
      });
      worker.terminate();
      node.port.close();
      const matched = expected.filter((t) =>
        events.some((e) => e >= t && e - t < 0.08)
      ).length;
      return {
        rate,
        bpm,
        silent,
        expected: expected.length,
        detected: events.length,
        matched,
        falseInBreak: events.filter((t) => t > 16.2).length,
        tempo,
      };
    }
    async function pitchFixture(rate, hz) {
      const worker = new Worker('/js/audio/tempo-worker.js', {
        type: 'module',
      });
      const signal = new Float32Array(Math.round(rate * 0.2));
      let seed = 7;
      for (let i = 0; i < signal.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        signal[i] = hz
          ? 0.3 * Math.sin((2 * Math.PI * hz * i) / rate)
          : (seed / 4294967296 - 0.5) * 0.3;
      }
      const result = await new Promise((resolve, reject) => {
        worker.onerror = (error) => reject(Error(error.message));
        worker.onmessage = ({ data }) => {
          if (data.type === 'ready')
            worker.postMessage({
              type: 'samples',
              samples: signal,
              rate,
              end: 0.2,
            });
          if (data.type === 'pitch') resolve(data);
        };
      });
      worker.terminate();
      return { rate, expected: hz, ...result };
    }
    return {
      rhythm: [
        await fixture(44100, 120),
        await fixture(48000, 128),
        await fixture(48000, 120, true),
      ],
      pitch: [
        await pitchFixture(44100, 440),
        await pitchFixture(48000, 523.251),
        await pitchFixture(48000, 0),
      ],
    };
  });
  for (const result of results.rhythm) {
    console.log(JSON.stringify(result));
    if (result.silent) {
      assert.equal(result.detected, 0);
      assert.equal(result.tempo.bpm, 0);
    } else {
      assert.ok(
        result.matched >= result.expected * 0.95,
        'kick recall within 80 ms'
      );
      assert.ok(result.detected <= result.expected * 1.05, 'no doubled kicks');
      assert.equal(result.falseInBreak, 0);
      assert.ok(
        Math.abs(result.tempo.bpm - result.bpm) < 2,
        'tempo at capture sample rate'
      );
    }
  }
  for (const pitch of results.pitch) {
    console.log(JSON.stringify(pitch));
    if (pitch.expected) {
      assert.ok(
        Math.abs(pitch.hz - pitch.expected) < 2,
        'pitch in Hz at both capture rates'
      );
      assert.ok(pitch.confidence >= 0.85, 'clear tone accepted');
    } else assert.ok(pitch.confidence < 0.85, 'noise rejected');
  }
  console.log('Rhythm and pitch fixtures passed');
} finally {
  await browser?.close();
  server.close();
}
