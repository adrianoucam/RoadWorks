import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
const html=read('index.html'),app=read('src/app.mjs'),viz=read('src/visualizer.mjs');
test('v0.7 contém controles de geração e exportação',()=>{for(const id of ['corridorBuild','corridorStep','corridorEnable','corridorOBJ','corridorCSV','mCorridorArea','mCorridorTriangles'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id)});
test('v0.7 exporta malha local OBJ e amostras CSV',()=>{assert.match(app,/corridorOBJ\(c\)/);assert.match(app,/corridorSectionsCSV\(c\)/);assert.match(app,/corridorConfig:/)});
test('v0.7 preserva leitura de projetos anteriores',()=>{for(const ver of ['0.1','0.2','0.4','0.5','0.6','0.7'])assert.ok(app.includes(`roadworks-swept-path/${ver}`))});
test('v0.7 integra malha com vista 3D existente',()=>{assert.match(viz,/if\(model\.corridor\)/);assert.match(viz,/trianglesByBand/);assert.match(app,/corridor:el\('corridorEnable'\)/)});
