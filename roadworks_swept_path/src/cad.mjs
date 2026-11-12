// RoadWorks CAD 0.2 — analytic circular arcs and numerical Euler spirals.
import {dist} from './geometry.mjs';
export function normalizeAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
export function startPose(p,heading=0){return {x:p.x,y:p.y,heading};}
export function segmentEnd(p,seg){return sampleSegment(p,seg,Math.min(.5,seg.length/50)).at(-1);}
export function sampleSegment(start,segment,step=.4){
 const L=Number(segment.length),type=segment.type;
 if(!(Number.isFinite(L)&&L>0&&L<=10000))throw Error('Comprimento CAD inválido (0–10.000 m)');
 if(!['line','arc','clothoid'].includes(type))throw Error('Tipo CAD desconhecido');
 const k0=type==='line'?0:type==='arc'?Number(segment.curvature):Number(segment.k0);
 const k1=type==='clothoid'?Number(segment.k1):k0;
 if(!Number.isFinite(k0)||!Number.isFinite(k1)||Math.max(Math.abs(k0),Math.abs(k1))>1)throw Error('Curvatura inválida: limite absoluto 1/m');
 const n=Math.ceil(L/Math.max(.05,Math.min(2,step))),ds=L/n;let x=start.x,y=start.y;const h0=start.heading;
 const pts=[{x,y,heading:h0,station:0,curvature:k0}];
 for(let i=0;i<n;i++){
  const sm=(i+.5)*ds,he=h0+k0*sm+(k1-k0)*sm*sm/(2*L);
  x+=ds*Math.cos(he);y+=ds*Math.sin(he);
  const s=(i+1)*ds,heading=h0+k0*s+(k1-k0)*s*s/(2*L);
  pts.push({x,y,heading,station:s,curvature:k0+(k1-k0)*s/L});
 }
 return pts;
}
export function buildAlignment(start,segments,step=.5){
 if(!start||!Number.isFinite(start.x)||!Number.isFinite(start.y)||!Number.isFinite(start.heading))throw Error('Âncora CAD inválida');
 let pose={...start},station=0;const points=[{...pose,station,curvature:0}],ranges=[];
 for(const [idx,seg] of segments.entries()){
  const sub=sampleSegment(pose,seg,step),s0=station;
  for(const p of sub.slice(1))points.push({...p,station:station+p.station});
  station+=Number(seg.length);pose={...sub.at(-1)};ranges.push({index:idx,type:seg.type,start:s0,end:station,curvatureStart:seg.type==='line'?0:seg.type==='arc'?Number(seg.curvature):Number(seg.k0),curvatureEnd:seg.type==='line'?0:seg.type==='arc'?Number(seg.curvature):Number(seg.k1)});
 }
 return {points,ranges,station};
}
export function segmentFromRadius(type,length,radius=0,endRadius=0,direction=1){
 const k=(r)=>r===0?0:direction/Math.abs(r);
 if(type==='line')return {type,length};
 if(type==='arc')return {type,length,curvature:k(radius)};
 return {type:'clothoid',length,k0:k(radius),k1:k(endRadius)};
}
export function geometricOffset(poly,distance){
 if(poly.length<2)return [];
 const out=[];for(let i=0;i<poly.length;i++){
  const a=poly[Math.max(0,i-1)],b=poly[Math.min(poly.length-1,i+1)];
  const dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy)||1;
  out.push({x:poly[i].x-dy/n*distance,y:poly[i].y+dx/n*distance});
 }return out;
}
export function roadSurface(path,width){
 if(!Number.isFinite(width)||width<=0)throw Error('Largura da pista inválida');
 const left=geometricOffset(path,width/2),right=geometricOffset(path,-width/2);
 return {left,right,polygon:[...left,...right.slice().reverse()]};
}
export function minimumRadiusFromSpeed(speedKmh,superelevation,friction){
 if(!(speedKmh>0&&superelevation>=0&&friction>=0&&superelevation+friction>0))throw Error('Parâmetros de raio mínimo inválidos');
 return speedKmh**2/(127*(superelevation+friction));
}
export function alignmentRules(segments,{speedKmh=40,superelevation=.06,friction=.15}={}){
 const required=minimumRadiusFromSpeed(speedKmh,superelevation,friction);let issues=[];
 for(let i=0;i<segments.length;i++){
  const s=segments[i],a=s.type==='line'?0:s.type==='arc'?Number(s.curvature):Number(s.k0),b=s.type==='clothoid'?Number(s.k1):a;
  const kmax=Math.max(Math.abs(a),Math.abs(b));if(kmax>0&&1/kmax<required-1e-7)issues.push({segment:i+1,radius:1/kmax,required,type:'minimum_radius',level:'warning'});
  if(i>0){const p=segments[i-1],kp=p.type==='line'?0:p.type==='arc'?Number(p.curvature):Number(p.k1);
   if(Math.abs(kp-a)>1e-5)issues.push({segment:i+1,type:'curvature_discontinuity',level:'warning',delta:Math.abs(kp-a)});
  }
 }
 return {requiredRadius:required,issues,inputs:{speedKmh,superelevation,friction},source:{dnit:'DNIT IPR 740 (2010), §5, raios mínimos e superelevação; conferir tabelas por classe e contexto',aashto:'AASHTO Green Book 7th ed. (2018), §3.3 — curva horizontal',status:'verificação exploratória com parâmetros informados pelo usuário; não é aprovação normativa'}};
}
