import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
  const page=await browser.newPage({viewport:{width:1366,height:768}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'})
  await page.locator('.site-hero[data-state="ready"]').waitFor({timeout:60000})
  const before=await page.evaluate(()=>window.__nocturneProbe())
  assert.ok(before.enabled,'Green particles must use GPU motion')
  const box=await page.locator('.site-hero').boundingBox()
  const x=box.x+(before.x+1)*box.width/2+24
  const y=box.y+(1-before.y)*box.height/2
  const initialFrames=await page.evaluate(()=>window.__nocturneAudit().particleControls.simulationFrames)
  await page.mouse.move(x,y,{steps:12})
  assert.equal(await page.evaluate(()=>window.__nocturneAudit().particleControls.pointerActive),1,'Pointer must reach the particles')
  await page.waitForFunction(start=>window.__nocturneAudit().particleControls.simulationFrames>=start+12,initialFrames,{timeout:120000})
  const after=await page.evaluate(()=>window.__nocturneProbe())
  const motion=Math.hypot(...after.offset.map((v,i)=>v-before.offset[i]))
  console.log('Green particle probe:',JSON.stringify({before,after,motion}))
  assert.ok(motion>.02,`Green particle displacement must be visible; measured ${motion}`)
  assert.deepEqual(errors,[],'No shader or runtime errors')
  console.log(`PASS green particle hover displacement: ${motion.toFixed(4)} world units`)
} finally {await browser.close()}
