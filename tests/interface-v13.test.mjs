import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const html=read('index.html'),app=read('src/app.mjs'),viz=read('src/visualizer.mjs');
test('v1.3 possui controles de cronograma únicos',()=>{for(const id of ['constructionPanel','cName','cType','cStart','cEnd','cImpact','cFrom','cTo','cAdd','cDemo','cDate','cTimeline','cPrev','cNext','cPlay','cSummary','cStageList','cWarnings','cExport','cJSON'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id)});
test('v1.3 expõe navegação 4D',()=>assert.match(html,/data-workflow="construction"/));
test('v1.3 mantém versão e importação antiga',()=>{assert.match(app,/schema:'roadworks-swept-path\/1\.6'/);assert.match(app,/'roadworks-swept-path\/1\.2','roadworks-swept-path\/1\.3'/)});
test('v1.3 integra obras nas vistas CAD',()=>{assert.match(app,/construction:el\('cVisible'\)/);assert.match(viz,/model\.construction/);assert.match(app,/function renderConstructionMap/)});
test('v1.3 exporta cronograma separado e preserva projeto',()=>{assert.match(app,/construction4D:\{stages:constructionStages/);assert.match(app,/constructionCSV\(constructionStages\)/)});
