import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
test('v0.5 UI contém controles de faixa, raio e manobras',()=>{for(const id of ['turnFromLane','turnToLane','turnRadius','allowLeft','allowRight','allowStraight','turnDemo','turnSummary','mTurnRadius','mTurnVehicle'])assert.match(html,new RegExp('id="'+id+'"'))});
test('v0.5 integra motor de projeto geométrico, simulação e persistência',()=>{assert.match(app,/designLaneTurn\(/);assert.match(app,/checkDesignVehicle\(/);assert.match(app,/roadworks-swept-path\/0\.5/);assert.match(app,/createTurn\(/)});
