import test from 'node:test';import assert from 'node:assert/strict';
import {heuristicRoadMask,imageTensor,logitsToMask,overlayMask,maskToGeoJSON} from '../src/image-segmentation.mjs';
test('Baseline separa cinza neutro de verde saturado sem afirmar IA',()=>{const r=heuristicRoadMask(new Uint8Array([100,100,100,255,20,170,40,255]),2,1);assert.deepEqual([...r.mask],[1,0]);assert.equal(r.neural,false)});
test('Entrada CHW ONNX é normalizada e tem dimensões exatas',()=>{const t=imageTensor(new Uint8Array([255,0,0,255]),1,1);assert.deepEqual(t.dims,[1,3,1,1]);assert.ok(t.data[0]>0)});
test('Logits da classe road produzem máscara neural explícita',()=>{const r=logitsToMask(new Float32Array([4,1,0,5]),[1,2,1,2],1);assert.deepEqual([...r.mask],[0,1]);assert.equal(r.neural,true);assert.equal(r.coverage,.5)});
test('Máscara invalida rejeitada',()=>assert.throws(()=>logitsToMask(new Float32Array([2]),[1,2,1,2],1)));
test('Overlay é vermelho/verde com alfa sem modificar buffer original',()=>{const a=new Uint8ClampedArray([0,0,0,255]);const o=overlayMask(a,new Uint8Array([1]));assert.ok(o[1]>0);assert.equal(a[1],0)});
test('Células de máscara exportadas com indicação de incerteza',()=>{const g=maskToGeoJSON(new Uint8Array(16).fill(1),4,4,{west:-43.2,east:-43.1,south:-23,north:-22.9},{cell:2});assert.equal(g.features.length,4);assert.match(g.features[0].properties.warning,/revisão/)});
