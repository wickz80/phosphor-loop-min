import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
for(const name of ['beat-clock','rhythm'])vm.runInNewContext(fs.readFileSync(new URL(`../js/audio/${name}.js`,import.meta.url),'utf8'),context);
const Clock=context.window.PhosphorBeatClock;
const wrap=value=>((value%1)+1.5)%1-.5;
function simulate({offset=.18,extras=false,drop=false,delivery=.03}={}) {
 const clock=new Clock();clock.setTempo(120,offset,0);
 const events=[];
 for(let time=.5;time<=10;time+=.5){if(!(drop && time>=4&&time<=5))events.push(time);if(extras)events.push(time+.25);}
 events.sort((a,b)=>a-b);
 let next=0,previous=clock.position,accepted=0;
 const errors=[];
 for(let i=1;i<=2200;i++){
  const now=i/200;
  clock.read(now);
  while(next<events.length&&events[next]+delivery<=now){
   const before=clock.position;
   if(clock.observeOnset(events[next++],now))accepted++;
   assert.equal(clock.position,before,'onset never resets phase immediately');
  }
  if(i===800||i===1600)clock.setTempo(120,now+.15,now);
  const value=clock.read(now);
  assert.ok(clock.position>=previous,'clock never runs backwards');previous=clock.position;
  if(now>=3)errors.push(Math.abs(wrap(value.phase-now*2))*.5);
 }
 assert.ok(accepted>=8,'regular beats accepted');
 assert.ok(Math.max(...errors)<.03,'settles within 30 ms by three seconds: '+Math.max(...errors));
 assert.equal(clock.targetBpm,120,'onset alignment does not alter tempo');
 return clock;
}
simulate();simulate({extras:true});simulate({drop:true});simulate({offset:-.2,delivery:.08});
const clock=new Clock();clock.setTempo(120,0,0);
assert.equal(clock.observeOnset(.5,1),false,'stale onset rejected');
assert.equal(clock.observeOnset(2,1),false,'future onset rejected');
assert.equal(clock.observeOnset(NaN,1),false);
for(const onset of [.5,1,1.5])clock.observeOnset(onset,onset+.01);
assert.equal(clock.observeOnset(1.5,1.52),false,'duplicate rejected');
const aligned=clock.read(1.52).phase;
assert.equal(clock.observeOnset(1.75,1.76),false,'offbeat cannot shift a locked clock');
assert.ok(Math.abs(wrap(aligned-.04))<.01);

// Test actual feature-port wiring, including stale/silent/expired-tempo gates.
let featureHandler;
context.AudioWorkletNode=class {constructor(){this.port={set onmessage(fn){featureHandler=fn;}};}connect(){}};
context.Worker=class {postMessage(){}};
const ctx={currentTime:1,audioWorklet:{addModule:async()=>{}},destination:{}};
const rhythm=new context.window.PhosphorRhythm(ctx,{connect(){}});
await rhythm.start();rhythm.tempo={bpm:120,end:0};rhythm.clock.setTempo(120,.18,0);
let calls=0;const observe=rhythm.clock.observeOnset.bind(rhythm.clock);
rhythm.clock.observeOnset=(...args)=>{calls++;return observe(...args);};
featureHandler({data:{type:'features',time:1,lastKick:.99,kick:true,rms:.1}});assert.equal(calls,1);
featureHandler({data:{type:'features',time:1,lastKick:.99,kick:false,rms:.1}});
featureHandler({data:{type:'features',time:1,lastKick:.99,kick:true,rms:0}});assert.equal(calls,1);
ctx.currentTime=20;featureHandler({data:{type:'features',time:20,lastKick:20,kick:true,rms:.1}});assert.equal(calls,1,'expired tempo is not phase corrected');
console.log('PASS: fast onset phase lock, timestamp compensation, extra/missed beats, no jumps/backwards beats, batch-phase isolation, stale/duplicate rejection and real feature-port wiring.');
