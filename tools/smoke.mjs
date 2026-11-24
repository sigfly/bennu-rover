import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:960,height:640}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route(/^https?:/,r=>r.abort());
 await page.goto(pathToFileURL(resolve('dist/index.html')).href,{timeout:180000,waitUntil:'load'});
 await page.waitForFunction(()=>window.BENNU_READY===true,{},{timeout:180000});
 await page.waitForFunction(()=>document.querySelector('#radius').textContent!=='—');
 assert.equal(await page.locator('button[data-mode].active').getAttribute('data-mode'),'orbit');
 assert.equal(await page.locator('#suspensionGrid progress').count(),4);
 for(let i=0;i<4;i++){const n=await page.locator('#suspension'+i).evaluate(e=>e.value);assert.ok(Number.isFinite(n)&&n>=0&&n<=100);}
 const shadowRevision=()=>page.locator('canvas').getAttribute('data-shadow-revision').then(Number);
 await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.shadowRevision)>0);
 let revision=await shadowRevision();
 await page.locator('#shadowQuality').selectOption('standard');
 await page.waitForFunction(old=>Number(document.querySelector('canvas').dataset.shadowRevision)>old,revision);
 assert.match(await page.locator('#shadowStats').textContent(),/Global/);
 // Raster regression: with the same untextured rock and grazing Sun, the live
 // depth map must alter visible terrain pixels, not merely the UI.
 revision=await shadowRevision();
 await page.locator('#texture').click();
 await page.locator('#lights').fill('75');await page.locator('#sunAltitude').fill('0');
 await page.waitForFunction(old=>Number(document.querySelector('canvas').dataset.shadowRevision)>old,revision);
 const sample=()=>page.evaluate(()=>new Promise(resolve=>{
  document.querySelector('canvas').dispatchEvent(new Event('input',{bubbles:true}));
  requestAnimationFrame(()=>{
  const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');
  // The application RAF has rendered immediately before this callback, so
  // read the actual colour buffer before the browser composites it.
  const x=Math.round(canvas.width*.29),y=Math.round(canvas.height*.24),w=Math.round(canvas.width*.31),h=Math.round(canvas.height*.53);
  const pixels=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  // Keep the serialized result small, but sample thousands of terrain pixels.
  const result=[];for(let i=0;i<pixels.length;i+=16)result.push(pixels[i],pixels[i+1],pixels[i+2]);resolve(result);
 });}));
 const shaded=await sample();
 await page.locator('#shadowQuality').selectOption('off');await page.waitForFunction(()=>document.querySelector('#shadowStats').textContent==='Cast shadows off');
 const unshaded=await sample();
 let changed=0;for(let i=0;i<shaded.length;i+=3)if(Math.abs(shaded[i]-unshaded[i])+Math.abs(shaded[i+1]-unshaded[i+1])+Math.abs(shaded[i+2]-unshaded[i+2])>24)changed++;
 console.log('Visible shadow pixels changed:',changed);
 assert.ok(changed>20,`Expected real terrain shadow pixels, got ${changed}`);
 await page.locator('#texture').click();await page.locator('#lights').fill('45');await page.locator('#sunAltitude').fill('29');
 await page.locator('#shadowQuality').selectOption('standard');await page.waitForFunction(()=>document.querySelector('#shadowStats').textContent.includes('Global'));
 
 const radius=parseFloat(await page.locator('#radius').textContent());assert.ok(radius>170&&radius<310,`Unexpected radius ${radius}`);
 await page.locator('#fossilToggle').check();await page.waitForFunction(()=>document.querySelector('#fossilPanel').hidden===false,{},{timeout:180000});assert.equal(await page.locator('#fossilCounter').textContent(),'0/20 found');
 await page.locator('#fossilExpose').click();assert.equal(await page.locator('#fossilExpose').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#fossilCounter').textContent(),'0/20 found');
 // First Fibonacci-distributed quarry is close to the initial orbit center.
 for(const [x,y] of [[480,320],[480,324],[480,316],[476,324],[484,324],[476,320],[484,320]]){await page.mouse.click(x,y);if((await page.locator('#fossilCounter').textContent())!=='0/20 found')break;}
 assert.equal(await page.locator('#fossilCounter').textContent(),'1/20 found');
 await page.locator('#fossilToggle').uncheck();assert.equal(await page.locator('#fossilPanel').isVisible(),false);
 await page.locator('#fossilToggle').check();assert.equal(await page.locator('#fossilCounter').textContent(),'1/20 found');
 await page.locator('#fossilExpose').click();assert.equal(await page.locator('#fossilExpose').getAttribute('aria-pressed'),'false');
 await page.locator('#fossilReset').click();assert.equal(await page.locator('#fossilCounter').textContent(),'0/20 found');await page.locator('#fossilToggle').uncheck();
 await page.locator('#landmarkToggle').check();await page.waitForFunction(()=>document.querySelector('#landmarkMessage').textContent.startsWith('Orbit or drive'),{},{timeout:180000});
 assert.equal(await page.locator('#landmarkCounter').textContent(),'0/20 found');
 await page.locator('#landmarkExpose').click();assert.equal(await page.locator('#landmarkExpose').getAttribute('aria-pressed'),'true');
 // The first landmark is near the initial orbital view; click the building, not its foundation.
 for(const [x,y] of [[460,315],[465,320],[470,325],[475,330],[470,315],[480,320],[455,325],[460,330],[470,335],[480,335],[490,320],[490,335]]){await page.mouse.click(x,y);if((await page.locator('#landmarkCounter').textContent())!=='0/20 found')break;}
 assert.equal(await page.locator('#landmarkCounter').textContent(),'1/20 found');
 await page.locator('#fossilToggle').check();assert.equal(await page.locator('#landmarkToggle').isChecked(),false);await page.locator('#landmarkToggle').check();assert.equal(await page.locator('#fossilToggle').isChecked(),false);assert.equal(await page.locator('#landmarkCounter').textContent(),'1/20 found');
 await page.locator('#landmarkReset').click();assert.equal(await page.locator('#landmarkCounter').textContent(),'0/20 found');await page.locator('#landmarkToggle').uncheck();
 await page.locator('[data-mode=orbit]').click();await page.locator('[data-mode=cockpit]').click();await page.waitForFunction(()=>document.querySelector('#shadowStats').textContent.includes('Local'));await page.locator('[data-mode=chase]').click();
 const suspensionBefore=await page.locator('#suspensionGrid progress').evaluateAll(es=>es.map(e=>e.value));
 await page.locator('#targetLat').fill('15');await page.locator('#targetLon').fill('60');await page.locator('#go').click();
 await page.waitForFunction(()=>document.querySelector('#lat').textContent.startsWith('15.0000'));
 await page.waitForFunction(before=>Array.from(document.querySelectorAll('#suspensionGrid progress')).some((e,i)=>Math.abs(e.value-before[i])>.1),suspensionBefore);
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#lat').textContent==='0.0000°');
 await page.locator('canvas').focus();await page.keyboard.down('w');
 try{await page.waitForFunction(()=>parseFloat(document.querySelector('#distance').textContent)>0.05,{},{timeout:60000});}finally{await page.keyboard.up('w');}
 await page.locator('#texture').click();assert.equal(await page.locator('#texture').textContent(),'Photo: off');
 await page.screenshot({path:'dist/smoke.png',timeout:120000});
 assert.deepEqual(errors,[]);console.log('Offline browser smoke test passed', {radius,distance:await page.locator('#distance').textContent()});
}finally{await browser.close();}
