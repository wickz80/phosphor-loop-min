import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

// SHADER_BASELINE can point to main's shaders.js to verify the port pixel for pixel.
// Without it this checks compilation and visible output across camera/time samples.
const baseline = process.env.SHADER_BASELINE ? await readFile(process.env.SHADER_BASELINE,'utf8') : null;
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({path:'js/fractal-math.js'});
  await page.addScriptTag({path:'js/shaders.js'});
  const results = await page.evaluate(baseline => {
    const current = window.PhosphorShaders, {FR,makeDrone} = window.PhosphorFractals;
    const previous = {PhosphorFractals:window.PhosphorFractals};
    if (baseline) new Function('window',baseline)(previous);
    const canvas = document.createElement('canvas');canvas.width=400;canvas.height=225;
    const gl = canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});
    if (!gl) throw Error('WebGL 2 unavailable');
    function compile(type, source) {
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    function program(source) {
      const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,current.VS));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,source));gl.linkProgram(p);
      if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
      return p;
    }
    // Check actual output pixels: grading defaults must preserve the composite.
    const display=program(current.FS_DISPLAY), tex=gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([64,128,192,255]));
    function displayPixel({basic=[1,0,1,1],color=[0,0,0,0],rgb=[1,1,1]}={}) {
      gl.useProgram(display);gl.viewport(0,0,canvas.width,canvas.height);
      gl.uniform1i(gl.getUniformLocation(display,'uTex'),0);
      gl.uniform2f(gl.getUniformLocation(display,'uRes'),canvas.width,canvas.height);
      gl.uniform4fv(gl.getUniformLocation(display,'uGradeBasic'),basic);
      gl.uniform4fv(gl.getUniformLocation(display,'uGradeColor'),color);
      gl.uniform3fv(gl.getUniformLocation(display,'uGradeRGB'),rgb);
      gl.uniform2f(gl.getUniformLocation(display,'uGradeHues'),220/360,40/360);
      gl.drawArrays(gl.TRIANGLES,0,3);
      const pixel=new Uint8Array(4);gl.readPixels(200,112,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      if(gl.getError()!==gl.NO_ERROR)throw Error('Global video grading WebGL error');
      return [...pixel];
    }
    const neutral=displayPixel();
    if(neutral.slice(0,3).some((value,i)=>Math.abs(value-[64,128,192][i])>1))throw Error('Neutral grading changed the image: '+neutral);
    const gamma=displayPixel({basic:[2,0,1,1]});
    if(!gamma.slice(0,3).every((value,i)=>value>neutral[i]))throw Error('Gamma did not brighten midtones');
    const gray=displayPixel({basic:[1,0,1,0]});
    if(Math.max(...gray.slice(0,3))-Math.min(...gray.slice(0,3))>1)throw Error('Saturation zero is not grayscale');
    const sepia=displayPixel({color:[0,1,0,0]});
    if(!(sepia[0]>sepia[1]&&sepia[1]>sepia[2]))throw Error('Sepia filter is not warm');
    const noRed=displayPixel({rgb:[0,1,1]});if(noRed[0]!==0)throw Error('Red gain zero failed');
    const gradient=displayPixel({color:[0,0,1,0]});
    if(gradient.slice(0,3).every((value,i)=>value===neutral[i]))throw Error('Gradient recoloring failed');
    gl.deleteProgram(display);gl.deleteTexture(tex);
    // Feedback must compile with the restored resolution-independent effects uniform too.
    for (const name of ['FS_FEEDBACK','FS_COMPOSITE','FS_TIMEWARP','FS_DISPLAY']) gl.deleteProgram(program(current[name]));
    const scenes = [
      ...['CUBES','HORIZON','CAVERN','BLACKHOLE','AURORA','MERCURY','FRACTAL','NEBULA','CITY'].map(name=>['FS_'+name]),
      ['FS_SPONGE',FR.sponge,.0025],['FS_BULB',FR.bulb,.004],['FS_MANDELBOX',FR.box,.003],
      ['FS_SIERPINSKI',FR.pyramid,.003],['FS_JULIA',FR.julia,.004],['FS_KALEIDO',FR.kaleido,.008],
    ];
    const results=[];
    for (const [name,de,near] of scenes) {
      const sources=[current[name],...(baseline?[previous.PhosphorShaders[name]]:[])];
      const programs=sources.map(program);
      for (const time of [0,13,35,55]) {
        const drone=de?makeDrone(de,1,{start:3.2,roam:2.2,size:1.2,far:.45,near,dive:70,speed:.55,phase0:0}):null;
        drone?.fly(time,{style:'glide',drive:0});
        const images=programs.map(p=>{
          gl.useProgram(p);gl.viewport(0,0,canvas.width,canvas.height);
          const one=(name,value)=>gl.uniform1f(gl.getUniformLocation(p,name),value);
          gl.uniform2f(gl.getUniformLocation(p,'uSim'),canvas.width,canvas.height);
          for (const [name,value] of Object.entries({uTime:time,uTravel:time*.12,uLens:.4,uGlow:1.6,uSeed:0,uScale:drone?.scale||1})) one(name,value);
          gl.uniform2f(gl.getUniformLocation(p,'uMusicColor'),0,0);
          if (drone) for(const [name,value] of [['uCam',drone.view||drone.p],['uFwd',drone.look],['uUp',drone.up]]) gl.uniform3fv(gl.getUniformLocation(p,name),value);
          gl.drawArrays(gl.TRIANGLES,0,3);
          const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          if (gl.getError()!==gl.NO_ERROR) throw Error('WebGL error in '+name);
          return pixels;
        });
        let lit=0,difference=0;
        for(let i=0;i<images[0].length;i++) if(i%4!==3) {
          if(images[0][i]>25)lit++;
          if(baseline)difference+=Math.abs(images[0][i]-images[1][i]);
        }
        results.push({name,time,lit,meanError:baseline?difference/(canvas.width*canvas.height*3):null});
      }
      programs.forEach(p=>gl.deleteProgram(p));
    }
    return results;
  },baseline);
  for (const result of results) {
    assert.ok(result.lit>100,JSON.stringify(result));
    if (baseline) assert.ok(result.meanError<.8,JSON.stringify(result));
    console.log(JSON.stringify(result));
  }
  console.log(`PASS: shader compilation and visible output for 15 scenes at four camera/time samples${baseline?', compared against supplied baseline':''}.`);
} finally { await browser.close(); }
