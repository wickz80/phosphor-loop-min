import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const part=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const events=[];
const el={id:'adj-video-bright',value:0};
const bindings={'A:flow':{enabled:true},'B:trails':{enabled:true},'global:view':{enabled:true},'global:videoGamma':{enabled:true},'global:adj-video-bright':{enabled:true},'global:sndAmt':{enabled:true}};
const context={
 window:{PhosphorVideoGrade:{setSlider:(id,value)=>{if(id==='videoGamma'){events.push(['grade',value]);return true;}return false;}}},
 LOOP_SLIDERS:['flow','trails'],MIX_SLIDERS:['view'],edit:'A',
 loops:{A:{tgt:{},cur:{flow:24,trails:50}},B:{tgt:{},cur:{}}},mix:{tgt:{},cur:{view:42}},
 adj:{video:{bright:0}},adjEls:[{src:'video',k:'bright',el,refresh:()=>events.push('adj-refresh')}],
 snd:{},apCtl:{},apSet:{touch:'play'},showSlider:id=>events.push(id),syncVisibility:()=>{},showAp:()=>{},
 $:()=>({}),sliderEls:{flow:{value:'0'},trails:{value:'0'},view:{value:'0'}},
 ap:{pins:new Set()},watch:{},document:{documentElement:{classList:{toggle:()=>{}}}},apBtns:[],
 performance:{now:()=>100},eyeReset:()=>{},setDrift:()=>{},apEverySec:()=>30,apPicGap:()=>3,
 apIntoLimits:()=>{},settleDevices:()=>{},syncUI:()=>{},apStatus:()=>{},showOSD:()=>{},toast:()=>{},
 lfoUI:{disableWhere:predicate=>{for(const [key,config]of Object.entries(bindings))if(predicate(key))config.enabled=false;}},
};
vm.createContext(context);
vm.runInContext(part('function isAutopilotSlider(', 'function dependencyState(')+part('function setAutopilot(', '// Manual controls play along'),context);
context.applyAutomatedSlider(el,70,'global');
assert.equal(context.adj.video.bright,70);assert.equal(el.value,70);assert.ok(events.includes('adj-refresh'));
context.applyAutomatedSlider({id:'flow'},34,'B');
assert.equal(context.loops.B.tgt.flow,34);assert.equal(context.loops.B.cur.flow,34);assert.equal(context.loops.A.tgt.flow,undefined);
context.applyAutomatedSlider({id:'view'},25,'global');assert.equal(context.mix.cur.view,25);
context.applyAutomatedSlider({id:'videoGamma'},1.5,'global');assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='grade'));
context.setAutopilot(true,true);
for(const key of ['A:flow','B:trails','global:view'])assert.equal(bindings[key].enabled,false,key);
for(const key of ['global:videoGamma','global:adj-video-bright','global:sndAmt'])assert.equal(bindings[key].enabled,true,key);
context.syncAutomationSliders();assert.equal(Number(context.sliderEls.flow.value),24);assert.equal(Number(context.sliderEls.view.value),25);
const before=events.length;context.syncAutomationSliders();assert.equal(events.length,before,'unchanged frames avoid redundant UI writes');
// Exercise actual beat gating with music response muted.
Object.assign(context,{snd:{analyser:{},amount:0,rhythmSample:{gridBeat:10}},apSet:{beat:true},ap:{beatWait:null,rush:false},apStep:(now,onBeat)=>events.push(['step',onBeat])});
vm.runInContext(part('function apTick(', 'function apStep('),context);
context.apTick(100);assert.ok(context.ap.beatWait);
context.snd.rhythmSample.gridBeat=11;context.apTick(200);
assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='step'&&e[1]===true));
console.log('PASS: real automation routing, source model updates, A/B isolation, exclusive AP ownership, independent master LFOs, live readouts and beat gating at zero Amount.');
