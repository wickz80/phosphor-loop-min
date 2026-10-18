import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!path.startsWith(root + '/')) throw Error('Invalid path');
    let data = await readFile(path);
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context = await browser.newContext({serviceWorkers:'block', viewport:{width:980,height:750}});
  await context.addInitScript(() => {
    window.__audioCalls = [];
    window.__shareCalls = [];
    window.__shareMode = 'audio';
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value:async () => {
      window.__audioCalls.push('unexpected microphone request');
      throw new Error('Microphone must not be requested');
    }});
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {configurable:true,value:async options => {
      window.__shareCalls.push(options);
      if (window.__shareMode === 'deny') throw new DOMException('Cancelled','NotAllowedError');
      const canvas = document.createElement('canvas');
      const stream = canvas.captureStream().clone();
      if (window.__shareMode !== 'silent') {
        const ctx = new AudioContext(), dest = ctx.createMediaStreamDestination();
        const osc = ctx.createOscillator(); osc.connect(dest); osc.start();
        stream.addTrack(dest.stream.getAudioTracks()[0]);
      }
      window.__sharedStream = stream;
      if (window.__shareMode === 'delayed') await new Promise(r => {window.__releaseShare = r;});
      return stream;
    }});
  });
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const frames = n => page.evaluate(n => new Promise(resolve => { let i=0; function tick(){ if (++i >= n) resolve(); else requestAnimationFrame(tick); } requestAnimationFrame(tick); }), n);
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(() => document.querySelector('#sndStatus').textContent.includes('Click Share audio'));
  await frames(5);
  const checkResolution = async scale => {
    await page.waitForFunction(scale => {
      const c = document.querySelector('#screen'), r = c.getBoundingClientRect();
      return c.width === Math.round(r.width * devicePixelRatio * scale) &&
        c.height === Math.round(r.height * devicePixelRatio * scale) &&
        document.querySelector('#renderSize').textContent === `${c.width} × ${c.height}`;
    }, scale, {timeout:20000});
  };
  await checkResolution(1);
  await page.waitForFunction(() => /^\d+ FPS$/.test(document.querySelector('#renderFps').textContent));
  assert.equal(await page.locator('#currentTexture').textContent(), 'Mercury');
  assert.equal(await page.locator('.top #renderSize').count(), 0);
  assert.equal(await page.locator('.bottom-bar #renderSize').count(), 1);
  assert.equal(await page.locator('.bottom-bar #tc').count(), 1);
  assert.equal(await page.locator('.top #tc').count(), 0);
  await page.setViewportSize({width:940,height:690});
  await checkResolution(1);
  await page.locator('#renderQuality').selectOption('0.5');
  await checkResolution(0.5);
  await page.locator('#renderQuality').selectOption('1');
  await checkResolution(1);
  await page.locator('#full').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert.equal(await page.evaluate(() => document.fullscreenElement.contains(document.querySelector('.bottom-bar'))), true);
  assert.equal(await page.locator('#freeze').isVisible(), true);
  await page.locator('#freeze').click();
  assert.equal(await page.locator('#freeze').getAttribute('aria-pressed'), 'true');
  await page.locator('#freeze').click();
  assert.equal(await page.locator('#renderFps').isVisible(), true);
  const overlayFits = await page.evaluate(() => {
    const c = document.querySelector('#screen').getBoundingClientRect(), b = document.querySelector('.bottom-bar').getBoundingClientRect();
    return b.left >= c.left - 1 && b.right <= c.right + 1 && b.bottom <= c.bottom + 1;
  });
  assert.equal(overlayFits, true);
  await checkResolution(1);
  await page.evaluate(() => document.exitFullscreen());
  await checkResolution(1);
  // Verify physical pixels at a higher display density without a large GPU workload.
  await page.setViewportSize({width:500,height:400});
  await page.evaluate(() => { Object.defineProperty(window, 'devicePixelRatio', {configurable:true,value:2}); window.dispatchEvent(new Event('resize')); });
  await checkResolution(1);
  await page.evaluate(() => { Object.defineProperty(window, 'devicePixelRatio', {configurable:true,value:1}); window.dispatchEvent(new Event('resize')); });
  await page.setViewportSize({width:980,height:750});
  await checkResolution(1);
  assert.equal(await page.locator('.minimal-section').count(), 3);
  assert.equal(await page.locator('#tasteGroup').isVisible(), false);
  assert.equal(await page.locator('#showGroup').isVisible(), false);
  assert.equal(await page.locator('#sceneSelect').inputValue(), 'mercury');
  assert.deepEqual(await page.evaluate(() => [window.__audioCalls.length, window.__shareCalls.length]), [0, 0]);
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() => document.querySelector('#sndStatus').textContent.includes('Listening to shared audio'));
  assert.equal(await page.evaluate(() => window.__shareCalls[0].systemAudio), 'include');
  assert.equal(await page.evaluate(() => window.__shareCalls[0].video.displaySurface), 'browser');
  await page.locator('#disconnectAudio').click();
  assert.equal(await page.evaluate(() => window.__sharedStream.getTracks().every(t => t.readyState === 'ended')), true);
  await page.locator('#sceneSelect').selectOption('cavern');
  await page.locator('#trails').evaluate(el => {el.value=35;el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#autopilot').click(); await frames(10);
  await page.locator('#autopilot').click();
  await page.locator('#sceneSelect').selectOption('cavern');
  await page.locator('#trails').evaluate(el => {el.value=35;el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#renderQuality').selectOption('0.75');
  await checkResolution(0.75);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload({waitUntil:'domcontentloaded',timeout:20000}); await frames(5);
  assert.equal(await page.locator('#renderQuality').inputValue(), '0.75');
  await checkResolution(0.75);
  assert.equal(await page.locator('#sceneSelect').inputValue(), 'cavern');
  assert.equal(await page.locator('#trails').inputValue(), '35');
  await page.waitForFunction(() => document.querySelector('#currentTexture').textContent === 'Cavern');
  assert.deepEqual(await page.evaluate(() => [window.__audioCalls.length, window.__shareCalls.length]), [0, 0]);
  await page.evaluate(() => {window.__shareMode = 'silent';});
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() => document.querySelector('#sndStatus').textContent.includes('No audio was shared'));
  assert.equal(await page.evaluate(() => window.__sharedStream.getTracks().every(t => t.readyState === 'ended')), true);
  await page.evaluate(() => {window.__shareMode = 'deny';});
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() => document.querySelector('#sndStatus').textContent.includes('cancelled or blocked'));
  await page.evaluate(() => {window.__shareMode = 'audio';});
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() => document.querySelector('#sndStatus').textContent.includes('Listening to shared audio'));
  await page.evaluate(() => window.__sharedStream.getAudioTracks()[0].dispatchEvent(new Event('ended')));
  await page.waitForFunction(() => document.querySelector('#sndStatus').textContent.includes('Audio sharing stopped'));
  await page.evaluate(() => {window.__shareMode = 'delayed';});
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() => !!window.__releaseShare);
  await page.evaluate(() => document.querySelector('#soundSrc [data-snd="off"]').click());
  await page.evaluate(() => window.__releaseShare());
  await page.waitForFunction(() => window.__sharedStream.getTracks().every(t => t.readyState === 'ended'));
  await page.evaluate(() => Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {value:undefined}));
  await page.locator('#connectAudio').click();
  await page.waitForFunction(() => document.querySelector('#sndStatus').textContent.includes('unavailable here'));
  assert.deepEqual(await page.evaluate(() => window.__audioCalls), []);
  await page.screenshot({path:'/tmp/phosphor-minimal.png'});
  await page.setViewportSize({width:390,height:844}); await frames(3);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS: native feedback resolution, viewport resizing, fullscreen, HiDPI, saved resolution scale, 3D startup, click-to-share audio without microphone access, disconnect, missing audio, cancellation, ended/stale streams, unsupported browser, saved visual defaults, autopilot, responsive layout, no page errors.');
} finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
