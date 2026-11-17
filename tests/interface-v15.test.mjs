import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
test('v1.5 adiciona controles persistência sem IDs duplicados',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const id of ['dbPanel','dbSave','dbOpen','dbProjects','dbRevisions','dbLoadRevision','dbAutosave','dbFork','dbStatus','dbRefresh'])assert.ok(ids.includes(id),id);
});
test('v1.5 usa API SQLite e não finge que servidor estático salva',()=>{
 assert.match(code,/fetch\('\/api'/);assert.match(code,/setInterval\(/);assert.match(code,/async function applyProjectData/);
 assert.match(code,/schema:'roadworks-swept-path\/1\.6'/);
});
