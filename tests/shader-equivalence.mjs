import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const baseline=process.env.SHADER_BASELINE?await readFile(process.env.SHADER_BASELINE,'utf8'):execFileSync('git',['show','HEAD:js/shaders.js'],{encoding:'utf8'});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage();
 await page.goto('about:blank');
 await page.addScriptTag({path:'js/fractal-math.js'});await page.addScriptTag({path:'js/shaders.js'});
 const results=await page.evaluate(baseline=>{
  const previous={PhosphorFractals:window.PhosphorFractals};new Function('window',baseline)(previous);
  const old=previous.PhosphorShaders,current=window.PhosphorShaders,{FR,makeDrone}=window.PhosphorFractals;
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=225;
  const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});
  function compile(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
  function program(source){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,current.VS));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,source));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
  const results=[];window.__shaderPreviews=[];
  for(const [scene,de,near] of [['FS_MERCURY'],['FS_SPONGE',FR.sponge,.0025],['FS_BULB',FR.bulb,.004],['FS_MANDELBOX',FR.box,.003],['FS_SIERPINSKI',FR.pyramid,.003],['FS_JULIA',FR.julia,.004],['FS_KALEIDO',FR.kaleido,.008]]){
   const programs=[program(old[scene]),program(current[scene])];
   for(const time of [0,13,35,55]){
    const dr=de?makeDrone(de,1,{start:3.2,roam:2.2,size:1.2,far:.45,near,dive:70,speed:.55,phase0:0}):null;
    if(dr)dr.fly(time);
    const images=[programs[0],programs[1],programs[1]].map((p,variant)=>{
     gl.useProgram(p);gl.viewport(0,0,canvas.width,canvas.height);
     const one=(name,value)=>gl.uniform1f(gl.getUniformLocation(p,name),value);
     const three=(name,value)=>gl.uniform3fv(gl.getUniformLocation(p,name),value);
     gl.uniform2f(gl.getUniformLocation(p,'uSim'),canvas.width,canvas.height);
     for(const [name,value] of Object.entries({uTime:time,uTravel:time*.12,uLens:.4,uGlow:1.6,uSeed:0,uSceneQuality:variant===2?0:1,uScale:dr?.scale||1}))one(name,value);
     gl.uniform2f(gl.getUniformLocation(p,'uMusicColor'),.3,time===13?.6:0);
     if(dr){three('uCam',dr.p);three('uFwd',dr.look);three('uUp',dr.up);}
     if(scene==='FS_MERCURY'){
      const drops=new Float32Array(28);let bound=0;const t=time*.45,swell=1+.18*.6;
      for(let i=0;i<7;i++){const x=1.5*Math.sin(t*(.53+.11*i)+i*1.7),y=.9*Math.sin(t*(.71+.07*i)+i*2.9),z=1.5*Math.cos(t*(.47+.13*i)+i*.9),r=(.55+.3*((i*.618)%1))*swell;drops.set([x,y,z,r],i*4);bound=Math.max(bound,Math.hypot(x,y,z)+r);}
      gl.uniform4fv(gl.getUniformLocation(p,'uDrops[0]'),drops);one('uDropRadius',bound+6*.75/4+.01);
     }
     gl.drawArrays(gl.TRIANGLES,0,3);const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error in '+scene);return pixels;
    });
    let total=0,lit=0;for(let i=0;i<images[0].length;i++)if(i%4!==3){total+=Math.abs(images[0][i]-images[1][i]);if(images[1][i]>25)lit++;}
    if(time===35 && ['FS_MERCURY','FS_BULB','FS_MANDELBOX'].includes(scene)) {
      const preview=document.createElement('canvas');preview.width=canvas.width*2;preview.height=canvas.height;
      const ctx=preview.getContext('2d');
      for(let i=0;i<2;i++){
        const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
        layer.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(images[i+1]),canvas.width,canvas.height),0,0);
        ctx.save();ctx.translate(i*canvas.width,canvas.height);ctx.scale(1,-1);ctx.drawImage(layer,0,0);ctx.restore();
      }
      window.__shaderPreviews.push({scene,data:preview.toDataURL('image/png')});
    }
    let smoothLit=0;for(let i=0;i<images[2].length;i++)if(i%4!==3&&images[2][i]>25)smoothLit++;
    results.push({scene,time,meanError:total/(canvas.width*canvas.height*3),lit,smoothLit});
   }
   programs.forEach(p=>gl.deleteProgram(p));
  }
  return results;
 },baseline);
 for(const result of results){assert.ok(result.meanError<.8,JSON.stringify(result));assert.ok(result.lit>100 && result.smoothLit>100,JSON.stringify(result));console.log(JSON.stringify(result));}
 if(process.env.SHADER_PREVIEW_DIR){
  await mkdir(process.env.SHADER_PREVIEW_DIR,{recursive:true});
  for(const {scene,data} of await page.evaluate(()=>window.__shaderPreviews))await writeFile(resolve(process.env.SHADER_PREVIEW_DIR,scene+'.png'),Buffer.from(data.split(',')[1],'base64'));
 }
 console.log('PASS: Full-detail shaders preserve geometry/color across seven scenes and four camera/time samples, including deeper dives.');
}finally{await browser.close();}
