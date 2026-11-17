/** Optional E2E: ROADWORKS_URL=http://127.0.0.1:8765 node tools/browser_urban.cjs
 * Requires Playwright and Chromium/Edge. Writes screenshot to ROADWORKS_SCREENSHOT if set.
 * Uses a temporary API database supplied by the server's ROADWORKS_DB environment.
 */
const assert=require('node:assert/strict');
const path=require('node:path');
let playwright;
try{playwright=require('playwright')}catch{if(!process.env.PLAYWRIGHT_MODULE)throw Error('Instale playwright ou defina PLAYWRIGHT_MODULE');playwright=require(process.env.PLAYWRIGHT_MODULE)}
(async()=>{
 const browser=await playwright.chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ROADWORKS_URL||'http://127.0.0.1:8765',{waitUntil:'networkidle',timeout:60000});
  await page.locator('#uRun').waitFor();
  assert.equal(await page.locator('#uEdge option').count(),4);
  await page.locator('#uRun').click();await page.waitForFunction(()=>document.getElementById('uResult').textContent.includes('Alternativa:'),{timeout:30000});
  assert.match(await page.locator('#uResult').textContent(),/810\/810/);
  await page.locator('#dbPanel h3').click();await page.locator('#dbSave').click();await page.waitForFunction(()=>/Salvo|Sem alterações/.test(document.getElementById('dbStatus').textContent),{timeout:15000});
  await page.locator('#uCity').fill('Outra cidade piloto');await page.locator('#uCityApply').click();
  assert.match(await page.locator('#uResult').textContent(),/Estudo editado/);
  await page.locator('#dbOpen').click();await page.waitForFunction(()=>document.getElementById('uCity').value==='Niterói');
  assert.match(await page.locator('#uResult').textContent(),/Alternativa:/);
  await page.locator('#uPinBase').click();await page.locator('#uEdge').selectOption('AB');await page.locator('#uLanes').fill('3');await page.locator('#uEdgeApply').click();
  assert.equal(await page.locator('#uLanes').inputValue(),'3');assert.match(await page.locator('#uResult').textContent(),/Estudo editado/);
  await page.locator('summary').filter({hasText:'Editor completo:'}).click();await page.locator('#uEditorRefresh').click();const input=JSON.parse(await page.locator('#uJSON').inputValue());assert.equal(input.edges[0].lanes,3);
  input.settings.demandPercent=50;await page.locator('#uJSON').fill(JSON.stringify(input));await page.locator('#uEditorApply').click();assert.equal(await page.locator('#uPercent').inputValue(),'50');
  await page.locator('#uLevels').fill('-25,0,25');await page.locator('#uSaturation').click();await page.waitForFunction(()=>document.getElementById('uResult').textContent.includes('Saturação exploratória'));
  await page.locator('#uCity').fill('<img src=x onerror=alert(1)>');await page.locator('#uCityApply').click();
  assert.equal(await page.locator('#urbanPanel img').count(),0);
  await page.locator('#uCity').fill('Niterói');await page.locator('#uCityApply').click();
  await page.locator('#uRun').click();await page.waitForFunction(()=>document.getElementById('uResult').textContent.includes('Alternativa:'));
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#uReport').click()]);assert.equal(download.suggestedFilename(),'roadworks_relatorio.html');
  await page.locator('#uImport').setInputFiles(path.resolve(__dirname,'../samples/demanda_OD_FICTICIA.csv'));await page.waitForFunction(()=>document.getElementById('uODList').textContent.includes('autos:'));
  if(process.env.ROADWORKS_SUMO_RESULT){await page.locator('#uSumoImport').setInputFiles(process.env.ROADWORKS_SUMO_RESULT);await page.waitForFunction(()=>document.getElementById('uSumoResult').textContent.includes('SUMO importado:'))}
  await page.locator('#uPilot').click();await page.waitForFunction(()=>document.getElementById('uEdge').options.length===170);assert.match(await page.locator('#uNetworkInfo').textContent(),/133 nós/);await page.locator('#uRun').click();assert.match(await page.locator('#uResult').textContent(),/Cadastre ao menos uma OD/);
  await page.locator('#uExample').click();await page.locator('#uRun').click();await page.waitForFunction(()=>document.getElementById('uResult').textContent.includes('Alternativa:'));
  if(process.env.ROADWORKS_SCREENSHOT){await page.locator('#urbanPanel').scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve(process.env.ROADWORKS_SCREENSHOT),fullPage:false})}
  assert.deepEqual(errors,[]);console.log('PASS: comparação, edição, invalidação, saturação, exportação, SQLite e restauração sem eixo CAD; nenhum erro JavaScript.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
