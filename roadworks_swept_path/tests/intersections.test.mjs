import test from 'node:test';import assert from 'node:assert/strict';
import {segmentCrossing,findCrossings,turnConnector,crossingTurn} from '../src/intersections.mjs';
test('Interseção ortogonal encontra o ponto esperado',()=>{const p=segmentCrossing({x:-10,y:0},{x:10,y:0},{x:0,y:-10},{x:0,y:10});assert.ok(p);assert.equal(p.x,0);assert.equal(p.y,0)});
test('Linhas paralelas sem cruzamento',()=>assert.equal(findCrossings([{x:0,y:0},{x:10,y:0}],[{x:0,y:2},{x:10,y:2}]).length,0));
test('Conector Hermite mantém extremos',()=>{const a={point:{x:0,y:0},heading:{x:1,y:0}},b={point:{x:20,y:20},heading:{x:0,y:1}};const p=turnConnector(a,b);assert.deepEqual(p[0],a.point);assert.deepEqual(p.at(-1),b.point)});
test('Duas vias cruzadas produzem conversão',()=>{const p=crossingTurn([{x:-50,y:0},{x:50,y:0}],[{x:0,y:-50},{x:0,y:50}]);assert.equal(p.connector.length,37)});
