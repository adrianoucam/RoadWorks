import test from 'node:test';import assert from 'node:assert/strict';
import {validateStage,validateSchedule,stageStatus,stageProgress,scheduleAt,stageGeometry,constructionCSV,scheduleBounds,scheduleWarnings,stageRibbon} from '../src/construction4d.mjs';
const a={id:'a',name:'Terraplenagem',type:'earthworks',start:'2026-12-01',end:'2026-12-10',from:0,to:100,impact:'one_lane',cost:30000};
const b={...a,id:'b',name:'Pavimentação',type:'pavement',from:60,to:150,start:'2026-12-05',end:'2026-12-13',impact:'total'};
test('valida etapa e limites',()=>{assert.equal(validateStage(a,100).to,100);assert.throws(()=>validateStage(a,90));assert.throws(()=>validateStage({...a,start:'2026-02-30'}));});
test('datas invertidas recusadas',()=>assert.throws(()=>validateStage({...a,end:'2026-11-01'})));
test('IDs duplicados recusados',()=>assert.throws(()=>validateSchedule([a,a])));
test('estados temporais',()=>{assert.equal(stageStatus(a,'2026-11-29'),'planned');assert.equal(stageStatus(a,'2026-12-03'),'active');assert.equal(stageStatus(a,'2026-12-11'),'completed')});
test('progresso por dias inclusivos',()=>{assert.equal(stageProgress(a,'2026-11-30'),0);assert.equal(stageProgress(a,'2026-12-10'),1);assert.equal(stageProgress(a,'2026-12-05'),.5)});
test('conflito de interdições simultâneas',()=>{const x=scheduleAt([a,b],'2026-12-06',{total:200});assert.equal(x.conflicts.length,1);assert.equal(x.conflicts[0].kind,'blocking-closure');assert.equal(x.conflicts[0].from,60)});
test('datas sem simultaneidade não geram conflito',()=>{assert.equal(scheduleAt([a,b],'2026-12-02',{total:200}).conflicts.length,0)});
test('geometria por estaca',()=>{const p=stageGeometry([{x:0,y:0},{x:100,y:0},{x:200,y:0}],a,{step:20});assert.equal(p[0].x,0);assert.equal(p.at(-1).x,100);assert.equal(p.length,6)});
test('CSV contém cronograma',()=>assert.match(constructionCSV([a]),/Terraplenagem/));
test('limites temporais',()=>assert.deepEqual(scheduleBounds([a,b]),{start:'2026-12-01',end:'2026-12-13'}));
test('alerta de plano de tráfego',()=>assert.equal(scheduleWarnings([a,b],200).length,1));
test('limitação de tipo e custo',()=>{assert.throws(()=>validateStage({...a,type:'unknown'}));assert.throws(()=>validateStage({...a,cost:-1}));});

test('polígono aproximado da zona de obra',()=>{const p=stageRibbon([{x:0,y:0,s:0},{x:10,y:0,s:10}],8);assert.equal(p.polygon.length,4);assert.equal(p.left[0].y,4);assert.equal(p.right[0].y,-4)});
