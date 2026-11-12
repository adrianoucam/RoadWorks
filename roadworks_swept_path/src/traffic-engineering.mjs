/** RoadWorks v1.6 — explicit screening tools, not calibrated traffic engineering. */
import {trafficPreview,validateTrafficConfig} from './traffic.mjs';
const HIERARCHY={motorway:'expressway',motorway_link:'expressway',trunk:'highway',trunk_link:'highway',primary:'arterial',primary_link:'arterial',secondary:'arterial',secondary_link:'arterial',tertiary:'collector',tertiary_link:'collector',residential:'local',living_street:'local',service:'local',unclassified:'local'};
export const HIERARCHY_LABELS={expressway:'Via expressa',highway:'Rodovia',arterial:'Arterial',collector:'Coletora',local:'Local',unknown:'Não classificada'};
export function functionalHierarchy(tags={}){
 const type=String(tags.highway||'').trim();return {class:HIERARCHY[type]||'unknown',osmHighway:type||'ausente',evidence:'proxy_osm',warning:'highway=* indica tipologia cartográfica OSM, não classificação funcional oficial DNIT/município'};
}
export function analyzeRoadHierarchy(roads,{max=2500}={}){
 if(!Array.isArray(roads)||roads.length>max)throw Error('Rede viária inválida ou grande demais');
 const counts={expressway:0,highway:0,arterial:0,collector:0,local:0,unknown:0},issues=[];
 const mapped=roads.map((r,i)=>{const tags=r.tags||r.properties||{},hierarchy=functionalHierarchy(tags),lanes=Number(tags.lanes),oneway=String(tags.oneway||'')==='yes',speed=Number(String(tags.maxspeed||'').replace(/\s*km\/h.*/,''));counts[hierarchy.class]++;
  if(hierarchy.class==='unknown')issues.push({type:'unclassified',index:i,name:r.name||'Sem nome',severity:'info',message:'Classificação OSM não reconhecida'});
  return {index:i,id:String(r.id??i),name:String(r.name||tags.name||'Via sem nome'),hierarchy:hierarchy.class,osmHighway:hierarchy.osmHighway,lanes:Number.isInteger(lanes)&&lanes>=1&&lanes<=12?lanes:null,oneway,maxspeedKmh:Number.isFinite(speed)&&speed>0&&speed<=150?speed:null,evidence:hierarchy.evidence};
 });
 return {schema:'roadworks-hierarchy/1.6',mapped,counts,issues,reviewRequired:true};
}
const number=(value,name,min,max)=>{const x=Number(value);if(!Number.isFinite(x)||x<min||x>max)throw Error(`${name}: informe valor entre ${min} e ${max}`);return x};
export function assessBottleneck({inLanes,outLanes,demandVph,capacityPerLane=1500,heavyVehiclesPercent=0,heavyVehicleFactor=2,greenRatio=1}={}){
 const upstream=number(inLanes,'Faixas de entrada',1,12),downstream=number(outLanes,'Faixas de saída',1,12),demand=number(demandVph,'Demanda',0,30000),c=number(capacityPerLane,'Capacidade por faixa',300,2400),heavy=number(heavyVehiclesPercent,'Veículos pesados (%)',0,100),factor=number(heavyVehicleFactor,'Equivalência de pesados',1,4),green=number(greenRatio,'Fração verde efetiva',0.05,1);
 const heavyCorrection=1/(1+heavy/100*(factor-1));const inputCapacity=upstream*c*heavyCorrection,outputCapacity=downstream*c*heavyCorrection*green;
 const ratio=demand/outputCapacity,excessVph=Math.max(0,demand-outputCapacity);
 return {inLanes:upstream,outLanes:downstream,demandVph:demand,inputCapacityVph:inputCapacity,outputCapacityVph:outputCapacity,vOverC:ratio,excessVph,capacityReductionPercent:100*(1-outputCapacity/inputCapacity),level:ratio>1?'acima_da_capacidade':ratio>=0.85?'atencao':'dentro_da_capacidade',warning:'Triagem analítica por capacidade uniforme; requer avaliação de interseções, volumes de conversão, pedestres e calibração antes de decisão de engenharia.'};
}
export function intersectionAlternatives({demandVph,lanes,capacityPerLane=1500,control='signal',greenRatio=0.55,stopPenalty=0.70,roundaboutFactor=0.8,pedestrianCrossingsPerHour=0}={}){
 const demand=number(demandVph,'Demanda',0,30000),n=number(lanes,'Faixas',1,8),cap=number(capacityPerLane,'Capacidade',300,2400),g=number(greenRatio,'Verde efetivo',.05,1),sp=number(stopPenalty,'Fator PARE',.1,1),rf=number(roundaboutFactor,'Fator rotatória',.1,1),ped=number(pedestrianCrossingsPerHour,'Travessias/h',0,5000);
 if(!['signal','stop','roundabout','priority'].includes(control))throw Error('Controle de interseção inválido');
 const pedestrianFactor=Math.max(0.5,1-Math.min(0.5,ped/6000));const factors={signal:g,stop:sp,roundabout:rf,priority:1};const alternatives=Object.entries(factors).map(([id,factor])=>{const effectiveVph=n*cap*factor*pedestrianFactor;return {id,capacityVph:effectiveVph,vOverC:demand/effectiveVph,excessVph:Math.max(0,demand-effectiveVph)}});
 return {selected:control,alternatives,pedestrianFactor,warning:'Fatores hipotéticos configuráveis, não uma avaliação de atraso/segurança de HCM, DNIT ou SUMO. Não automatizar remoção de semáforos.'};
}
export function multimodalDemand({carsVph=0,busesVph=0,busOccupancy=30,carOccupancy=1.4,heavyVehiclesVph=0,heavyVehicleFactor=2}={}){
 const cars=number(carsVph,'Automóveis/h',0,30000),buses=number(busesVph,'Ônibus/h',0,3000),heavy=number(heavyVehiclesVph,'Pesados/h',0,10000),busOcc=number(busOccupancy,'Ocupação ônibus',1,150),carOcc=number(carOccupancy,'Ocupação auto',1,8),factor=number(heavyVehicleFactor,'Equivalente pesado',1,4);
 return {vehicleDemandVph:cars+buses+heavy,equivalentDemandPcuPerHour:cars+(buses+heavy)*factor,passengersPerHour:cars*carOcc+buses*busOcc,busPassengersPerHour:buses*busOcc,warning:'Ocupação presumida e fator de equivalência simplificado; não estima demanda induzida ou transferência modal.'};
}
export function compareTrafficStrategies(config,{impact='none',detourFraction=0.35,capacityFactor=1,extraDemandVph=0}={}){
 const base=validateTrafficConfig(config),fraction=number(detourFraction,'Fraçao desvio',0,1),factor=number(capacityFactor,'Fator capacidade',0.1,1),extra=number(extraDemandVph,'Demanda adicional',0,10000);
 const baseline=trafficPreview(base),work=trafficPreview({...base,demandVph:Math.min(15000,base.demandVph+extra),capacityPerLane:Math.max(300,base.capacityPerLane*factor),detourFraction:fraction},{impact});
 return {schema:'roadworks-traffic-strategy/1.6',baseline,work,parameters:{...base,impact,detourFraction:fraction,capacityFactor:factor,extraDemandVph:extra},changes:{maxQueueVehicles:work.maxQueueVehicles-baseline.maxQueueVehicles,delayMinutes:work.meanQueueDelayMinutesPerArrival-baseline.meanQueueDelayMinutesPerArrival},warning:'Comparação determinística agregada; desvio abstrato e sem microsimulação dos cruzamentos.'};
}
export function strategiesCSV(comparisons){if(!Array.isArray(comparisons))throw Error('Comparações inválidas');return ['cenario;impacto;fila_max_veic;atraso_min;veiculos_nao_atendidos',...comparisons.map(x=>[String(x.name||'').replace(/[;\r\n]/g,' '),x.result.work.impact,x.result.work.maxQueueVehicles.toFixed(2),x.result.work.meanQueueDelayMinutesPerArrival.toFixed(3),x.result.work.unserved.toFixed(2)].join(';'))].join('\n')}
/** Audits manually configured junction lane movements, not a geometric safety validation. */
export function auditLaneMovements(lanes){
 if(!Array.isArray(lanes)||!lanes.length||lanes.length>24)throw Error('Faixas de interseção inválidas');
 const allowed=new Set(['left','through','right']);const issues=[];const checked=new Set();
 for(const [i,lane] of lanes.entries()){
  if(!lane||typeof lane.id!=='string'||!lane.id||checked.has(lane.id))throw Error('Identificador de faixa ausente ou repetido');checked.add(lane.id);
  if(!Array.isArray(lane.movements)||lane.movements.some(m=>!allowed.has(m)))throw Error('Manobras inválidas');
  if(!lane.movements.length)issues.push({id:lane.id,severity:'warning',type:'no_movement',message:'Faixa sem movimento permitido'});
  if(new Set(lane.movements).size!==lane.movements.length)issues.push({id:lane.id,severity:'info',type:'duplicate',message:'Movimento duplicado'});
  if(lane.movements.includes('left')&&lane.movements.includes('through'))issues.push({id:lane.id,severity:'review',type:'shared_left',message:'Conversão à esquerda e fluxo reto compartilham faixa: verificar retenções e conflitos'});
  if(lane.movements.includes('right')&&lane.movements.includes('through'))issues.push({id:lane.id,severity:'review',type:'shared_right',message:'Conversão à direita e fluxo reto compartilham faixa: verificar pedestres e retenções'});
 }
 return {lanes:lanes.length,issues,needsReview:issues.length>0,limitations:'Somente política textual por faixa; não verifica conflitos espaciais, fase semafórica, sinalização ou geometria das curvas.'};
}
/** Endpoint-based OSM screening: only candidate access points, not verified same-grade junctions. */
export function screenRoadAccesses(roads,{toleranceMeters=8,maxRoads=600}={}){
 if(!Array.isArray(roads)||roads.length>maxRoads)throw Error('Rede de acessos inválida');
 const tol=number(toleranceMeters,'Tolerância',0.5,25);const endpoints=[];
 const R=6371000;
 for(const [i,r] of roads.entries()){
  const coords=r.coordinates;if(!Array.isArray(coords)||coords.length<2)continue;
  const c=coords[0],d=coords.at(-1);
  for(const p of [c,d]){if(!Array.isArray(p)||p.length<2||!p.every(Number.isFinite))continue;endpoints.push({i,lon:p[0],lat:p[1]});}
 }
 const pairs=[];
 for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++){
  const a=endpoints[i],b=endpoints[j];if(a.i===b.i)continue;
  const lat=(a.lat+b.lat)*Math.PI/360,dx=(a.lon-b.lon)*Math.PI/180*R*Math.cos(lat),dy=(a.lat-b.lat)*Math.PI/180*R;
  if(Math.hypot(dx,dy)<=tol)pairs.push({roadA:a.i,roadB:b.i,distanceM:Math.hypot(dx,dy)});
 }
 return {candidateConnections:pairs.length,pairs:pairs.slice(0,300),warning:'Só aproximação entre extremidades OSM; nós de geometria interna, pontes, níveis, acessos e permissões não são verificados.'};
}
