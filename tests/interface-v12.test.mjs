import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),js=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
test('v1.2 expõe seção de revisão e atalhos de fluxo',()=>{for(const id of ['reviewPanel','reviewRun','reviewJSON','reviewCSV','reviewObstacleSummary','reviewPreflight','reviewFixGrade','reviewJump','reviewDistance','reviewReaction','reviewBrake'])assert.match(html,new RegExp(`id="${id}"`));assert.match(html,/data-workflow="review"/)});
test('IDs da interface são únicos',()=>{const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length)});
test('DOM do módulo de revisão corresponde à interface',()=>{for(const match of js.matchAll(/el\('(review[^']+)'\)/g))assert.ok(html.includes(`id="${match[1]}"`),match[1])});
test('exporta esquema v1.3 e mantém versões anteriores para importação',()=>{assert.match(js,/schema:'roadworks-swept-path\/1\.6'/);assert.match(js,/'roadworks-swept-path\/1\.1','roadworks-swept-path\/1\.2'/)});
