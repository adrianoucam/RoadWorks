import test from 'node:test';import assert from 'node:assert/strict';
import {coordinateFrame,dist,resample,poseRectangle,simulate,evaluate} from '../src/geometry.mjs';
test('Conversão local aproxima 100m',()=>{const f=coordinateFrame(-22.9,-43.1),p=f.toXY({lat:-22.9,lng:-43.099});assert.ok(p.x>100&&p.x<104);assert.ok(Math.abs(f.toLatLng(p).lng+43.099)<1e-9)});
test('Ressample mantém extremidades',()=>{const r=resample([{x:0,y:0},{x:10,y:0}],1);assert.equal(r.length,11);assert.equal(r.at(-1).x,10)});
test('Retângulo sem rotação',()=>{const p=poseRectangle({x:0,y:0},0,5,2,1);assert.deepEqual(p[0],{x:-1,y:-1});assert.deepEqual(p[2],{x:4,y:1})});
test('Reto largo comporta veículo',()=>{const p=[{x:0,y:0},{x:100,y:0}],s=simulate(p,{length:4.5,width:1.8,wheelbase:2.7,rearOverhang:1});assert.ok(evaluate({env:s.env.slice(20,-20)},p,7).clear)});
test('Via estreita acusa envelope exterior',()=>{const p=[{x:0,y:0},{x:100,y:0}],s=simulate(p,{length:4.5,width:2.2,wheelbase:2.7,rearOverhang:1});assert.ok(!evaluate(s,p,2).clear)});
test('Articulado produz estados e ângulo de articulação em curva',()=>{const p=[{x:0,y:0},{x:20,y:0},{x:30,y:10}],v={length:6,width:2.5,wheelbase:4,rearOverhang:1,hitchOffset:1,trailer:true,trailerLength:11,trailerWidth:2.5,trailerAxleToHitch:8};const s=simulate(p,v);assert.ok(s.maxAngle>0);assert.ok(s.states.at(-1).trailer);assert.ok(Number.isFinite(s.trailerNumericalGap))});
