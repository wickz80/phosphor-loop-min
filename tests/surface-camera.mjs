import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c={window:{}};
vm.runInNewContext(await readFile(new URL('../js/fractal-math.js',import.meta.url),'utf8'),c);
const {makeSurfaceCamera,FR}=c.window.PhosphorFractals;
const length=a=>Math.hypot(...a),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
for(const [name,de,perimeter] of [['sphere',FR.sphere,2*Math.PI*1.18],['cube',FR.cube,8+2*Math.PI*.18]]){
  const cam=makeSurfaceCamera(de,1,{height:.18,speed:.65}),start=cam.p.slice();
  const seconds=perimeter/.65;let left=seconds,maxError=0,minUp=1;
  while(left>1e-9){const dt=Math.min(left,1/120);cam.fly(dt);left-=dt;maxError=Math.max(maxError,Math.abs(cam.d-.18));minUp=Math.min(minUp,length(cam.up));
    assert.ok([...cam.p,...cam.look,...cam.up].every(Number.isFinite));
    assert.ok(cam.d>0,'outside '+name);
    assert.ok(Math.abs(dot(cam.look,cam.up))<1e-6,'orthogonal view '+name);
  }
  const closure=length(cam.p.map((x,i)=>x-start[i]));
  console.log(name,{closure,maxError,minUp});
  assert.ok(closure<.025,'one surface circuit returns to its starting point: '+name);
  assert.ok(maxError<1e-5,'fixed clearance: '+name);
  const before=cam.p.slice();cam.fly(0,{surface:1,speed:1});assert.deepEqual(cam.p,before,'freeze');
}
const cam=makeSurfaceCamera(FR.sphere),base=makeSurfaceCamera(FR.sphere);
for(let i=0;i<240;i++){cam.fly(1/120,{speed:1});base.fly(1/120);}
assert.ok(length(cam.velocity)>length(base.velocity)*2,'real speed control');
let minimum=Infinity,maximum=0;
for(let i=0;i<360;i++){
  const pulse=Math.exp(-((i/120*2)%1)*5);
  cam.fly(1/120,{surface:pulse});minimum=Math.min(minimum,cam.d);maximum=Math.max(maximum,cam.d);
  assert.ok(cam.d>0,'launch stays outside');
}
console.log('launch height range',{minimum,maximum});
assert.ok(maximum-minimum>.02,'surface drive and release move the camera radially');
for(let i=0;i<240;i++)cam.fly(1/120);
assert.ok(Math.abs(cam.d-2)<.01,'radial motion settles back to its baseline clearance');
console.log('PASS: full sphere/cube circuits, stable clearance, upright view, real acceleration, radial launches and freeze.');
