import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../js/control-dependencies.js',import.meta.url),'utf8'),context);
const {reason,FEEDBACK}=context.window.PhosphorDependencies;
for(const id of FEEDBACK) {
 assert.match(reason(id,{loop:{trails:0,in1:'cubes'}}),/Requires Trails above 0/,id);
 assert.equal(reason(id,{loop:{trails:1,in1:'cubes'}}),'',id+' works without BPM when Trails is enabled');
 assert.equal(reason(id,{loop:{trails:60,in1:'shape'}}),'',id+' works on 2D feedback');
}
for(const id of ['trails','view','size','mirror','split','apEvery'])assert.equal(reason(id,{loop:{trails:0,in1:'cubes'}}),'',id+' does not inherit a false trails dependency');
assert.match(reason('blend',{loop:{in2:'none'}}),/second input/);
assert.equal(reason('blend',{loop:{in2:'wave'}}),'');
assert.match(reason('size',{loop:{in1:'none',in2:'none'}}),/Choose an input/);
assert.equal(reason('size',{loop:{in1:'none',in2:'cubes'}}),'');
assert.match(reason('sndAmt',{audio:false}),/Share audio/);
assert.equal(reason('sndAmt',{audio:true}),'');
assert.match(reason('',{route:{effect:'none'},audio:true}),/Choose an effect/);
assert.match(reason('',{route:{effect:'spin'},audio:false}),/Share audio/);
assert.equal(reason('',{route:{effect:'spin'},audio:true}),'');
// Availability belongs to each loop, not the shared slider element's visible disabled flag.
assert.notEqual(reason('flow',{loop:{trails:0}}),reason('flow',{loop:{trails:60}}));
console.log('PASS: shader-backed feedback dependencies, non-feedback controls, second inputs, music mapping prerequisites and independent loop availability.');

assert.match(reason('videoShadowHue',{video:{videoGradient:0}}),/Gradient mix/);
assert.equal(reason('videoHighlightHue',{video:{videoGradient:40},loop:{trails:0}}),'');
assert.equal(reason('videoGamma',{loop:{trails:0},audio:false}),'','output gamma is global and needs no feedback/audio');

const {normalizeScene}=context.window.PhosphorDependencies;
const clean={in1:'cubes',in2:'none',trails:0,flow:75,warp:90,spin:-30,blur:.2,blend:60,size:100,mirror:4};
normalizeScene(clean);
for(const id of ['flow','warp','spin','blur','blend'])assert.equal(clean[id],0,id+' is neutral when prerequisite is absent');
assert.equal(clean.size,100);assert.equal(clean.mirror,4);
const feedback={in1:'wave',in2:'shape',trails:60,flow:75,spin:-30,blend:40};
normalizeScene(feedback);assert.equal(feedback.flow,75);assert.equal(feedback.spin,-30);assert.equal(feedback.blend,40);
console.log('PASS: generated scenes enforce feedback and blend prerequisites without changing independent texture controls.');
