// Deterministic topology diagnostics, explicit endpoint snap, and on-segment insertion.
import {dist,lerp} from './geometry.mjs';
function nearestOnSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,dd=dx*dx+dy*dy;if(dd<1e-15)return {point:{...a},t:0,distance:dist(p,a)};const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/dd)),point=lerp(a,b,t);return {point,t,distance:dist(p,point)}}
export function cleanPolyline(line,tolerance=.05){if(!Array.isArray(line))throw Error('Via inválida');const out=[];for(const p of line){if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))throw Error('Coordenada inválida');if(!out.length||dist(out.at(-1),p)>tolerance)out.push({...p})}return out}
export function diagnoseNetwork(lines,tolerance=1){
 if(!Array.isArray(lines)||!(tolerance>0))throw Error('Rede ou tolerância inválida');
 const endpoints=[];for(let i=0;i<lines.length;i++)if(lines[i].length>=2)for(const end of [0,1])endpoints.push({line:i,end,point:lines[i][end?lines[i].length-1:0]});
 const issues=[];for(let a=0;a<endpoints.length;a++)for(let b=a+1;b<endpoints.length;b++){
  const u=endpoints[a],v=endpoints[b];if(u.line===v.line)continue;const d=dist(u.point,v.point);
  if(d<=tolerance&&d>1e-7)issues.push({type:'near_endpoints',a:u,b:v,distance:d});
 }
 return {endpoints:endpoints.length,nearPairs:issues.length,issues,tolerance};
}
export function snapEndpoints(lines,tolerance=1){
 const clean=lines.map(l=>cleanPolyline(l,1e-8));const ends=[];
 for(let i=0;i<clean.length;i++)if(clean[i].length>=2)for(const end of [0,1])ends.push({i,end,p:clean[i][end?clean[i].length-1:0]});
 // Union-find prevents order-dependent chains, but disallow clusters whose maximum span exceeds tolerance.
 const parent=ends.map((_,i)=>i),find=(i)=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){
  if(ends[i].i===ends[j].i||dist(ends[i].p,ends[j].p)>tolerance)continue;
  const a=find(i),b=find(j);if(a===b)continue;
  const members=ends.map((_,k)=>k).filter(k=>find(k)===a||find(k)===b);
  if(members.every(k=>members.every(m=>dist(ends[k].p,ends[m].p)<=tolerance)))parent[b]=a;
 }
 const groups=new Map();for(let i=0;i<ends.length;i++){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i)}
 let moved=0;for(const indices of groups.values())if(indices.length>1){const p={x:indices.reduce((s,i)=>s+ends[i].p.x,0)/indices.length,y:indices.reduce((s,i)=>s+ends[i].p.y,0)/indices.length};for(const k of indices){const e=ends[k];if(dist(e.p,p)>1e-7)moved++;clean[e.i][e.end?clean[e.i].length-1:0]={...p}}}
 return {lines:clean,moved,clusters:[...groups.values()].filter(x=>x.length>1).length};
}
export function repairSelectedEndpoint(path,network,tolerance=2){
 if(path.length<2)return {path,changed:false};const pts=cleanPolyline(path,1e-8);let best=null;
 for(const end of [0,1]){const p=pts[end?pts.length-1:0];for(const line of network){for(let j=1;j<line.length;j++){
  const candidate=nearestOnSegment(p,line[j-1],line[j]);if(candidate.distance>1e-7&&candidate.distance<=tolerance&&(!best||candidate.distance<best.distance))best={end,...candidate};
 }}}
 if(!best)return {path:pts,changed:false};pts[best.end?pts.length-1:0]=best.point;return {path:pts,changed:true,distance:best.distance,end:best.end};
}
