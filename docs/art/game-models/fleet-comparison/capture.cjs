const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:2940,height:1183},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/docs/art/game-models/fleet-comparison/comparison.html');
  await page.waitForFunction(()=>window.comparisonReady,{},{timeout:60000});
  await page.screenshot({path:'docs/art/game-models/fleet-review/before-and-after.png',fullPage:true});
  console.log(JSON.stringify({errors,image:'docs/art/game-models/fleet-review/before-and-after.png'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
