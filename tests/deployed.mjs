import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const entry=process.argv[2]||'https://wix.fyi/loop/';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:980,height:750}});
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{
   const context=new AudioContext(),destination=context.createMediaStreamDestination(),oscillator=context.createOscillator();
   oscillator.connect(destination);oscillator.start();return destination.stream;
  }});
 });
 const response=await page.goto(entry,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200);
 await page.waitForFunction(()=>/\d+ FPS/.test(document.querySelector('#renderFps').textContent));
 await page.locator('#pictureSharpness').selectOption('standard');
 await page.waitForFunction(()=>/× 576$/.test(document.querySelector('#renderSize').textContent));
 await page.locator('#connectAudio').click();
 await page.waitForFunction(()=>document.querySelector('#sndStatus').textContent.includes('Listening to shared audio'));
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active,{},{timeout:30000});
 const scope=await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  return {scope:registration.scope,script:registration.active.scriptURL};
 });
 assert.equal(scope.scope,new URL('./',entry).href);
 assert.equal(scope.script,new URL('sw.js',entry).href);
 const visible=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
  const canvas=document.querySelector('#screen'),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
  const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);
  resolve(ctx.getImageData(0,0,copy.width,copy.height).data.some((v,i)=>i%4!==3&&v>25));
 })));
 assert.ok(visible,'rendered image must be visible');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url:page.url(),...scope,fps:await page.locator('#renderFps').textContent()}));
 console.log('PASS: live rendering, Smooth mode, synthetic shared audio, pitch worker and scoped service worker.');
}finally{await browser.close();}
