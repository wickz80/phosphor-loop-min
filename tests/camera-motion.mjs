import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};
vm.runInNewContext(await readFile(new URL('../js/fractal-math.js',import.meta.url),'utf8'),context);
const {makeDrone,FR}=context.window.PhosphorFractals;
const options={start:3.2,roam:2.2,size:1.2,far:.45,near:.003,dive:70,speed:.55,phase0:0};
const sphere=(x,y,z)=>Math.hypot(x,y,z)-1;
const norm=v=>Math.hypot(...v);
const travel=makeDrone(sphere,1,options),base=makeDrone(sphere,1,options);
const start=[...base.p];
for(let i=0;i<120;i++){base.fly(1/120);travel.fly(1/120,{speed:1});}
assert.ok(norm(travel.p.map((v,i)=>v-start[i]))>norm(base.p.map((v,i)=>v-start[i]))*1.5,'speed changes actual XYZ displacement');
assert.ok(norm(travel.velocity)/travel.d>norm(base.velocity)/base.d*1.5,'speed changes velocity relative to surface clearance');
const styles={};
for(const style of ['glide','runner','crawler']){
  const drone=makeDrone(sphere,1,options);let total=0;
  for(let i=0;i<1800;i++){drone.fly(1/60,{style});if(i>1500)total+=drone.d;}
  styles[style]={distance:total/299,clearance:drone.clearance};
}
console.log('Styles',styles);
assert.ok(styles.crawler.distance<styles.glide.distance*.6,'crawler is closer to surface');
assert.ok(styles.runner.clearance<styles.glide.clearance*.7,'runner has closer target');
const rider=makeDrone(sphere,3,options);
for(let i=0;i<600;i++)rider.fly(1/60,{surface:1});
const before=rider.p.slice(),clearanceBefore=rider.d;
rider.fly(1/60,{surface:0});
assert.ok(rider.launch>0,'release creates a launch impulse');
for(let i=0;i<59;i++)rider.fly(1/60,{surface:0});
assert.ok(rider.d>clearanceBefore,'release moves actual position away from surface');
for (const [effect, angle] of [['turn45',Math.PI/4],['turn90',Math.PI/2]]) {
  const drone=makeDrone(sphere,2,options),heading=drone.f.slice();
  for(let i=0;i<120 && drone.turned<angle-1e-8;i++) drone.fly(1/120,{turn45:0,turn90:0,[effect]:1,turnToken:1});
  const actual=Math.acos(Math.max(-1,Math.min(1,heading.reduce((sum,v,i)=>sum+v*drone.f[i],0))));
  assert.ok(Math.abs(actual-angle)<1e-6,effect+' rotates actual heading by preset angle');
}
const turn=makeDrone(sphere,2,options);
for(let i=0;i<60;i++)turn.fly(1/60,{turn45:1,turn90:0,turnToken:1});
assert.ok(Math.abs(turn.turned-Math.PI/4)<1e-6,'one 45 degree turn per beat token');
for(let i=0;i<60;i++)turn.fly(1/60,{turn45:0,turn90:1,turnToken:2});
assert.ok(Math.abs(turn.turned-Math.PI*.75)<1e-6,'one 90 degree turn on the next token');
// Strong music, large frames, style switches and turns must keep every fractal finite and outside its surface.
for(const [name,de] of Object.entries({sphere,sponge:FR.sponge,bulb:FR.bulb,box:FR.box,pyramid:FR.pyramid,julia:FR.julia,kaleido:FR.kaleido})){
  const drone=makeDrone(de,2,options);
  for(let i=0;i<600;i++){
    const pulse=Math.exp(-((i/30*2)%1)*4);
    drone.fly(1/30,{style:['glide','runner','crawler'][Math.floor(i/200)],speed:pulse,surface:pulse,orbit:.5,turn90:pulse,turn45:0,turnToken:Math.floor(i/15)});
    assert.ok([...drone.p,...drone.look,...drone.up,...drone.velocity,drone.scale].every(Number.isFinite),name+' stays finite');
    assert.ok(de(...drone.p)>0,name+' avoids the structure');
  }
  const p=drone.p.slice();drone.fly(0,{surface:1,speed:1});assert.deepEqual(drone.p,p,'zero time freezes '+name);
}
console.log('PASS: actual camera displacement/velocity, surface clearance, launch, fixed-angle turns, all-fractal collision checks and freeze.');
