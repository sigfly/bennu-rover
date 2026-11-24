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
 const radius=parseFloat(await page.locator('#radius').textContent());assert.ok(radius>170&&radius<310,`Unexpected radius ${radius}`);
 await page.locator('[data-mode=orbit]').click();await page.locator('[data-mode=cockpit]').click();await page.locator('[data-mode=chase]').click();
 await page.locator('#targetLat').fill('15');await page.locator('#targetLon').fill('60');await page.locator('#go').click();
 await page.waitForFunction(()=>document.querySelector('#lat').textContent.startsWith('15.0000'));
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#lat').textContent==='0.0000°');
 await page.locator('canvas').focus();await page.keyboard.down('w');
 try{await page.waitForFunction(()=>parseFloat(document.querySelector('#distance').textContent)>0.05,{},{timeout:60000});}finally{await page.keyboard.up('w');}
 await page.locator('#texture').click();assert.equal(await page.locator('#texture').textContent(),'Photo: off');
 await page.screenshot({path:'dist/smoke.png'});
 assert.deepEqual(errors,[]);console.log('Offline browser smoke test passed', {radius,distance:await page.locator('#distance').textContent()});
}finally{await browser.close();}
