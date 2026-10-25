import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the controller used by the app, including its real frame windows.
const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const controller = app.slice(app.indexOf('const SHARP_KEY ='), app.indexOf('const renderLimits'));
function setup(memory = 8) {
  const saved = new Map();
  const context = {
    SIM_H:576, navigator:{deviceMemory:memory}, window:{}, document:{hidden:false}, frozen:false,
    localStorage:{getItem:k=>saved.get(k) ?? null, setItem:(k,v)=>saved.set(k,v)},
    $$:()=>[], $:()=>null, fits:0,
  };
  context.fit = () => context.fits++;
  vm.runInNewContext(controller + `
    this.quality = {
      state: sharpAuto, tick: sharpTick, lines: wantLines, max: maxPx,
      mode(value) { sharp = value; }, display(value) { fitLines = value; }
    };`, context);
  return context;
}
const c = setup(), q = c.quality;
q.display(2160);
for (const [mode, lines] of [['standard',576],['high',1080],['full',2160],['auto',576]]) {
  q.mode(mode); assert.equal(q.lines(),lines,mode);
}
q.mode('full');assert.equal(q.max(),8.3e6);
const low = setup(4);low.quality.mode('full');assert.equal(low.quality.max(),3.7e6);
c.window.__phosphorCaptureConfig = {renderHeight:720};assert.equal(q.lines(),720,'capture owns its resolution');
delete c.window.__phosphorCaptureConfig;
q.mode('auto');let now=1;
function frames(count, fps) { for(let i=0;i<count;i++){now+=1000/fps;q.tick(now);} }
frames(242,60);assert.equal(q.state.level,1,'two healthy windows increase sharpness');
frames(363,60);assert.equal(q.state.level,2);
frames(242,30);assert.equal(q.state.level,1,'two slow windows lower sharpness');
assert.equal(c.fits,3,'resolution is rebuilt only on a level change');
c.document.hidden=true;const previous=q.state.level;frames(500,60);assert.equal(q.state.level,previous,'hidden frames do not increase quality');
c.document.hidden=false;c.frozen=true;frames(500,60);assert.equal(q.state.level,previous,'frozen frames do not increase quality');
c.frozen=false;
frames(242,60);assert.equal(q.state.level,2);
frames(121,30);assert.equal(q.state.level,1,'failed trial immediately steps back');
assert.equal(q.state.ceiling,1,'failed level is temporarily excluded');
frames(484,60);assert.equal(q.state.level,1,'recovery does not immediately retry failed level');
now+=300001;frames(484,60);assert.ok(q.state.level>1,'failed level can be retried after five minutes');
console.log('PASS: upstream sharpness modes, capture sizing, memory caps, frame-based adaptation, pause handling and retry hysteresis.');
