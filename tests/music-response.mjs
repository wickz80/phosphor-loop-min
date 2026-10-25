import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.');
const server=createServer(async(req,res)=>{
  try {
    const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
    if(!path.startsWith(root+'/')) throw Error('path');
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(path)]||'application/octet-stream');
    res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:600,height:650},serviceWorkers:'block'});
  page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    // Pin camera/time uniforms for meaningful same-scene effect comparisons.
    const names=new WeakMap(),fixed=new WeakMap(),proto=WebGL2RenderingContext.prototype;
    const get=proto.getUniformLocation;
    proto.getUniformLocation=function(program,name){const loc=get.call(this,program,name);if(loc)names.set(loc,name);return loc;};
    for(const method of ['uniform1f','uniform3f']){
      const original=proto[method];
      proto[method]=function(loc,...values){
        if(window.__cameraMoving && names.get(loc)==='uCam') window.__cameraPosition=values.slice();
        if(!window.__cameraMoving && ['uTime','uTravel','uCam','uFwd','uUp','uScale'].includes(names.get(loc))){
          if(!fixed.has(loc))fixed.set(loc,values);
          values=fixed.get(loc);
        }
        return original.call(this,loc,...values);
      };
    }
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{
      const ctx=new AudioContext(),dest=ctx.createMediaStreamDestination(),osc=ctx.createOscillator();
      osc.connect(dest);osc.start();return dest.stream;
    }});
  });
  const frames=n=>page.evaluate(n=>new Promise(resolve=>{
    let i=0;function tick(){if(++i>=n)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);
  }),n);
  await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:20000});
  // Keep the scene sampling grid fixed for pixel comparisons.
  await page.locator('#pictureSharpness').selectOption('standard');
  await page.locator('#sceneSelect').selectOption('sierpinski');
  await page.locator('#connectAudio').click();
  await page.waitForFunction(()=>document.querySelector('#sndStatus').textContent.includes('Listening to shared audio'));
  await page.evaluate(()=>{
    window.__responseEffect='none';
    const evaluate=window.PhosphorMappings.evaluate;
    window.PhosphorMappings.evaluate=(rows,env,music)=>{
      const result=evaluate(rows,{beat:0,low:0,mid:0,high:0},null);
      if(window.__responseEffect!=='none')result[window.__responseEffect]=1;
      if(window.__cameraMoving && !window.__referenceDry){
        const beat=Math.exp(-((performance.now()/1000*2)%1)*4);
        result.forward=beat;result.surface=beat*.7;result.travel=.25;
      }
      return result;
    };
  });
  await frames(120);
  const pixels=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
    const source=document.querySelector('#screen'),copy=document.createElement('canvas');
    copy.width=source.width;copy.height=source.height;
    const ctx=copy.getContext('2d');ctx.drawImage(source,0,0);
    resolve(Array.from(ctx.getImageData(0,0,copy.width,copy.height).data));
  })));
  const baseline=await pixels();
  assert.ok(baseline.some((v,i)=>i%4!==3&&v>30),'visible baseline');
  const difference=data=>data.reduce((sum,v,i)=>sum+(i%4===3?0:Math.abs(v-baseline[i])),0)/(data.length/4*3);
  for(const effect of ['warp','spin','forward','shimmer']){
    await page.evaluate(effect=>{window.__responseEffect=effect;},effect);
    await frames(120);
    const diff=difference(await pixels());
    assert.ok(diff>1,`${effect} must visibly change the rendered image, got ${diff}`);
    await page.locator('#screen').screenshot({path:`/tmp/phosphor-response-${effect}.png`});
    await page.evaluate(()=>{window.__responseEffect='none';});await frames(3);
    const neutral=difference(await pixels());
    assert.ok(neutral<.1,`${effect} must return to neutral, got ${neutral}`);
    console.log(`${effect}: mean pixel change ${diff.toFixed(2)}/255; neutral ${neutral.toFixed(3)}`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: visible maximum deformation, rotation, forward pulse and shimmer; neutral at zero.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
