import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateSwept} from '../src/swept.mjs';
const path=[{x:0,y:0},{x:100,y:0}],cell=[{x:20,y:-5},{x:22,y:-5},{x:22,y:-4},{x:20,y:-4}];
test('Corredor assimétrico distingue lado esquerdo e direito',()=>{const states=[{tractor:cell,trailer:null}],r=evaluateSwept(states,path,10,0,{sideOffsets:{left:3,right:-6}});assert.equal(r.clear,true);const r2=evaluateSwept(states,path,10,0,{sideOffsets:{left:6,right:-3}});assert.equal(r2.clear,false)});
test('Folga lateral reduz largura útil corretamente',()=>{const states=[{tractor:cell,trailer:null}],r=evaluateSwept(states,path,10,0.5,{sideOffsets:{left:3,right:-6}});assert.equal(r.clear,true);const r2=evaluateSwept(states,path,10,1.5,{sideOffsets:{left:3,right:-6}});assert.equal(r2.clear,false)});
