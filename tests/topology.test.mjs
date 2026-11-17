import test from 'node:test';import assert from 'node:assert/strict';
import {cleanPolyline,diagnoseNetwork,snapEndpoints,repairSelectedEndpoint} from '../src/topology.mjs';
const a=[{x:0,y:0},{x:10,y:0}],b=[{x:10.6,y:.2},{x:20,y:0}];
test('Diagnóstico detecta duas extremidades próximas',()=>assert.equal(diagnoseNetwork([a,b],1).nearPairs,1));
test('Snap faz coincidir extremidades',()=>{const s=snapEndpoints([a,b],1);assert.deepEqual(s.lines[0].at(-1),s.lines[1][0]);assert.equal(s.clusters,1)});
test('Remoção de vértices duplicados',()=>assert.equal(cleanPolyline([{x:0,y:0},{x:.001,y:0},{x:3,y:0}]).length,2));
test('Reparo projeta extremidade na geometria adjacente',()=>{const r=repairSelectedEndpoint([{x:5,y:.4},{x:6,y:4}],[[{x:0,y:0},{x:10,y:0}]],1);assert.ok(r.changed);assert.equal(r.path[0].y,0)});
