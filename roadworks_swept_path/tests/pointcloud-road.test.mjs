import test from 'node:test';import assert from 'node:assert/strict';
import {parseClassifiedRoadCSV,measureRoadPointCloud} from '../src/pointcloud-road.mjs';
const road={id:'r1',coordinates:[[-43.1,-22.9],[-43.098,-22.9]]};
const rows=[];for(let i=0;i<80;i++){const lon=-43.1+i*.002/79;for(const offset of [-3.5,-2.5,2.5,3.5])rows.push(`${lon},${-22.9+offset/111195},30,pavimento`)}
test('leitor de nuvem ignora classes não pavimento',()=>{const r=parseClassifiedRoadCSV('longitude,latitude,z,class\n-43.1,-22.9,10,vegetation\n-43.1,-22.9,10,road');assert.equal(r.points.length,1)});
test('pontos pré-classificados associados ao eixo estimam largura',()=>{const p=parseClassifiedRoadCSV(rows.join('\n'));const m=measureRoadPointCloud(road,p.points);assert.ok(m.widthMeters>6&&m.widthMeters<8);assert.ok(m.coverage>.8);assert.equal(m.pointsUsed,320)});
test('ausência de pontos de pavimento é erro, não inventa largura',()=>{assert.throws(()=>measureRoadPointCloud(road,[{lon:-43.1,lat:-22.9,z:30}]),/insuficientes/)});
test('amostras em apenas um lado do eixo são insuficientes',()=>{const p=parseClassifiedRoadCSV(rows.filter((_,i)=>i%4>=2).join('\n'));assert.throws(()=>measureRoadPointCloud(road,p.points),/dois lados/)});
test('somente trecho curto não fornece largura confiável',()=>{const p=parseClassifiedRoadCSV(rows.slice(0,80).join('\n'));assert.throws(()=>measureRoadPointCloud(road,p.points),/35%/)});
