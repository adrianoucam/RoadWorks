import test from 'node:test';import assert from 'node:assert/strict';
import {extent,viewport,steerEstimate,vehicleWheels} from '../src/visualizer.mjs';
import {poseRectangle} from '../src/geometry.mjs';
test('Enquadramento 2D mantém proporções métricas e sentido Y vertical',()=>{const path=[{x:0,y:0},{x:100,y:100}];const {project,scale}=viewport(path,400,400);const a=project(path[0]),b=project(path[1]);assert.ok(scale>0);assert.ok(Math.abs((b.x-a.x)+(b.y-a.y))<1e-8);assert.ok(b.y<a.y)});
test('Extensão métrica identifica centro e distância máxima',()=>{const e=extent([{x:-20,y:10},{x:80,y:30}]);assert.equal(e.cx,30);assert.equal(e.cy,20);assert.equal(e.span,100)});
test('Estimativa de esterçamento nula para veículo seguindo trajetória reta',()=>{const states=[0,1,2].map(x=>({p:{x,y:0},theta:0}));assert.ok(Math.abs(steerEstimate(states,1,3))<1e-10)});
test('Representação das rodas mantém quatro rodas do trator',()=>{const state={p:{x:0,y:0},theta:0,tractor:poseRectangle({x:0,y:0},0,6,2,1),trailer:null};const wheels=vehicleWheels(state,{width:2,wheelbase:3},0);assert.equal(wheels.length,4);assert.equal(wheels[2].p.x,3)});
