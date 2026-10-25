import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('.');
const basePath = process.env.TEST_BASE_PATH || '/';
assert.ok(basePath.startsWith('/') && basePath.endsWith('/'));
const server = createServer(async (req, res) => {
  try {
    const pathname = req.url.split('?')[0];
    if (!pathname.startsWith(basePath)) throw Error('Outside app path');
    const local = pathname.slice(basePath.length);
    const path = resolve(root, local || 'index.html');
    if (!path.startsWith(root + '/')) throw Error('Invalid path');
    let data = await readFile(path);
    res.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
      }[extname(path)] || 'application/octet-stream'
    );
    res.end(data);
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
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 980, height: 750 },
  });
  await context.addInitScript(() => {
    window.__audioCalls = [];
    window.__cameraCalls = [];
    window.__shareCalls = [];
    window.__shareMode = 'audio';
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async (options) => {
        if (options.video && options.audio === false) {
          window.__cameraCalls.push(options);
          throw new DOMException('Camera denied for test', 'NotAllowedError');
        }
        window.__audioCalls.push('unexpected microphone request');
        throw new Error('Microphone must not be requested');
      },
    });
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      configurable: true,
      value: async (options) => {
        window.__shareCalls.push(options);
        if (window.__shareMode === 'deny')
          throw new DOMException('Cancelled', 'NotAllowedError');
        const canvas = document.createElement('canvas');
        const stream = canvas.captureStream().clone();
        if (window.__shareMode !== 'silent') {
          const ctx = new AudioContext(),
            dest = ctx.createMediaStreamDestination();
          const osc = ctx.createOscillator();
          osc.connect(dest);
          osc.start();
          stream.addTrack(dest.stream.getAudioTracks()[0]);
        }
        window.__sharedStream = stream;
        if (window.__shareMode === 'delayed')
          await new Promise((r) => {
            window.__releaseShare = r;
          });
        return stream;
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  // Hold the renderer download to inspect what a slow connection paints before JS.
  let releaseStartup;
  const startupGate = new Promise((resolve) => {
    releaseStartup = resolve;
  });
  await page.route('**/js/app.js?*', async (route) => {
    await startupGate;
    await route.continue();
  });
  const navigation = page.goto(
    `http://127.0.0.1:${server.address().port}${basePath}`,
    { waitUntil: 'domcontentloaded', timeout: 20000 }
  );
  await page.locator('#legacyControls').waitFor({ state: 'attached' });
  await frames(2);
  assert.equal(await page.locator('body').getAttribute('class'), 'minimal');
  assert.equal(await page.locator('#legacyControls').isVisible(), false);
  assert.equal(await page.locator('#drift').isVisible(), false);
  assert.equal(await page.locator('#screen').isVisible(), false);
  const initialLayout = await page.evaluate(() => {
    const header = document.querySelector('.top').getBoundingClientRect();
    const panel = document.querySelector('.panel').getBoundingClientRect();
    return {
      headerHeight: header.height,
      panelX: panel.x,
      columns: getComputedStyle(document.querySelector('.deck'))
        .gridTemplateColumns,
    };
  });
  releaseStartup();
  await navigation;
  await page.waitForFunction(() =>
    document.body.classList.contains('ui-ready')
  );
  assert.equal(await page.locator('#screen').isVisible(), true);
  const finalLayout = await page.evaluate(() => {
    const header = document.querySelector('.top').getBoundingClientRect();
    const panel = document.querySelector('.panel').getBoundingClientRect();
    return {
      headerHeight: header.height,
      panelX: panel.x,
      columns: getComputedStyle(document.querySelector('.deck'))
        .gridTemplateColumns,
    };
  });
  assert.deepEqual(
    finalLayout,
    initialLayout,
    'header and sidebar must not change layout when the renderer starts'
  );
  await page.waitForFunction(() =>
    document
      .querySelector('#sndStatus')
      .textContent.includes('Click Share audio')
  );
  await frames(5);
  const checkResolution = async () => {
    await page.waitForFunction(
      () => {
        const c = document.querySelector('#screen'),
          r = c.getBoundingClientRect();
        const dpr = Math.min(
          devicePixelRatio,
          2,
          Math.sqrt(8.3e6 / (r.width * r.height))
        );
        const match = /^(\d+) × (\d+)$/.exec(
          document.querySelector('#renderSize').textContent
        );
        return (
          c.width === Math.round(r.width * dpr) &&
          c.height === Math.round(r.height * dpr) &&
          match &&
          Number(match[2]) >= 576 &&
          Math.abs(Number(match[1]) / Number(match[2]) - c.width / c.height) <
            0.03
        );
      },
      null,
      { timeout: 20000 }
    );
  };
  await page.locator('#pictureSharpness').selectOption('full');
  await checkResolution();
  await page.waitForFunction(() =>
    /^\d+ FPS$/.test(document.querySelector('#renderFps').textContent)
  );
  assert.equal(await page.locator('#currentTexture').textContent(), 'Mercury');
  assert.equal(await page.locator('#trails').inputValue(), '0');
  assert.equal(await page.locator('#size').inputValue(), '100');
  for (const id of ['flow', 'warp', 'spin', 'grow'])
    assert.equal(await page.locator('#' + id).isDisabled(), true);
  await page.locator('#trails').evaluate((el) => {
    el.value = 60;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (const id of ['flow', 'warp', 'spin', 'grow'])
    assert.equal(await page.locator('#' + id).isDisabled(), false);
  await page.locator('#trails').evaluate((el) => {
    el.value = 0;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#trails').evaluate((el) => {
    el.value = 40;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Reset Trails', exact: true }).click();
  assert.equal(await page.locator('#trails').inputValue(), '0');
  const audioSection = page
    .locator('details.minimal-section')
    .filter({ has: page.locator('#connectAudio') });
  await audioSection.locator(':scope > summary').click();
  assert.equal(await page.locator('#connectAudio').isVisible(), false);
  await audioSection.locator(':scope > summary').click();
  assert.equal(await page.locator('#connectAudio').isVisible(), true);
  await page
    .getByRole('button', { name: 'Reset Audio section', exact: true })
    .click();
  assert.equal(
    await audioSection.evaluate((el) => el.open),
    true,
    'section reset does not collapse its heading'
  );

  assert.equal(
    await page.getByRole('button', { name: /About Autopilot/ }).count(),
    0,
    'buttons have hover help without extra icons'
  );
  await page.getByRole('button', { name: 'About Trails', exact: true }).focus();
  assert.match(
    await page.getByRole('tooltip').textContent(),
    /How long echoes last/
  );
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('tooltip').isVisible(), false);
  await page.getByRole('checkbox', { name: 'Trails LFO', exact: true }).check();
  const fromTick = page.getByRole('slider', {
    name: 'Trails LFO From',
    exact: true,
  });
  const toTick = page.getByRole('slider', {
    name: 'Trails LFO To',
    exact: true,
  });
  await fromTick.press('Home');
  await fromTick.press('Shift+ArrowRight');
  await toTick.press('Home');
  for (let i = 0; i < 4; i++) await toTick.press('Shift+ArrowRight');
  assert.equal(await fromTick.getAttribute('aria-valuenow'), '10');
  assert.equal(await toTick.getAttribute('aria-valuenow'), '40');
  await page
    .getByLabel('Trails LFO curve', { exact: true })
    .selectOption('log');
  assert.ok(
    await page
      .getByLabel('Trails LFO beats', { exact: true })
      .evaluate((el) => el.getBoundingClientRect().height <= 16)
  );
  await page
    .getByLabel('Trails LFO beats', { exact: true })
    .selectOption('0.125');
  await frames(3);
  assert.ok(
    await page
      .locator('#trails')
      .evaluate((el) => el.classList.contains('lfo-active-slider'))
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('phosphor-min-lfo-v1'))['A:trails']
          .beats
    ),
    0.125
  );
  await page.locator('#tabB').click();
  assert.equal(
    await page
      .getByRole('checkbox', { name: 'Trails LFO', exact: true })
      .isChecked(),
    false
  );
  await page.locator('#tabA').click();
  assert.equal(
    await page
      .getByRole('checkbox', { name: 'Trails LFO', exact: true })
      .isChecked(),
    true
  );
  await page.locator('#trails').press('ArrowRight');
  assert.equal(
    await page
      .getByRole('checkbox', { name: 'Trails LFO', exact: true })
      .isChecked(),
    false,
    'manual keyboard movement takes over'
  );
  assert.equal(
    await page
      .locator('#trails')
      .evaluate((el) => el.classList.contains('lfo-active-slider')),
    false
  );

  assert.equal(await page.locator('.top #renderSize').count(), 0);
  assert.equal(await page.locator('.bottom-bar #renderSize').count(), 1);
  assert.equal(await page.locator('.bottom-bar #renderBpm').count(), 1);
  assert.equal(await page.locator('#renderBpm').textContent(), '— BPM');
  assert.equal(await page.locator('.bottom-bar #tc').count(), 1);
  const overlayRows = await page.evaluate(() => {
    const text = document
      .querySelector('#currentTexture')
      .getBoundingClientRect();
    const buttons = document
      .querySelector('.playback-buttons')
      .getBoundingClientRect();
    return buttons.bottom <= text.top;
  });
  assert.equal(
    overlayRows,
    true,
    'canvas buttons sit above bottom information'
  );
  assert.equal(
    await page.locator('#globalVideo #pictureSharpness').count(),
    1,
    'quality is global'
  );

  assert.equal(await page.locator('.top #tc').count(), 0);
  // Desktop and the former 851–900px breakpoint gap must contain sidebar scrolling.
  for (const width of [980, 880, 760, 390]) {
    await page.setViewportSize({ width, height: 750 });
    await frames(5);
    await page.locator('.panel').evaluate((panel) => {
      panel.scrollTop = panel.scrollHeight;
    });
    const before = await page.locator('#screen').boundingBox();
    const header = await page.locator('.top').boundingBox();
    assert.ok(
      header.y >= 0 && header.y < 2,
      'workspace begins at the viewport top'
    );
    assert.ok(
      before.y >= header.y + header.height - 1,
      'canvas never starts above its visible container'
    );
    assert.ok(
      before.x >= 0 && before.y + before.height <= 751,
      'canvas is fully inside the viewport'
    );
    assert.equal(
      await page
        .locator('.app')
        .evaluate((el) => getComputedStyle(el).position),
      'fixed'
    );
    const panel = await page.locator('.panel').boundingBox();
    await page.mouse.move(
      panel.x + panel.width / 2,
      panel.y + panel.height - 20
    );
    await page.mouse.wheel(0, 800);
    await frames(5);
    assert.equal(
      await page.evaluate(() => window.scrollY),
      0,
      'sidebar end must not scroll the page'
    );
    assert.equal(
      await page
        .locator('.panel')
        .evaluate((panel) => getComputedStyle(panel).overscrollBehaviorY),
      'contain'
    );
    const after = await page.locator('#screen').boundingBox();
    assert.equal(after.y, before.y, 'canvas stays in place');
    await page.locator('.panel').evaluate((panel) => {
      panel.scrollTop = 0;
    });
  }
  await page.setViewportSize({ width: 940, height: 690 });
  await checkResolution();
  await page.locator('#pictureSharpness').selectOption('standard');
  await page.waitForFunction(() =>
    /× 576$/.test(document.querySelector('#renderSize').textContent)
  );
  await page.locator('#pictureSharpness').selectOption('full');
  await checkResolution();
  await page.locator('#full').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert.equal(
    await page.evaluate(() =>
      document.fullscreenElement.contains(document.querySelector('.bottom-bar'))
    ),
    true
  );
  assert.equal(await page.locator('#freeze').isVisible(), true);
  await page.locator('#freeze').click();
  assert.equal(
    await page.locator('#freeze').getAttribute('aria-pressed'),
    'true'
  );
  await page.locator('#freeze').click();
  assert.equal(await page.locator('#renderFps').isVisible(), true);
  const overlayFits = await page.evaluate(() => {
    const c = document.querySelector('#screen').getBoundingClientRect(),
      b = document.querySelector('.bottom-bar').getBoundingClientRect();
    return (
      b.left >= c.left - 1 && b.right <= c.right + 1 && b.bottom <= c.bottom + 1
    );
  });
  assert.equal(overlayFits, true);
  await checkResolution();
  await page.evaluate(() => document.exitFullscreen());
  await checkResolution();
  // Verify physical pixels at a higher display density without a large GPU workload.
  await page.setViewportSize({ width: 500, height: 400 });
  await page.evaluate(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    });
    window.dispatchEvent(new Event('resize'));
  });
  await checkResolution();
  await page.evaluate(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1,
    });
    window.dispatchEvent(new Event('resize'));
  });
  await page.setViewportSize({ width: 980, height: 750 });
  await checkResolution();
  assert.equal(await page.locator('.minimal-section').count(), 4);
  assert.equal(await page.locator('#tasteGroup').isVisible(), false);
  assert.equal(await page.locator('#showGroup').isVisible(), false);
  await page.locator('#pictureSharpness').selectOption('auto');
  assert.match(await page.locator('#sharpNote').textContent(), /Auto:/);
  await page.locator('#pictureSharpness').selectOption('high');
  await page.waitForFunction(() => {
    const h = Number(
      document.querySelector('#renderSize').textContent.split('×')[1]
    );
    return h >= 576 && h <= 1080;
  });
  await page.locator('#pictureSharpness').selectOption('full');
  assert.equal(await page.locator('#sceneSelect').inputValue(), 'mercury');
  assert.deepEqual(
    await page.evaluate(() => [
      window.__audioCalls.length,
      window.__shareCalls.length,
    ]),
    [0, 0]
  );
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#sndStatus')
      .textContent.includes('Listening to shared audio')
  );
  await page.waitForFunction(() =>
    ['Finding tempo', 'Listening'].some((state) =>
      document.querySelector('#rhythmStatus').textContent.includes(state)
    )
  );
  assert.ok(await page.locator('#rhythmStatus').isVisible());
  assert.ok(await page.locator('#renderBpm').isVisible());
  await page.waitForFunction(() =>
    /Finding BPM|[0-9]+ BPM/.test(
      document.querySelector('#renderBpm').textContent
    )
  );
  assert.equal(
    await page.evaluate(() => window.__shareCalls[0].systemAudio),
    'include'
  );
  assert.equal(
    await page.evaluate(() => window.__shareCalls[0].video.displaySurface),
    'browser'
  );
  assert.equal(await page.locator('#musicMappings').count(), 0);
  assert.equal(await page.locator('.pin').count(), 0);
  assert.equal(
    await page.evaluate(() => window.__cameraCalls.length),
    0,
    'startup does not request a camera'
  );
  await page.locator('#sceneSelect').selectOption('camera');
  await page.waitForFunction(() =>
    document
      .querySelector('#camStatus')
      .textContent.includes('Camera access was blocked')
  );
  assert.ok(await page.locator('#row-camera').isVisible());
  assert.ok(await page.locator('#camRetry').isVisible());
  assert.equal(await page.evaluate(() => window.__cameraCalls.length), 1);
  assert.equal(
    await page.evaluate(() => window.__cameraCalls[0].audio),
    false,
    'webcam requests video only'
  );
  const videoChooser = page.waitForEvent('filechooser');
  await page.locator('#sceneSelect').selectOption('video');
  await (await videoChooser).setFiles([]);
  assert.ok(await page.locator('#row-video').isVisible());
  assert.ok(await page.locator('#pickVid').isVisible());
  await page.locator('#sceneSelect').selectOption('picture');
  assert.ok(await page.locator('#row-picture').isVisible());
  assert.equal(await page.locator('#row-video').isVisible(), false);
  await page.locator('#sceneSelect').selectOption('loop');
  assert.ok(await page.locator('#row-loop').isVisible());
  assert.ok(await page.locator('#motionCtl').isVisible());
  await page.locator('#sceneSelect').selectOption('mercury');
  // Editing B must leave A's texture and effects intact.
  await page.locator('#tabB').click();
  assert.equal(
    await page.locator('#tabB').getAttribute('aria-selected'),
    'true'
  );
  await page.locator('#sceneSelect').selectOption('aurora');
  await page.locator('#trails').evaluate((el) => {
    el.value = 23;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#tabA').click();
  assert.equal(await page.locator('#sceneSelect').inputValue(), 'mercury');
  await page.locator('#tabB').click();
  assert.equal(await page.locator('#sceneSelect').inputValue(), 'aurora');
  assert.equal(await page.locator('#trails').inputValue(), '23');
  await page.locator('#sceneSelect').selectOption('cavern');
  assert.equal(
    await page.locator('#trails').inputValue(),
    '0',
    'new inputs start without inherited trails'
  );
  await page.locator('#view').evaluate((el) => {
    el.value = 50;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#tabA').click();
  await page.locator('#view').evaluate((el) => {
    el.value = 0;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (const name of ['Fractal garden', 'Bloom', 'Shattered mirror']) {
    await page.locator('#sceneSelect').selectOption('look:' + name);
    await frames(120);
    await page.screenshot({
      path:
        '/tmp/phosphor-2d-' + name.toLowerCase().replaceAll(' ', '-') + '.png',
    });
    assert.equal(
      await page.locator('#sceneSelect').inputValue(),
      'look:' + name
    );
    assert.ok(
      Number(await page.locator('#trails').inputValue()) > 0,
      'named feedback recipe retains upstream trails'
    );
  }
  await page.locator('#tabB').click();
  assert.equal(await page.locator('#sceneSelect').inputValue(), 'cavern');
  await page.locator('#tabA').click();
  assert.equal(
    await page.locator('#sceneSelect').inputValue(),
    'look:Shattered mirror',
    'selected 2D look remains visible when switching loops'
  );
  await page
    .getByRole('button', { name: 'Reset Visualizer section', exact: true })
    .click();
  assert.equal(await page.locator('#trails').inputValue(), '0');
  await page.locator('#sceneSelect').selectOption('patchwork');
  await frames(20);
  assert.equal(await page.locator('#trails').inputValue(), '0');
  assert.equal(await page.locator('#size').inputValue(), '100');
  await page.locator('#sceneSelect').selectOption('sierpinski');
  await frames(120);
  await page.screenshot({ path: '/tmp/phosphor-mappings-sierpinski.png' });
  await page.locator('#disconnectAudio').click();
  assert.equal(
    await page.evaluate(() =>
      window.__sharedStream.getTracks().every((t) => t.readyState === 'ended')
    ),
    true
  );

  await page.locator('#sceneSelect').selectOption('cavern');
  await page.locator('#trails').evaluate((el) => {
    el.value = 35;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#autopilot').click();
  await frames(10);
  await page.locator('#autopilot').click();
  await page.locator('#sceneSelect').selectOption('cavern');
  await page.locator('#trails').evaluate((el) => {
    el.value = 35;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#pictureSharpness').selectOption('full');
  await checkResolution();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.evaluate(() => {
    const key = 'phosphor-min-last-v1',
      saved = JSON.parse(localStorage.getItem(key));
    saved.look.snd.routes[1].source = 'kick';
    delete saved.look.snd.mappingVersion;
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await frames(5);
  assert.equal(await page.locator('#pictureSharpness').inputValue(), 'full');
  await checkResolution();
  assert.equal(await page.locator('#sceneSelect').inputValue(), 'cavern');
  assert.equal(await page.locator('#trails').inputValue(), '35');
  await page.waitForFunction(
    () => document.querySelector('#currentTexture').textContent === 'Cavern'
  );
  assert.deepEqual(
    await page.evaluate(() => [
      window.__audioCalls.length,
      window.__shareCalls.length,
    ]),
    [0, 0]
  );
  await page.evaluate(() => {
    window.__shareMode = 'silent';
  });
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#sndStatus')
      .textContent.includes('No audio was shared')
  );
  assert.equal(
    await page.evaluate(() =>
      window.__sharedStream.getTracks().every((t) => t.readyState === 'ended')
    ),
    true
  );
  await page.evaluate(() => {
    window.__shareMode = 'deny';
  });
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#sndStatus')
      .textContent.includes('cancelled or blocked')
  );
  await page.evaluate(() => {
    window.__shareMode = 'audio';
  });
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#sndStatus')
      .textContent.includes('Listening to shared audio')
  );
  await page.evaluate(() =>
    window.__sharedStream.getAudioTracks()[0].dispatchEvent(new Event('ended'))
  );
  await page.waitForFunction(() =>
    document
      .querySelector('#sndStatus')
      .textContent.includes('Audio sharing stopped')
  );
  await page.evaluate(() => {
    window.__shareMode = 'delayed';
  });
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() => !!window.__releaseShare);
  await page.evaluate(() =>
    document.querySelector('#soundSrc [data-snd="off"]').click()
  );
  await page.evaluate(() => window.__releaseShare());
  await page.waitForFunction(() =>
    window.__sharedStream.getTracks().every((t) => t.readyState === 'ended')
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      value: undefined,
    })
  );
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#sndStatus')
      .textContent.includes('unavailable here')
  );
  assert.deepEqual(await page.evaluate(() => window.__audioCalls), []);
  await page.screenshot({ path: '/tmp/phosphor-minimal.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await frames(3);
  await page.locator('.panel').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: '/tmp/phosphor-mappings-mobile.png' });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  );
  assert.deepEqual(errors, []);
  const filePage = await browser.newPage({
    viewport: { width: 500, height: 400 },
  });
  await filePage.goto(new URL('../index.html', import.meta.url).href, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  assert.ok(await filePage.locator('#localPreviewNotice').isVisible());
  assert.equal(
    await filePage
      .getByRole('link', { name: 'Open local preview', exact: true })
      .getAttribute('href'),
    'http://localhost:8000/'
  );
  await filePage.close();
  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args);
    };
  });
  await unsupported.goto(
    `http://127.0.0.1:${server.address().port}${basePath}`,
    { waitUntil: 'domcontentloaded' }
  );
  await unsupported.locator('#msg').waitFor({ state: 'visible' });
  assert.match(
    await unsupported.locator('#msg').textContent(),
    /needs WebGL 2/
  );
  await unsupported.close();
  console.log(
    'PASS: stable first paint, visible WebGL errors, upstream picture sharpness, viewport resizing, fullscreen, HiDPI, saved sharpness, 3D startup, click-to-share audio without microphone access, disconnect, missing audio, cancellation, ended/stale streams, unsupported browser, saved visual defaults, autopilot, responsive layout, no page errors.'
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
