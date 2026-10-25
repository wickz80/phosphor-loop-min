import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0])
    );
    if (!path.startsWith(root + '/')) throw Error('path');
    res.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
      }[extname(path)] || 'application/octet-stream'
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
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  for (const mode of ['retired-scenes', 'normal']) {
    const page = await browser.newPage({
      serviceWorkers: 'block',
      viewport: { width: 600, height: 650 },
    });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() =>
      localStorage.setItem(
        'phosphor-min-last-v1',
        JSON.stringify({
          look: { A: { in1: 'cameraSphere' }, B: { in1: 'cameraCube' } },
        })
      )
    );
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    const frames = (n) =>
      page.evaluate(
        (n) =>
          new Promise((resolve) => {
            let i = 0;
            function tick() {
              if (++i >= n) resolve();
              else requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          }),
        n
      );
    await frames(10);
    await page.locator('#pictureSharpness').selectOption('standard');
    assert.equal(
      await page.locator('#sceneSelect option[value="cameraSphere"]').count(),
      0
    );
    assert.equal(await page.locator('#cameraStyle').count(), 0);
    assert.equal(
      await page.locator('#sceneSelect').inputValue(),
      'mercury',
      'saved retired scene falls back'
    );
    if (mode === 'normal') {
      for (const scene of [
        'sponge',
        'mandelbulb',
        'mandelbox',
        'sierpinski',
        'julia3d',
        'kaleido',
      ]) {
        await page.locator('#sceneSelect').selectOption(scene);
        await frames(5);
        assert.equal(await page.locator('#sceneSelect').inputValue(), scene);
      }
    }
    await page.locator('#freeze').click();
    assert.equal(
      await page.locator('#freeze').getAttribute('aria-pressed'),
      'true'
    );
    await page.locator('#freeze').click();
    await frames(3);
    const visible = await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => {
            const source = document.querySelector('#screen'),
              copy = document.createElement('canvas');
            copy.width = source.width;
            copy.height = source.height;
            const ctx = copy.getContext('2d');
            ctx.drawImage(source, 0, 0);
            resolve(
              ctx
                .getImageData(0, 0, copy.width, copy.height)
                .data.some((value, i) => i % 4 !== 3 && value > 25)
            );
          })
        )
    );
    assert.ok(visible, 'rendered image is not black: ' + mode);
    assert.deepEqual(errors, [], 'no render-loop exceptions: ' + mode);
    console.log(
      'PASS: ' + mode + '; saved look loads, frames continue, controls respond.'
    );
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
