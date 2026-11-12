import test from 'node:test';import assert from 'node:assert/strict';
import {sectionLayout,sectionGeometry,validateSection,SECTION_PRESETS} from '../src/roadmodel.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('Seção rural simples calcula largura e 2 faixas',()=>{const x=sectionLayout(SECTION_PRESETS.rural_two);close(x.platformWidth,10.5);assert.equal(x.lanes.length,2)});
test('Seção pista dupla cria 4 faixas e canteiro',()=>{const x=sectionLayout(SECTION_PRESETS.rural_dual);assert.equal(x.lanes.length,4);close(x.platformWidth,20.5);close(x.innerLeft,1)});
test('Bordas da plataforma são offsets corretos',()=>{const g=sectionGeometry([{x:0,y:0},{x:100,y:0}],SECTION_PRESETS.rural_two);close(g.boundaries.left[0].y,5);close(g.boundaries.right[0].y,-5.5);close(g.lanes[0].width,3.5)});
test('Validação recusa largura irreal e muitas faixas',()=>{assert.throws(()=>validateSection({...SECTION_PRESETS.rural_two,laneWidth:0.5}));assert.throws(()=>sectionLayout({...SECTION_PRESETS.rural_two,lanesPerDirection:8}))});

test('Acostamentos assimétricos preservam margens',()=>{const s=sectionLayout({...SECTION_PRESETS.rural_two,shoulderLeft:0,shoulderRight:3});close(s.leftEdge,3.5);close(s.rightEdge,-6.5)});
