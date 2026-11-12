// RoadWorks v1.3 — construction staging model. Dates are inclusive UTC calendar days.
import {pathStations,atStation} from './vertical.mjs';
const day=s=>{if(typeof s!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))throw Error('Data deve ser AAAA-MM-DD');const t=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw Error('Data inválida: '+s);return t};
export const DAY_MS=86400000;
const allowed=['survey','earthworks','drainage','pavement','markings','closure','detour','other'];
const has=(v)=>Number.isFinite(Number(v));
export function validateStage(v,total=Infinity){
 if(!v||typeof v!=='object')throw Error('Etapa ausente');const name=String(v.name||'').trim();if(!name||name.length>100)throw Error('Nome da etapa inválido');
 const type=String(v.type||'other');if(!allowed.includes(type))throw Error('Tipo de etapa inválido');
 const start=String(v.start),end=String(v.end);const t0=day(start),t1=day(end);if(t1<t0)throw Error('Data final anterior à inicial');
 if(!has(v.from)||!has(v.to))throw Error('Estacas devem ser numéricas');const from=Number(v.from),to=Number(v.to);
 if(from<0||to<=from||to>total+1e-6)throw Error('Intervalo de estacas fora do eixo');
 const impact=String(v.impact||'none');if(!['none','shoulder','one_lane','total'].includes(impact))throw Error('Tipo de interdição inválido');
 const cost=v.cost===undefined||v.cost===''?0:Number(v.cost);if(!Number.isFinite(cost)||cost<0)throw Error('Custo inválido');
 const id=String(v.id||'');if(!/^[a-zA-Z0-9_-]{1,70}$/.test(id))throw Error('ID inválido');
 return {id,name,type,start,end,from,to,impact,cost,notes:String(v.notes||'').slice(0,500),osmWayId:v.osmWayId==null?null:String(v.osmWayId)};
}
export function validateSchedule(stages,total=Infinity){if(!Array.isArray(stages)||stages.length>500)throw Error('Cronograma deve ter até 500 etapas');const ids=new Set();return stages.map(s=>{const v=validateStage(s,total);if(ids.has(v.id))throw Error('ID duplicado: '+v.id);ids.add(v.id);return v})}
export function stageProgress(s,date){const a=day(s.start),b=day(s.end),t=day(date);if(t<a)return 0;if(t>=b)return 1;return (t-a+DAY_MS)/(b-a+DAY_MS)}
export function stageStatus(s,date){const t=day(date);return t<day(s.start)?'planned':t>day(s.end)?'completed':'active'}
export function scheduleAt(stages,date,{total=Infinity}={}){day(date);const validated=validateSchedule(stages,total),rows=validated.map(s=>({...s,status:stageStatus(s,date),progress:stageProgress(s,date)}));
 const active=rows.filter(s=>s.status==='active');const conflicts=[];
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j],overlap=Math.min(a.to,b.to)-Math.max(a.from,b.from);
  if(overlap>1e-6&&a.impact!=='none'&&b.impact!=='none')conflicts.push({a:a.id,b:b.id,from:Math.max(a.from,b.from),to:Math.min(a.to,b.to),kind:a.impact==='total'||b.impact==='total'?'blocking-closure':'concurrent-restrictions'});
 }
 const affected=active.filter(s=>s.impact!=='none');return {date,stages:rows,active,conflicts,affected,completed:rows.filter(s=>s.status==='completed'),planned:rows.filter(s=>s.status==='planned'),budget:rows.reduce((n,s)=>n+s.cost,0)};
}
export function stageGeometry(path,stage,{step=5}={}){const stations=pathStations(path),total=stations.at(-1);const s=validateStage(stage,total);if(!Number.isFinite(step)||step<=0)throw Error('Passo inválido');const n=Math.max(1,Math.ceil((s.to-s.from)/step));return Array.from({length:n+1},(_,i)=>{const at=atStation(path,s.from+(s.to-s.from)*i/n,stations);return {x:at.x,y:at.y,s:at.s}})}
export function constructionCSV(stages){return ['id;nome;tipo;inicio;fim;estaca_inicial_m;estaca_final_m;interdicao;custo_planejado',...validateSchedule(stages).map(s=>[s.id,s.name,s.type,s.start,s.end,s.from,s.to,s.impact,s.cost].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'))].join('\n')}
export function scheduleBounds(stages){const arr=validateSchedule(stages);if(!arr.length)return {start:null,end:null};return {start:arr.reduce((v,s)=>s.start<v?s.start:v,arr[0].start),end:arr.reduce((v,s)=>s.end>v?s.end:v,arr[0].end)}}
export function scheduleWarnings(stages,total=Infinity){const v=validateSchedule(stages,total),out=[];for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++){
 const a=v[i],b=v[j];if(a.impact==='none'||b.impact==='none')continue;
 if(Math.min(day(a.end),day(b.end))<Math.max(day(a.start),day(b.start)))continue;
 if(Math.min(a.to,b.to)<=Math.max(a.from,b.from))continue;
 out.push({a:a.id,b:b.id,message:'Interdições temporal e espacialmente sobrepostas; revisar plano de tráfego'});
 }return out}

// Approximate 2D construction work-zone ribbon for visualization only (not a surveyed lane boundary).
export function stageRibbon(geometry,width){if(!Array.isArray(geometry)||geometry.length<2||!Number.isFinite(width)||width<=0)throw Error('Geometria ou largura da zona de obra inválida');const left=[],right=[];for(let i=0;i<geometry.length;i++){const a=geometry[Math.max(i-1,0)],b=geometry[Math.min(i+1,geometry.length-1)];const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-9)throw Error('Segmento degenerado da zona de obra');const nx=-dy/len,ny=dx/len;left.push({...geometry[i],x:geometry[i].x+nx*width/2,y:geometry[i].y+ny*width/2});right.push({...geometry[i],x:geometry[i].x-nx*width/2,y:geometry[i].y-ny*width/2})}return {left,right,polygon:[...left,...right.reverse()]};}
