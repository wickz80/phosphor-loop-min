import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../js/lfo.js',import.meta.url),'utf8'),context);
const {sanitize,valueAt,createEngine,BEATS}=context.window.PhosphorLFO;
const limits={min:-100,max:100,step:1};
for(const beats of BEATS){
 const config={x:-40,y:60,beats};
 for(const [position,expected]of [[0,-40],[.25,10],[.5,60],[.75,10],[1,-40]])assert.ok(Math.abs(valueAt(config,position*beats)-expected)<1e-9);
 for(let i=0;i<500;i++){const value=valueAt(config,i/73);assert.ok(value>=-40&&value<=60);}
}
assert.equal(valueAt({x:90,y:-10,beats:4},2),-10,'reversed ranges work');
const dirty=sanitize({enabled:true,x:-1000,y:Infinity,beats:0},limits);
assert.equal(dirty.x,-100);assert.equal(dirty.y,100);assert.equal(dirty.beats,4);
const calls=[];
const engine=createEngine({resolve:key=>['A:spin','B:spin','global:amount'].includes(key)?{key,limits}:null,apply:(target,value)=>calls.push([target.key,value])});
engine.set('A:spin',{enabled:true,x:-20,y:40,beats:4});
engine.set('B:spin',{enabled:true,x:10,y:50,beats:8});
engine.set('global:amount',{enabled:false,x:0,y:100,beats:1});
engine.tick(2);assert.equal(calls.length,2);assert.equal(calls[0][1],40);assert.equal(calls[1][1],30);
engine.tick(null);engine.tick(NaN);engine.tick(3,true);assert.equal(calls.length,2,'missing tempo and Freeze hold the value');
engine.set('A:spin',{...engine.bindings['A:spin'],enabled:false});engine.tick(4);assert.equal(calls.length,3);assert.equal(calls[2][0],'B:spin','disabling A does not disable B');
const restored=createEngine({bindings:JSON.parse(JSON.stringify(engine.bindings)),resolve:key=>({key,limits}),apply:(target,value)=>calls.push([target.key,value])});
restored.tick(6);assert.equal(calls.at(-1)[1],30,'saved configuration restores beat-driven motion');
console.log('PASS: all cycle lengths, endpoints, bounded sine motion, reversed ranges, A/B independence, disabled controls, freeze, tempo loss and configuration restore.');

// Curves retain the same endpoints and cycle timing, including signed ranges.
for(const curve of ['sine','linear','log','exp']) {
  const config=sanitize({enabled:true,x:-60,y:40,beats:4,curve},limits);
  assert.equal(config.curve,curve);
  for(const [beat,expected] of [[0,-60],[2,40],[4,-60]])assert.ok(Math.abs(valueAt(config,beat)-expected)<1e-8,curve+' endpoints');
  let previous=-Infinity;
  for(let i=0;i<=100;i++) {
    const value=valueAt(config,i/50);
    assert.ok(value>=-60-1e-9 && value<=40+1e-9,curve+' bounds');
    assert.ok(value>=previous-1e-9,curve+' outward leg is monotonic');previous=value;
    assert.ok(Math.abs(valueAt(config,4-i/50)-value)<1e-8,curve+' return leg mirrors outward leg');
  }
}
assert.equal(sanitize({curve:'invalid'},limits).curve,'sine');
assert.equal(sanitize({},limits).curve,'sine','old saved configurations retain their default curve');
assert.equal(valueAt({x:0,y:100,beats:4,curve:'linear'},1),50);
assert.ok(valueAt({x:0,y:100,beats:4,curve:'log'},1)>50);
assert.ok(valueAt({x:0,y:100,beats:4,curve:'exp'},1)<50);
console.log('PASS: sine/linear/log/exp endpoints, signed bounds, monotonic sweeps, return symmetry and saved-configuration migration.');
