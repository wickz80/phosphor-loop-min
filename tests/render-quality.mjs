import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(await readFile(new URL('../js/render-quality.js',import.meta.url),'utf8'),context);
const {refreshInterval,createController}=context.window.PhosphorQuality;
for(const hz of [60,120,144,165]){
  const interval=1000/hz;
  const samples=Array.from({length:24},(_,i)=>interval*(i%7===0?2:1)+(i%3-1)*0.02);
  assert.ok(Math.abs(refreshInterval(samples)-interval)<0.1,`detect ${hz} Hz despite missed refreshes`);
  const controller=createController();controller.reset(0,interval);
  for(let now=interval;now<2000;now+=interval)controller.update(now,interval);
  assert.equal(controller.scale,1,'healthy pacing preserves detail');
  for(let now=2000;now<4000;now+=interval*2)controller.update(now,interval*2);
  assert.ok(controller.scale<0.65,`${hz} Hz missed refreshes lower detail`);
  const lowered=controller.scale;
  for(let now=4000;now<6500;now+=interval)controller.update(now,interval);
  assert.ok(controller.scale<=lowered,'brief recovery does not pump detail');
  const recoveredFloor=controller.scale;
  for(let now=6500;now<23000;now+=interval)controller.update(now,interval);
  assert.ok(controller.scale>recoveredFloor,'sustained recovery cautiously restores detail');
}
const highRefresh=createController();highRefresh.reset(0,1000/165);
for(let now=0;now<20000;now+=16.7)highRefresh.update(now,16.7);
assert.equal(highRefresh.scale,0.3,'bounded quality under sustained overload');
assert.equal(refreshInterval([NaN,Infinity,0,1,1000]),1000/60,'invalid calibration falls back safely');
console.log('PASS: 60/120/144/165 Hz calibration, missed-refresh adaptation, recovery hysteresis and quality floor.');
