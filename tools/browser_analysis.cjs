/** Optional E2E against a QA database: same environment as browser_urban.cjs. */
const assert=require('node:assert/strict');const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},ignoreHTTPSErrors:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ROADWORKS_URL||'http://127.0.0.1:8765',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#aDemo').waitFor();
 await page.locator('#aDemo').click();await page.waitForFunction(()=>document.getElementById('aDemandData').value.includes('synthetic'));
 await page.locator('#aSensitivity').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('Sensibilidade concluída'));
 assert.match(await page.locator('#aResult').textContent(),/capacityScale/);
 await page.locator('#analysisPanel summary').filter({hasText:'Calibração assistida'}).click();await page.locator('#aCalibrate').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('Calibração assistida concluída'));
 assert.match(await page.locator('#aResult').textContent(),/0,8/);await page.locator('#aApplyCalibration').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('Sugestão aplicada'));
 await page.locator('#uEdge').selectOption('AB');assert.equal(await page.locator('#uCapacity').inputValue(),'960');
 await page.locator('#aApplyCalibration').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('O estudo mudou'));
 await page.locator('#analysisPanel summary').filter({hasText:'Demanda por horário:'}).click();await page.locator('#aTrain').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('Modelo de demanda concluída'));
 assert.match(await page.locator('#aResult').textContent(),/Superou/);await page.locator('#aForecast').click();assert.match(await page.locator('#aForecastResult').textContent(),/veíc.\/h/);
 await page.locator('#aForecastTime').fill('2026-11-13T08:00:00-03:00');await page.locator('#aApplyForecast').click();assert.match(await page.locator('#aMessage').textContent(),/Recalcule/);await page.locator('#aForecast').click();
 await page.locator('#analysisPanel summary').filter({hasText:'Ajuste não negativo'}).click();await page.locator('#aFitOD').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('Ajuste OD concluída'));assert.match(await page.locator('#aResult').textContent(),/não identificáveis/);
 await page.locator('#aApplyOD').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('Taxas OD sugeridas aplicadas'));
 await page.locator('#analysisPanel summary').filter({hasText:'Padrões de cenários:'}).click();await page.locator('#aPCA').click();await page.waitForFunction(()=>document.getElementById('aMessage').textContent.includes('PCA concluída'));
 await page.locator('#dbPanel h3').click();await page.locator('#dbSave').click();await page.waitForFunction(()=>/Salvo|Sem alterações/.test(document.getElementById('dbStatus').textContent));
 const previous=await page.locator('#aDemandData').inputValue();await page.locator('#aDemandData').fill('{}');await page.locator('#dbOpen').click();await page.waitForFunction(()=>document.getElementById('aDemandData').value.includes('roadworks-demand-history'));
 assert.equal(await page.locator('#aDemandData').inputValue(),previous);assert.match(await page.locator('#aResult').textContent(),/Variância explicada/);
 const [report]=await Promise.all([page.waitForEvent('download'),page.locator('#aReport').click()]);assert.equal(report.suggestedFilename(),'roadworks_analise_v18.html');
 const [json]=await Promise.all([page.waitForEvent('download'),page.locator('#aExport').click()]);assert.equal(json.suggestedFilename(),'roadworks_analises_v18.json');
 await page.locator('#aSensitivity').click();await page.locator('#aCancel').click();assert.match(await page.locator('#aMessage').textContent(),/cancelada/);
 if(process.env.ROADWORKS_SCREENSHOT){await page.getByRole('button',{name:'10 · Matemática e ML',exact:true}).click();await page.screenshot({path:path.resolve(process.env.ROADWORKS_SCREENSHOT)})}
 assert.deepEqual(errors,[]);console.log('PASS: sensibilidade, calibração/aplicação, rejeição de resultado antigo, regressão/teste temporal, previsão, OD, PCA, cancelamento, relatórios e SQLite.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
