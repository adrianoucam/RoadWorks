import {test} from 'node:test';import {strict as assert} from 'node:assert';import {readFileSync} from 'node:fs';
const base=new URL('../',import.meta.url),html=readFileSync(new URL('index.html',base),'utf8'),app=readFileSync(new URL('src/app.mjs',base),'utf8');
test('v1.4 oferece controles de simulação e importação SUMO com IDs únicos',()=>{for(const id of ['trafficPanel','tDemand','tLanes','tCapacity','tSpeed','tDetourPct','tDetourLanes','tMinutes','tImpact','tRun','trafficCanvas','tExportScenario','tImportSUMO','tSumoSummary'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id)});
test('v1.4 oferece explorador de camadas com IDs únicos',()=>{for(const id of ['layerOSM','layerTwin','layerConstruction','layerReview','layerTraffic'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id)});
test('v1.4 conecta análise a cronograma e motor de tráfego',()=>{assert.match(app,/scheduleImpact\(constructionStages,constructionDate/);assert.match(app,/trafficPreview\(conf/);assert.match(app,/validateSumoReport/)});
test('v1.4 preserva construção e vistas anteriores',()=>{assert.match(app,/renderConstructionMap/);assert.match(html,/id="viewMode"/);assert.match(html,/data-workflow="traffic"/)});
test('camadas são somente visibilidade',()=>assert.match(app,/map\.removeLayer\(layer\)/));
