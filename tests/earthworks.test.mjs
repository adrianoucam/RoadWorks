import test from 'node:test';import assert from 'node:assert/strict';
import {generateCorridor} from '../src/corridor.mjs';import {terrainFromGrid} from '../src/terrain.mjs';
import {signedAreas,earthworkSection,calculateEarthworks,earthworksCSV,earthworksSectionCSV,earthworksOBJ} from '../src/earthworks.mjs';
const section={lanesPerDirection:1,laneWidth:3.5,shoulderLeft:1.5,shoulderRight:1.5,median:0};
const corridor=()=>generateCorridor({path:[{x:10,y:20},{x:110,y:20}],profile:{startElevation:25,startGradePercent:0,pvis:[]},section,step:10,crossfallPercent:0});
function plane(z){return terrainFromGrid({width:20,height:20,values:Array(400).fill(z),originX:0,originY:0,dx:10,dy:10})}
const approx=(a,b,tol=.01)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
test('Áreas de corte e aterro tratam troca de sinal exatamente',()=>{const r=signedAreas([{u:0,d:-2},{u:2,d:2}]);approx(r.cut,1);approx(r.fill,1)});
test('Aterro plano fecha talude H:V 2:1 e volume coerente',()=>{const r=calculateEarthworks(corridor(),plane(23),{fillHV:2,cutHV:1.5,lateralStep:.5});approx(r.fillM3,100*(20+8),.01);approx(r.cutM3,0);approx(r.sections[0].rightDaylight.reach,4);assert.equal(r.sections.length,11)});
test('Corte plano fecha talude H:V 1.5:1 e volume coerente',()=>{const r=calculateEarthworks(corridor(),plane(27),{fillHV:2,cutHV:1.5,lateralStep:.5});approx(r.cutM3,100*(20+6),.01);approx(r.fillM3,0);approx(r.sections[0].leftDaylight.reach,3)});
test('Terreno plano coincidindo com greide gera volume zero',()=>{const r=calculateEarthworks(corridor(),plane(25));approx(r.cutM3,0);approx(r.fillM3,0)});
test('Terreno que muda de cota sinaliza corte e aterro',()=>{const ground=terrainFromGrid({width:20,height:20,values:Array.from({length:400},(_,k)=>23+4*(k%20)/19),originX:0,originY:0,dx:10,dy:10});const r=calculateEarthworks(corridor(),ground);assert.ok(r.cutM3>0);assert.ok(r.fillM3>0)});
test('Ausência de cobertura de borda ou talude aborta volume',()=>{const tiny=terrainFromGrid({width:2,height:2,values:[22,22,22,22],originX:0,originY:0,dx:1,dy:1});assert.throws(()=>calculateEarthworks(corridor(),tiny),/cobertura/)});
test('Limite de talude não atingido gera erro específico',()=>assert.throws(()=>calculateEarthworks(corridor(),plane(23),{fillHV:2,maxReach:1}),/não encontra terreno/));
test('CSV de segmentos e seções inclui todas as linhas',()=>{const e=calculateEarthworks(corridor(),plane(23));assert.equal(earthworksCSV(e).trim().split('\n').length,11);assert.equal(earthworksSectionCSV(e).trim().split('\n').length,12)});
test('OBJ de taludes possui faces e vértices com cota',()=>{const e=calculateEarthworks(corridor(),plane(23));const obj=earthworksOBJ(e);assert.match(obj,/g rightDaylight/);assert.match(obj,/^v /m);assert.equal((obj.match(/^f /gm)||[]).length,40)});
