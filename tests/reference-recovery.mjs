import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.');
const server=createServer(async(req,res)=>{try{
  const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
  if(!path.startsWith(root+'/'))throw Error('path');
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(path)]||'application/octet-stream');
  res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const mode of ['stale-camera','stale-shader','camera-error','shader-error','normal']){
    const page=await browser.newPage({serviceWorkers:'block',viewport:{width:600,height:650}});page.setDefaultTimeout(5000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(mode=>localStorage.setItem('phosphor-min-last-v1',JSON.stringify({look:{A:{in1:mode.endsWith('error')?'mercury':'cameraSphere'},B:{in1:mode.endsWith('error')?'cavern':'cameraCube'}}})),mode);
    if(['stale-camera','camera-error'].includes(mode)){
      await page.route('**/js/fractal-math.js*',async route=>{
        let body=await readFile(resolve(root,'js/fractal-math.js'),'utf8');
        body=mode==='stale-camera'?body.replace('return { FR, makeDrone, makeSurfaceCamera };','return { FR, makeDrone };')
          :body.replace('function makeSurfaceCamera(de, seed = 1, options = {}) {',"function makeSurfaceCamera(de, seed = 1, options = {}) { throw new Error('Simulated camera startup failure');");
        await route.fulfill({contentType:'text/javascript',body});
      });
    }
    if(['stale-shader','shader-error'].includes(mode)){
      await page.route('**/js/shaders.js*',async route=>{
        let body=await readFile(resolve(root,'js/shaders.js'),'utf8');
        body=mode==='stale-shader'?body.replace('return { FS_CAMERA_SPHERE, FS_CAMERA_CUBE,','return {')
          :body.replace('return { FS_CAMERA_SPHERE, FS_CAMERA_CUBE,',"return { FS_CAMERA_SPHERE: '#version 300 es\\nINVALID SHADER', FS_CAMERA_CUBE,");
        await route.fulfill({contentType:'text/javascript',body});
      });
    }
    await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:20000});
    const frames=n=>page.evaluate(n=>new Promise(resolve=>{let i=0;function tick(){if(++i>=n)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}),n);
    await frames(10);
    await page.locator('#renderQuality').selectOption('0.5');
    if(mode.startsWith('stale')){
      assert.equal(await page.locator('#sceneSelect option[value="cameraSphere"]').count(),0);
      assert.equal(await page.locator('#sceneSelect').inputValue(),'mercury','saved unavailable test scene falls back');
    }else if(mode==='normal'){
      for(const scene of ['cameraSphere','cameraCube']){
        await page.locator('#sceneSelect').selectOption(scene);await frames(30);
        assert.equal(await page.locator('#sceneSelect').inputValue(),scene);
      }
    }else{
      await page.locator('#sceneSelect').selectOption('cameraSphere');await frames(10);
      assert.equal(await page.locator('#sceneSelect').inputValue(),'mercury','failed scene recovers');
      assert.equal(await page.locator('#sceneSelect option[value="cameraSphere"]').isDisabled(),true);
    }
    await page.locator('#freeze').click();assert.equal(await page.locator('#freeze').getAttribute('aria-pressed'),'true');
    await page.locator('#freeze').click();await frames(3);
    const visible=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
      const source=document.querySelector('#screen'),copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
      const ctx=copy.getContext('2d');ctx.drawImage(source,0,0);
      resolve(ctx.getImageData(0,0,copy.width,copy.height).data.some((value,i)=>i%4!==3&&value>25));
    })));
    assert.ok(visible,'rendered image is not black: '+mode);
    assert.deepEqual(errors,[],'no render-loop exceptions: '+mode);
    console.log('PASS: '+mode+'; saved look loads, frames continue, controls respond.');
    await page.close();
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
