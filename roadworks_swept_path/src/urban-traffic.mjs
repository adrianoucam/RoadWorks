/** Urban traffic 1.7: deterministic mesoscopic link queues, not a calibrated forecast. */
export const URBAN_SCHEMA='roadworks-urban/1.7';
export const LIMITS={nodes:2000,edges:4000,od:300,events:300,vehicles:30000,seconds:14400};
const num=(v,label,min,max,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error(`${label}: valor inválido (${min} a ${max})`);return v};
const id=(v)=>{if(typeof v!=='string'||!/^[\w.:-]{1,100}$/.test(v))throw Error('ID inválido');return v};
const list=(v,label,max)=>{if(!Array.isArray(v)||v.length>max)throw Error(`${label}: lista inválida ou acima do limite ${max}`);return v};
const unique=(xs,label)=>{const s=new Set();for(const x of xs){id(x.id);if(s.has(x.id))throw Error(`${label}: ID repetido ${x.id}`);s.add(x.id)}return s};
export function validateUrban(input){
 if(!input||input.schema!==URBAN_SCHEMA)throw Error('Schema urbano inválido');
 const d=structuredClone(input);
 if(new TextEncoder().encode(JSON.stringify(d)).byteLength>2000000)throw Error('Estudo urbano acima de 2 MB; reduza a área ou divida o estudo');
 if(!d.city||typeof d.city.name!=='string'||!d.city.name.trim()||d.city.name.length>150)throw Error('Nome da cidade obrigatório');
 num(d.city.lat,'Latitude',-85,85);num(d.city.lon,'Longitude',-180,180);
 if(!['synthetic','observed','mixed','osm'].includes(d.source))throw Error('Origem dos dados inválida');
 const nodes=unique(list(d.nodes,'Nós',LIMITS.nodes),'Nós'),edges=unique(list(d.edges,'Trechos',LIMITS.edges),'Trechos');
 const em=new Map(d.edges.map(e=>[e.id,e]));
 for(const n of d.nodes){num(n.lat,'Latitude do nó',-85,85);num(n.lon,'Longitude do nó',-180,180)}
 for(const e of d.edges){
  if(!nodes.has(e.from)||!nodes.has(e.to)||e.from===e.to)throw Error(`Extremos inválidos: ${e.id}`);
  num(e.lengthM,'Extensão (m)',1,100000);num(e.lanes,'Faixas',1,12,true);num(e.speedKmh,'Velocidade (km/h)',1,150);num(e.capacityVphLane,'Capacidade por faixa (veíc./h)',1,3000);num(e.storagePerLane,'Armazenamento por faixa (veíc.)',1,20000,true);
  if(e.modes!==undefined&&(!Array.isArray(e.modes)||!e.modes.length||e.modes.some(m=>!['car','bus','truck','pedestrian'].includes(m))))throw Error('Modos do trecho inválidos');
  if(e.allowedNext!==undefined){list(e.allowedNext,'Conversões',100);if(new Set(e.allowedNext).size!==e.allowedNext.length)throw Error('Conversões duplicadas');for(const k of e.allowedNext)if(!edges.has(k)||em.get(k).from!==e.to)throw Error(`Conversão desconectada: ${e.id} → ${k}`)}
 }
 unique(list(d.od,'OD',LIMITS.od),'OD');
 for(const o of d.od){if(!nodes.has(o.from)||!nodes.has(o.to)||o.from===o.to)throw Error('Origem/destino inválidos');if(!['car','bus','truck','pedestrian'].includes(o.mode))throw Error('Modo inválido');num(o.rateVph,'Demanda/h',0,30000);num(o.begin,'Início OD (s)',0,LIMITS.seconds-1);num(o.end,'Fim OD (s)',1,LIMITS.seconds);if(o.end<=o.begin)throw Error('Período OD invertido');num(o.occupancy,'Ocupação',1,150);if(o.mode==='car'&&o.occupancy>8)throw Error('Ocupação de automóvel acima de 8')}
 unique(list(d.events,'Eventos',LIMITS.events),'Eventos');
 for(const e of d.events){if(!edges.has(e.edge))throw Error('Trecho do evento não encontrado');if(!['accident','work'].includes(e.kind))throw Error('Tipo de evento inválido');num(e.begin,'Início evento',0,LIMITS.seconds-1);num(e.end,'Fim evento',1,LIMITS.seconds);if(e.end<=e.begin)throw Error('Período do evento invertido');num(e.closedLanes,'Faixas fechadas',0,em.get(e.edge).lanes,true);num(e.capacityFactor,'Fator capacidade',0,1)}
 const signals=list(d.signals,'Semáforos',500);const controlled=new Set();
 for(const s of signals){if(!edges.has(s.edge)||controlled.has(s.edge))throw Error('Semáforo ausente ou duplicado por trecho');controlled.add(s.edge);num(s.cycle,'Ciclo (s)',2,600,true);num(s.offset,'Defasagem (s)',0,600,true);num(s.greenStart,'Início verde',0,s.cycle-1,true);num(s.greenEnd,'Fim verde',1,s.cycle,true);if(s.greenEnd<=s.greenStart)throw Error('Intervalo verde inválido')}
 list(d.demandAdjustments,'Ajustes de demanda',300);
 for(const a of d.demandAdjustments){if(!d.od.some(o=>o.id===a.od))throw Error('OD do ajuste inexistente');num(a.begin,'Início ajuste',0,LIMITS.seconds-1);num(a.end,'Fim ajuste',1,LIMITS.seconds);num(a.percent,'Ajuste (%)',-100,300);if(a.end<=a.begin)throw Error('Período do ajuste inválido')}
 for(let i=0;i<d.demandAdjustments.length;i++)for(let j=0;j<i;j++){const a=d.demandAdjustments[i],b=d.demandAdjustments[j];if(a.od===b.od&&a.begin<b.end&&b.begin<a.end)throw Error('Ajustes de demanda sobrepostos para a mesma OD')}
 num(d.settings.durationSeconds,'Duração',60,LIMITS.seconds,true);num(d.settings.demandPercent,'Variação global (%)',-100,300);num(d.settings.queueThreshold,'Limite de fila',0,30000);num(d.settings.completionThreshold,'Conclusão mínima',0,1);
 if(d.edges.length*d.settings.durationSeconds>12000000)throw Error('Rede/período excedem limite computacional; reduza a área ou duração');
 list(d.inventory||[],'Inventário',3000);for(const a of d.inventory||[]){id(a.id);num(a.lat,'Latitude do ativo',-85,85);num(a.lon,'Longitude do ativo',-180,180);if(typeof a.kind!=='string'||typeof a.name!=='string')throw Error('Ativo inválido')}
 return d;
}
function allowed(e,next,mode){return (!e.modes||e.modes.includes(mode))&&(!next||(!next.modes||next.modes.includes(mode))&&(e.allowedNext===undefined||e.allowedNext.includes(next.id)))}
export function edgeState(d,e,t,events=true){
 const active=events?d.events.filter(x=>x.edge===e.id&&x.begin<=t&&t<x.end):[];
 // Concurrent closures use the maximum, not their sum: lane identities are unknown.
 const lanes=Math.max(0,e.lanes-Math.max(0,...active.map(x=>x.closedLanes)));
 return {lanes,capacityVph:lanes*e.capacityVphLane*Math.min(1,...active.map(x=>x.capacityFactor)),storage:Math.max(1,e.lanes*e.storagePerLane)};
}
function networkIndex(d){const outgoing=new Map(),edges=new Map();for(const e of d.edges){edges.set(e.id,e);if(!outgoing.has(e.from))outgoing.set(e.from,[]);outgoing.get(e.from).push(e)}return {outgoing,edges}}
class RouteHeap{
 constructor(){this.items=[]}
 less(a,b){return a.cost<b.cost||a.cost===b.cost&&a.order<b.order}
 push(x){const a=this.items;a.push(x);let i=a.length-1;while(i){const p=(i-1)>>1;if(!this.less(a[i],a[p]))break;[a[i],a[p]]=[a[p],a[i]];i=p}}
 pop(){const a=this.items,root=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;while(true){let j=i,l=2*i+1,r=l+1;if(l<a.length&&this.less(a[l],a[j]))j=l;if(r<a.length&&this.less(a[r],a[j]))j=r;if(j===i)break;[a[i],a[j]]=[a[j],a[i]];i=j}}return root}
}
export function routeUrban(d,from,to,{mode='car',time=0,events=true,index=null,states=null}={}){
 const {outgoing,edges}=index||networkIndex(d),dist=new Map(),previous=new Map(),order=new Map(),heap=new RouteHeap(),visited=new Set();
 const available=e=>(states?.get(e.id)||edgeState(d,e,time,events)).capacityVph>0;
 const enqueue=(key,cost,parent)=>{if(!order.has(key))order.set(key,order.size);dist.set(key,cost);previous.set(key,parent);heap.push({key,cost,order:order.get(key)})};
 for(const e of outgoing.get(from)||[])if(allowed(e,null,mode)&&available(e))enqueue(e.id,e.lengthM/(e.speedKmh/3.6),null);
 while(heap.items.length){const {key,cost}=heap.pop();if(visited.has(key)||cost!==dist.get(key))continue;visited.add(key);const e=edges.get(key);if(e.to===to){const route=[];for(let k=key;k!==null;k=previous.get(k))route.unshift(k);return route}
  for(const next of outgoing.get(e.to)||[])if(allowed(e,next,mode)&&available(next)){const v=cost+next.lengthM/(next.speedKmh/3.6);if(v<(dist.get(next.id)??Infinity))enqueue(next.id,v,key)}
 }return null;
}
export function simulateUrban(input,{events=true,percent,collectSeries=true}={}){
 const d=validateUrban(input),change=percent??d.settings.demandPercent;num(change,'Demanda (%)',-100,300);
 const em=new Map(d.edges.map(e=>[e.id,e])),queues=new Map(d.edges.map(e=>[e.id,[]])),credits=new Map(d.edges.map(e=>[e.id,0])),maxima=new Map(d.edges.map(e=>[e.id,0])),signals=new Map(d.signals.map(s=>[s.edge,s]));
 const generated=new Map(d.od.map(o=>[o.id,0])),carry=new Map(d.od.map(o=>[o.id,0])),outside=[],classes={};let offered=0,completed=0,travel=0,waiting=0,passengers=0,maxQueue=0,unroutable=0,waitArea=0;
 const series=[],routeCache=new Map(),duration=d.settings.durationSeconds,index=networkIndex(d),boundaries=new Set(events?d.events.flatMap(e=>[Math.ceil(e.begin),Math.ceil(e.end)]):[]);let states=null;
 const weight=v=>v.mode==='car'?1:v.mode==='pedestrian'?0.2:2;
 const count=q=>q.reduce((a,v)=>a+weight(v),0);
 for(let t=0;t<duration;t++){
  // Cache event state and adjacency; fractional boundaries activate at the next integer tick.
  if(!states||boundaries.has(t)){states=new Map(d.edges.map(e=>[e.id,edgeState(d,e,t,events)]));routeCache.clear()}
  for(const o of d.od){if(t<o.begin||t>=o.end)continue;const a=d.demandAdjustments.find(a=>a.od===o.id&&a.begin<=t&&t<a.end);let fraction=carry.get(o.id)+o.rateVph/3600*(1+change/100)*(1+(a?.percent||0)/100);const n=Math.floor(fraction+1e-9);carry.set(o.id,fraction-n);
   for(let k=0;k<n;k++){if(++offered>LIMITS.vehicles)throw Error('Demanda excede 30000 viagens; reduza período ou volume');generated.set(o.id,generated.get(o.id)+1);outside.push({od:o.id,from:o.from,to:o.to,mode:o.mode,occupancy:o.occupancy,depart:t,wait:0,path:null,index:0});classes[o.mode]??={offered:0,completed:0,passengers:0};classes[o.mode].offered++}
  }
  const occupancy=new Map(d.edges.map(e=>[e.id,count(queues.get(e.id))]));
  // All transfers are staged: no vehicle can cross two links within the same tick.
  const transfers=[];
  for(const e of d.edges){const q=queues.get(e.id),state=states.get(e.id),s=signals.get(e.id),phase=s?((t+s.offset)%s.cycle):0,green=!s||(phase>=s.greenStart&&phase<s.greenEnd);let credit=green?Math.min(3,credits.get(e.id)+state.capacityVph/3600):0;if(state.capacityVph===0)credit=0;
   while(q.length&&q[0].ready<=t&&credit+1e-9>=weight(q[0])){const v=q[0],next=v.path[v.index+1];if(next){const target=states.get(next);if(!target||target.capacityVph===0||occupancy.get(next)+weight(v)>target.storage)break;occupancy.set(next,occupancy.get(next)+weight(v))}q.shift();credit-=weight(v);occupancy.set(e.id,occupancy.get(e.id)-weight(v));v.wait+=Math.max(0,t-v.ready);
    if(next){v.index++;v.ready=t+Math.max(1,Math.ceil(em.get(next).lengthM/(em.get(next).speedKmh/3.6)));transfers.push([next,v])}else{completed++;travel+=t-v.depart;waiting+=v.wait;passengers+=v.occupancy;classes[v.mode].completed++;classes[v.mode].passengers+=v.occupancy}
   }
   credits.set(e.id,credit);
  }
  for(const [key,v] of transfers)queues.get(key).push(v);
  let noRoute=0;
  for(let i=0;i<outside.length;){const v=outside[i],cacheKey=v.od;if(!routeCache.has(cacheKey))routeCache.set(cacheKey,routeUrban(d,v.from,v.to,{mode:v.mode,time:t,events,index,states}));const path=routeCache.get(cacheKey);if(!path){noRoute++;i++;continue}const first=path[0],state=states.get(first);if(occupancy.get(first)+weight(v)>state.storage){i++;continue}v.path=path;v.wait=t-v.depart;v.ready=t+Math.max(1,Math.ceil(em.get(first).lengthM/(em.get(first).speedKmh/3.6)));queues.get(first).push(v);occupancy.set(first,occupancy.get(first)+weight(v));outside.splice(i,1)}
  unroutable=noRoute;let queued=outside.length;
  for(const [key,q] of queues){const n=q.filter(v=>v.ready<=t).length;queued+=n;maxima.set(key,Math.max(maxima.get(key),n))}maxQueue=Math.max(maxQueue,queued);waitArea+=queued;
  if(collectSeries&&(t%60===59||t===duration-1))series.push({second:t+1,offered,completed,queued,pending:offered-completed,outside:outside.length});
 }
 const pending=offered-completed,inNetwork=[...queues.values()].reduce((s,q)=>s+q.length,0),ratio=offered?completed/offered:1;
 return {schema:'roadworks-urban-result/1.7',algorithm:'mesoscopic-link-queue/1.7',source:d.source,reviewRequired:true,calibrated:false,parameters:{events,percent:change,durationSeconds:duration},offered,completed,pending,inNetwork,outside:outside.length,unroutable,maxQueue,completionRatio:ratio,meanTravelSecondsCompleted:completed?travel/completed:null,meanWaitingSecondsCompleted:completed?waiting/completed:null,totalQueueVehicleSeconds:waitArea,passengersCompleted:passengers,classes,edgeQueues:Object.fromEntries(maxima),series,critical:maxQueue>d.settings.queueThreshold||ratio<d.settings.completionThreshold,warning:'Modelo mesoscópico determinístico: filas FIFO, armazenamento finito e rotas de menor tempo livre na partida. Sem mudança de faixa ou replanejamento em viagem. Semáforo controla saída agregada por trecho; não verifica conflitos. Pedestres exigem rede própria. Não calibrado.'};
}
export function compareUrban(d,{baselineDocument=null}={}){if(baselineDocument&&baselineDocument.city.name!==d.city.name)throw Error('A referência e a alternativa precisam pertencer à mesma cidade');return {schema:'roadworks-urban-comparison/1.7',reference:baselineDocument?'pinned':'same_network_without_events_or_global_change',baseline:baselineDocument?simulateUrban(baselineDocument):simulateUrban(d,{events:false,percent:0}),alternative:simulateUrban(d)}}
export function saturationUrban(d,levels=[-50,-25,0,25,50,75,100]){if(!Array.isArray(levels)||levels.length>12||new Set(levels).size!==levels.length)throw Error('Níveis de saturação inválidos');return [...levels].sort((a,b)=>a-b).map(percent=>{const r=simulateUrban(d,{percent,collectSeries:false});return {percent,offered:r.offered,completed:r.completed,pending:r.pending,maxQueue:r.maxQueue,completionRatio:r.completionRatio,critical:r.critical}})}
export function validationMetrics(pairs){list(pairs,'Observações',1000);if(!pairs.length)throw Error('Informe observações');let abs=0,sq=0;for(const p of pairs){num(p.observed,'Observado',0,1e9);num(p.simulated,'Simulado',0,1e9);const e=p.simulated-p.observed;abs+=Math.abs(e);sq+=e*e}return {count:pairs.length,mae:abs/pairs.length,rmse:Math.sqrt(sq/pairs.length),warning:'Erros nas unidades dos pares informados. Não misturar unidades nem usar somente dados de ajuste para validar.'}}
export function parseUrbanODCSV(text){
 if(typeof text!=='string'||text.length>1000000)throw Error('CSV inválido ou acima de 1 MB');
 text=text.replace(/^\uFEFF/,'');const sep=text.split(/\r?\n/,1)[0].includes(';')?';':',',rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===sep&&!quoted){row.push(cell);cell=''}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));if(row.some(s=>s.trim()))rows.push(row);row=[];cell=''}else cell+=c}
 if(quoted)throw Error('Aspas não fechadas no CSV');row.push(cell.replace(/\r$/,''));if(row.some(s=>s.trim()))rows.push(row);
 const header=rows.shift()?.map(x=>x.trim()),keys=['id','from','to','mode','rateVph','begin','end','occupancy'];if(!header||keys.some(k=>!header.includes(k))||new Set(header).size!==header.length)throw Error('Cabeçalho CSV deve conter '+keys.join(','));
 list(rows,'Linhas OD',LIMITS.od);
 return rows.map((r,i)=>{if(r.length!==header.length)throw Error(`Colunas inconsistentes na linha ${i+2}`);const o=Object.fromEntries(header.map((k,j)=>[k,r[j].trim()]));for(const k of ['rateVph','begin','end','occupancy']){if(o[k]==='')throw Error(`Valor ausente: ${k}, linha ${i+2}`);o[k]=Number(o[k].replace(',','.'))}return o});
}
export function exampleUrban(){return {schema:URBAN_SCHEMA,city:{name:'Niterói',lat:-22.904,lon:-43.103},source:'synthetic',nodes:[{id:'A',lat:-22.904,lon:-43.108},{id:'B',lat:-22.904,lon:-43.104},{id:'C',lat:-22.904,lon:-43.100},{id:'D',lat:-22.901,lon:-43.104}],edges:[['AB','A','B',410,2],['BC','B','C',410,2],['BD','B','D',340,1],['DC','D','C',530,1]].map(([id,from,to,lengthM,lanes])=>({id,from,to,lengthM,lanes,speedKmh:40,capacityVphLane:1200,storagePerLane:40,modes:['car','bus','truck'],source:'synthetic'})),od:[{id:'autos',from:'A',to:'C',mode:'car',rateVph:1600,begin:0,end:1800,occupancy:1.4},{id:'onibus',from:'A',to:'C',mode:'bus',rateVph:20,begin:0,end:1800,occupancy:35}],events:[{id:'obra',edge:'BC',kind:'work',begin:300,end:1200,closedLanes:1,capacityFactor:.6}],signals:[],demandAdjustments:[],inventory:[],settings:{durationSeconds:2400,demandPercent:0,queueThreshold:100,completionThreshold:.95}}}

/** OSM conversion uses shared node IDs only; never merges a planar crossing by proximity. */
export function urbanFromOverpass(raw,city){
 const elements=raw?.elements;if(!Array.isArray(elements)||elements.length>20000)throw Error('Resposta OSM inválida ou grande demais');
 const nodeMap=new Map(elements.filter(e=>e.type==='node').map(n=>[n.id,{id:String(n.id),lat:n.lat,lon:n.lon}])),nodes=new Map(),edges=[],byWay=new Map(),warnings=[];
 const ways=elements.filter(e=>e.type==='way'&&e.tags?.highway&&Array.isArray(e.nodes));
 for(const w of ways){const tags=w.tags;if(['footway','path','steps','cycleway','pedestrian'].includes(tags.highway)||tags.access==='no'||tags.motor_vehicle==='no')continue;const reverse=tags.oneway==='-1',oneway=reverse||['yes','1','true'].includes(tags.oneway)||tags.junction==='roundabout'||tags.highway==='motorway';const ids=reverse?[...w.nodes].reverse():w.nodes;const segments=[];
  for(let i=1;i<ids.length;i++){let a=nodeMap.get(ids[i-1]),b=nodeMap.get(ids[i]);if(!a||!b){warnings.push(`Nós ausentes na via ${w.id}; recarregue com recursão de nós`);continue}if(a.id===b.id)continue;nodes.set(a.id,a);nodes.set(b.id,b);const lat=(a.lat+b.lat)*Math.PI/360,dx=(b.lon-a.lon)*Math.PI/180*6371000*Math.cos(lat),dy=(b.lat-a.lat)*Math.PI/180*6371000,lengthM=Math.hypot(dx,dy);if(lengthM<1)continue;
   const total=Number(tags.lanes),speed=Number(tags.maxspeed),forward=Number(tags['lanes:forward']),backward=Number(tags['lanes:backward']);
   for(const dir of oneway?[1]:[1,-1]){const declared=dir===1?forward:backward,lanes=Number.isInteger(declared)&&declared>0?declared:oneway&&Number.isInteger(total)&&total>0?total:Number.isInteger(total)&&total>=2?Math.floor(total/2):1;const eid=`w${w.id}.${i}.${dir===1?'f':'r'}`;const e={id:eid,from:dir===1?a.id:b.id,to:dir===1?b.id:a.id,lengthM,lanes:Math.min(lanes,12),speedKmh:speed>0&&speed<=150?speed:30,capacityVphLane:1200,storagePerLane:Math.max(1,Math.floor(lengthM/7.5)),modes:['car','bus','truck'],name:tags.name||`OSM ${w.id}`,osmWay:String(w.id),source:'osm',tags:{...tags},assumptions:['Capacidade e armazenamento hipotéticos',...(!(speed>0&&speed<=150)?['Velocidade presumida de 30 km/h']:[]),...(!Number.isInteger(declared)?['Faixas direcionais a revisar']:[])]};edges.push(e);segments.push(e)}
  }byWay.set(String(w.id),segments);
 }
 for(const relation of elements.filter(e=>e.type==='relation'&&e.tags?.type==='restriction')){
  if(relation.tags.except||relation.tags['restriction:conditional']){warnings.push(`Restrição ${relation.id} condicional/exceção exige revisão`);continue}
  const from=relation.members?.find(m=>m.role==='from'&&m.type==='way'),to=relation.members?.find(m=>m.role==='to'&&m.type==='way'),via=relation.members?.find(m=>m.role==='via'&&m.type==='node');
  if(!from||!to||!via){warnings.push(`Restrição ${relation.id} via-way não aplicada; requer revisão`);continue}const incoming=(byWay.get(String(from.ref))||[]).filter(e=>e.to===String(via.ref)),targets=(byWay.get(String(to.ref))||[]).filter(e=>e.from===String(via.ref));
  if(!incoming.length||!targets.length){warnings.push(`Restrição ${relation.id} incompleta na área`);continue}const rule=relation.tags.restriction||'';
  for(const e of incoming){const outgoing=edges.filter(n=>n.from===e.to).map(n=>n.id);const current=e.allowedNext??outgoing;const targetIDs=targets.filter(n=>rule==='no_u_turn'||rule==='only_u_turn'?n.to===e.from:from.ref===to.ref?n.to!==e.from:true).map(n=>n.id);if(rule.startsWith('only_'))e.allowedNext=current.filter(k=>targetIDs.includes(k));else if(rule.startsWith('no_'))e.allowedNext=current.filter(k=>!targetIDs.includes(k));else warnings.push(`Restrição ${relation.id} não reconhecida`)}
 }
 if(!edges.length)throw Error('Nenhum trecho viário utilizável');
 return validateUrban({...exampleUrban(),city,source:'osm',nodes:[...nodes.values()],edges,od:[],events:[],signals:[],inventory:[],warnings:[...new Set(warnings),'Revisar semáforos, acessos, faixas, conversões por faixa e restrições condicionais antes de uso.'],osm:raw});
}
