import {coordinateFrame} from './geometry.mjs';
/** Import points that have ALREADY been semantically classified. No automatic neural segmentation. */
export function parseClassifiedRoadCSV(text,{maxPoints=10000}={}){
 if(typeof text!=='string')throw Error('CSV inválido');const rows=[];let rejected=0;
 for(const [i,raw] of text.split(/\r?\n/).entries()){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  const pieces=line.split(/[,;\t]/).map(x=>x.trim().replace(/^"|"$/g,''));
  if(i===0&&/longitude|lon|classe|class/i.test(line))continue;
  if(pieces.length<4){rejected++;continue;}
  const [lon,lat,z]=pieces.slice(0,3).map(Number),label=pieces[3].toLowerCase();
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||!Number.isFinite(z)||Math.abs(lon)>180||Math.abs(lat)>90){rejected++;continue;}
  if(!['road','pavement','asphalt','pista','pavimento','faixa'].includes(label))continue;
  rows.push({lon,lat,z,label});if(rows.length>maxPoints)throw Error('Limite de pontos classificados excedido ('+maxPoints+')');
 }
 return {points:rows,rejected};
}
const quantile=(sorted,q)=>{const i=(sorted.length-1)*q,a=Math.floor(i),b=Math.ceil(i);return sorted[a]*(1-(i-a))+sorted[b]*(i-a)};
/** Cross-sectional offsets of labelled road points relative to mapped centerline.
 * Input must share CRS: EPSG:4326 lon/lat. Width proxy only, not certified.
 */
export function measureRoadPointCloud(road,classified,{maxDistance=25,minPoints=20}={}){
 const coords=road.coordinates;if(coords.length<2)throw Error('Eixo sem comprimento');
 const f=coordinateFrame(coords[0][1],coords[0][0]);const axis=coords.map(([lng,lat])=>f.toXY({lng,lat}));const segments=[];let overall=0;
 for(let i=0;i<axis.length-1;i++){const a=axis[i],b=axis[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len>1e-4){segments.push({a,dx,dy,len,start:overall});overall+=len}}
 if(!segments.length)throw Error('Eixo degenerado');
 const samples=[];
 for(const p of classified){const xy=f.toXY({lng:p.lon,lat:p.lat});let best=null;
  for(const s of segments){const t=Math.max(0,Math.min(1,((xy.x-s.a.x)*s.dx+(xy.y-s.a.y)*s.dy)/(s.len*s.len))),qx=s.a.x+t*s.dx,qy=s.a.y+t*s.dy,d=Math.hypot(xy.x-qx,xy.y-qy);if(!best||d<best.d)best={d,offset:(s.dx*(xy.y-qy)-s.dy*(xy.x-qx))/s.len,station:s.start+t*s.len}}
  if(best&&best.d<=maxDistance)samples.push({...best,z:p.z});
 }
 if(samples.length<minPoints)throw Error('Pontos de pavimento insuficientes junto ao eixo: '+samples.length+'/'+minPoints);
 const left=samples.filter(x=>x.offset>0.1).map(x=>x.offset).sort((a,b)=>a-b),right=samples.filter(x=>x.offset<-.1).map(x=>x.offset).sort((a,b)=>a-b);
 if(left.length<minPoints*.15||right.length<minPoints*.15)throw Error('Amostras insuficientes dos dois lados do eixo; resultado não confiável');
 const l=quantile(left,.9),r=quantile(right,.1),stations=samples.map(s=>s.station).sort((a,b)=>a-b),coverage=(quantile(stations,.95)-quantile(stations,.05))/overall;
 if(coverage<.35)throw Error('Pontos cobrem menos de 35% da extensão longitudinal do eixo');
 return {widthMeters:l-r,leftOffsetMeters:l,rightOffsetMeters:r,pointsUsed:samples.length,coverage,method:'pontos de pavimento pré-classificados + quantis laterais P10/P90 + associação cartográfica',warning:'Estimativa exploratória; não é borda de pavimento certificada; depende da cobertura e dos rótulos da nuvem'};
}
