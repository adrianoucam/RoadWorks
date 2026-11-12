// RoadWorks v1.4 — deterministic first-order link queue PREVIEW; NOT a microscopic traffic model.
// Each one-minute step conserves arrivals, discharges and accumulated vehicles. SUMO results are separate.
export function validateTrafficConfig(c){
 const n=(k,min,max)=>{const v=Number(c[k]);if(!Number.isFinite(v)||v<min||v>max)throw Error(`Parâmetro de tráfego inválido: ${k} (${min}–${max})`);return v};
 const out={demandVph:n('demandVph',0,15000),baseLanes:n('baseLanes',1,8),capacityPerLane:n('capacityPerLane',300,2400),freeSpeedKmh:n('freeSpeedKmh',10,130),lengthM:n('lengthM',30,30000),detourLengthFactor:n('detourLengthFactor',1.05,5),detourLanes:n('detourLanes',1,8),detourFraction:n('detourFraction',0,1),minutes:n('minutes',10,360),stepSeconds:n('stepSeconds',1,60),vehicleSpaceM:n('vehicleSpaceM',5,15)};
 if(out.minutes*60/out.stepSeconds>25000)throw Error('Passos demais');
 return out;
}
export function impactLanes(impact,baseLanes){if(impact==='total')return 0;if(impact==='one_lane')return Math.max(0,baseLanes-1);return baseLanes}
export function trafficPreview(config,{impact='none'}={}){
 const c=validateTrafficConfig(config);if(!['none','shoulder','one_lane','total'].includes(impact))throw Error('Interdição desconhecida');
 const mainLanes=impactLanes(impact,c.baseLanes);
 const detour=impact==='none'?0:mainLanes===0?1:c.detourFraction;
 const supplyMain=mainLanes*c.capacityPerLane/3600, supplyDetour=c.detourLanes*c.capacityPerLane/3600;
 const n=Math.round(c.minutes*60/c.stepSeconds);let mainQueue=0,detourQueue=0,servedMain=0,servedDetour=0,arrivals=0,queueTime=0,maxQueue=0;
 const series=[];const offered=c.demandVph/3600*c.stepSeconds;
 for(let i=0;i<n;i++){
  const inMain=offered*(1-detour), inDetour=offered*detour;arrivals+=offered;
  mainQueue+=inMain;detourQueue+=inDetour;
  const outMain=Math.min(mainQueue,supplyMain*c.stepSeconds),outDetour=Math.min(detourQueue,supplyDetour*c.stepSeconds);
  mainQueue=Math.max(0,mainQueue-outMain);detourQueue=Math.max(0,detourQueue-outDetour);
  servedMain+=outMain;servedDetour+=outDetour;
  const current=mainQueue+detourQueue;queueTime+=current*c.stepSeconds;maxQueue=Math.max(maxQueue,current);
  if(i===0||((i+1)*c.stepSeconds)%60===0||i===n-1)series.push({minute:Number(((i+1)*c.stepSeconds/60).toFixed(2)),mainQueue:Number(mainQueue.toFixed(2)),detourQueue:Number(detourQueue.toFixed(2)),totalQueue:Number(current.toFixed(2)),served:Number((servedMain+servedDetour).toFixed(2))});
 }
 const completed=servedMain+servedDetour;
 const baseTravelMin=c.lengthM/(c.freeSpeedKmh/3.6)/60;
 const detourTravelMin=baseTravelMin*c.detourLengthFactor;
 const meanTravelMin=completed>0?(servedMain*baseTravelMin+servedDetour*detourTravelMin)/completed:0;
 return {kind:'deterministic_queue_preview',impact,demandVph:c.demandVph,arrivals,completed,unserved:mainQueue+detourQueue,maxQueueVehicles:maxQueue,queueMetersApprox:maxQueue*c.vehicleSpaceM,meanQueueDelayMinutesPerArrival:arrivals?queueTime/60/arrivals:0,meanFreeFlowMinutesCompleted:meanTravelMin,detourShare:detour,lanesOpen:mainLanes,series,warning:'Modelo agregado de filas; não simula car-following, semáforos, mudanças de faixa, spillback, dinâmica de cruzamentos ou roteamento real. Não é uma previsão calibrada.'};
}
export function scheduleImpact(stages,date,from=0,to=Infinity){
 if(!Array.isArray(stages)||!/^[0-9]{4}-\d{2}-\d{2}$/.test(date))throw Error('Cronograma ou data inválidos');
 const active=stages.filter(s=>s.start<=date&&s.end>=date&&s.to>from&&s.from<to);
 return {impact:active.some(s=>s.impact==='total')?'total':active.some(s=>s.impact==='one_lane')?'one_lane':active.some(s=>s.impact==='shoulder')?'shoulder':'none',active:active.map(s=>s.id)};
}
export function buildTrafficScenario(config,stages,date){const validated=validateTrafficConfig(config);const {impact,active}=scheduleImpact(stages,date,0,validated.lengthM);return {schema:'roadworks-traffic-sumo/1.4',scenario:{...validated,impact,date,stageIds:active},notes:'Use com tools/sumo_compare.py e importe o JSON resultante. Modelo SUMO é rede demonstrativa, não uma rede OSM calibrada.'}}
export function validateSumoReport(doc){if(!doc||doc.schema!=='roadworks-traffic-sumo-result/1.4'||!doc.baseline||!doc.work)throw Error('Resultado SUMO inválido');for(const x of [doc.baseline,doc.work]){for(const k of ['arrived','meanDurationSeconds','meanWaitingSeconds','maxHaltingVehicles'])if(!Number.isFinite(x[k])||x[k]<0)throw Error('Métrica SUMO ausente: '+k)}return doc}
export function previewCSV(result){return ['minuto;fila_principal_veic;fila_desvio_veic;fila_total_veic;atendidos_acumulado',...result.series.map(s=>[s.minute,s.mainQueue,s.detourQueue,s.totalQueue,s.served].join(';'))].join('\n')}
