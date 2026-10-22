const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {writeFileSync}=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const dir='docs/art/game-models/rudders';
 try{
  const page=await browser.newPage({viewport:{width:1600,height:760}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/'+dir+'/inspection.html');await page.waitForFunction(()=>window.inspectionReady);
  await page.screenshot({path:dir+'/waterline-inspection.png',fullPage:true});
  const measurements=await page.evaluate(()=>window.rudderMeasurements);
  await page.setViewportSize({width:1280,height:720});
  for(const id of ['fluyt','indiaman'])for(const quality of ['high','low']){
   await page.goto(`http://127.0.0.1:5173/models.html?view=${id}&level=3&still&night&yaw=45&boom=-45&quality=${quality}`);
   await page.waitForFunction(()=>document.querySelector('#stats').textContent.includes('triangles'));
   await page.screenshot({path:`${dir}/${id}-night-${quality}.png`});
   if(quality==='high')await page.screenshot({path:`${dir}/${id}-rear-windows.png`,clip:{x:600,y:315,width:350,height:245}});
  }
  await page.setViewportSize({width:1400,height:620});
  await page.goto('http://127.0.0.1:5173/'+dir+'/blank.html');
  await page.setContent(`<html><head><style>body{margin:0;background:#10343b;color:white;font:23px Arial}h1{font-size:28px;margin:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px}h2{font-size:22px}img{width:100%;display:block}p{margin:18px;font-size:19px;color:#c4dddd}</style></head><body><h1>Rear windows at night · both boats</h1><div class="grid">${['fluyt','indiaman'].map(id=>`<div><h2>${id==='fluyt'?'Fluyt':'Indiaman'}</h2><img src="http://127.0.0.1:5173/${dir}/${id}-rear-windows.png"></div>`).join('')}</div><p>Actual engine night captures · muted amber panes retained on High and Low</p></body></html>`);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));await page.screenshot({path:dir+'/rear-windows-night.png',fullPage:true});
  writeFileSync(dir+'/results.json',JSON.stringify({errors,measurements},null,2));console.log(JSON.stringify({errors,measurements}));if(errors.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
