import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {trafficPreview,validateTrafficConfig,scheduleImpact,buildTrafficScenario,validateSumoReport,impactLanes,previewCSV} from '../src/traffic.mjs';
const c={demandVph:1800,baseLanes:2,capacityPerLane:1500,freeSpeedKmh:60,lengthM:1000,detourLengthFactor:1.5,detourLanes:1,detourFraction:0.4,minutes:30,stepSeconds:10,vehicleSpaceM:7};
test('sem obras fila baixa em capacidade superior à demanda',()=>{assert.ok(trafficPreview(c).unserved<1e-7)});
test('fechar faixa causa fila se demanda exceder capacidade',()=>{assert.ok(trafficPreview({...c,detourFraction:0},{impact:'one_lane'}).unserved>0)});
test('desvio de parte da demanda reduz fila da via principal',()=>{const a=trafficPreview({...c,detourFraction:0},{impact:'one_lane'});const b=trafficPreview(c,{impact:'one_lane'});assert.ok(b.unserved<a.unserved)});
test('interdição total força todo fluxo ao desvio',()=>{const r=trafficPreview(c,{impact:'total'});assert.equal(r.lanesOpen,0);assert.equal(r.detourShare,1)});
test('conservação de veículos',()=>{for(const impact of ['none','one_lane','total']){const r=trafficPreview(c,{impact});assert.ok(Math.abs(r.arrivals-r.completed-r.unserved)<1e-7)}});
test('série começa no primeiro instante e termina no final',()=>{const r=trafficPreview(c);assert.equal(r.series.at(-1).minute,30)});
test('demanda nula gera atraso zero',()=>{const r=trafficPreview({...c,demandVph:0});assert.equal(r.maxQueueVehicles,0);assert.equal(r.meanQueueDelayMinutesPerArrival,0)});
test('sem divisão por zero em taxa',()=>{assert.throws(()=>validateTrafficConfig({...c,stepSeconds:0}),/stepSeconds/)});
test('capacidade de faixa residual não negativa',()=>{assert.equal(impactLanes('one_lane',1),0)});
test('datas e estacas selecionam interdição ativa',()=>{assert.equal(scheduleImpact([{id:'a',start:'2026-12-01',end:'2026-12-05',from:10,to:30,impact:'total'}],'2026-12-02',20,21).impact,'total')});
test('fases fora do trecho não afetam capacidade',()=>{assert.equal(scheduleImpact([{id:'a',start:'2026-12-01',end:'2026-12-05',from:500,to:900,impact:'total'}],'2026-12-02',0,200).impact,'none')});
test('cenário exportado possui contrato SUMO',()=>{assert.equal(buildTrafficScenario(c,[],'2026-12-02').schema,'roadworks-traffic-sumo/1.4')});
test('resultados falsos são rejeitados',()=>{assert.throws(()=>validateSumoReport({schema:'roadworks-traffic-sumo-result/1.4',baseline:{},work:{}}))});
test('CSV inclui minuto e fila',()=>{assert.match(previewCSV(trafficPreview(c)),/fila_total_veic/)});

test('pista de uma única faixa fechada deve forçar todo fluxo ao desvio',()=>{assert.equal(trafficPreview({...c,baseLanes:1},{impact:'one_lane'}).detourShare,1)});
