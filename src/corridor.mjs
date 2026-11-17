// RoadWorks v0.7 — independent, deterministic 3D corridor surface generator.
// This module generates only the DESIGN surface; no natural terrain or earthwork volumes.
import {pathStations,atStation,verticalModel} from './vertical.mjs';
import {sectionLayout} from './roadmodel.mjs';

const n=(x,name)=>{if(!Number.isFinite(Number(x)))throw Error(name+' inválido');return Number(x)};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function corridorOffsets(section){
 const layout=sectionLayout(section), cuts=[layout.rightEdge,layout.leftEdge,0,layout.innerLeft,layout.innerRight];
 for(const lane of layout.lanes)cuts.push(lane.offsetMin,lane.offsetMax);
 // Subdivide the sections at the shoulders, carriageways, and median boundaries.
 cuts.push(-layout.innerRight+0); // duplicate intentional, removed below
 const uniq=[...new Set(cuts.map(v=>Math.round(v*1e8)/1e8))].sort((a,b)=>a-b);
 if(uniq.length<3)throw Error('Seção sem largura transversal');
 const bandType=(u)=>{
  if(u>=-layout.innerRight && u<=layout.innerLeft && layout.median>0)return 'median';
  if(u<-(layout.median/2+layout.lanesPerDirection*layout.laneWidth)||u>(layout.median/2+layout.lanesPerDirection*layout.laneWidth))return 'shoulder';
  return 'lane';
 };
 return {layout,offsets:uniq,bands:uniq.slice(0,-1).map((start,i)=>({start,end:uniq[i+1],kind:bandType((start+uniq[i+1])/2)}))};
}
export function crossElevation(zCenter,offset,{crossfallPercent=2,superelevationPercent=null}={}){
 const cross=n(crossfallPercent,'Declividade transversal');
 if(Math.abs(cross)>25)throw Error('Declividade transversal fora do limite do protótipo');
 if(superelevationPercent===null||superelevationPercent==='')return zCenter-Math.abs(offset)*Math.abs(cross)/100;
 const bank=n(superelevationPercent,'Superelevação');
 if(Math.abs(bank)>25)throw Error('Superelevação fora do limite do protótipo');
 return zCenter+offset*bank/100;
}
export function generateCorridor({path,profile,section,step=2,crossfallPercent=2,superelevationPercent=null,maxStations=15000}={}){
 step=n(step,'Passo longitudinal');if(step<.2||step>100)throw Error('Passo longitudinal deve ser entre 0,2 e 100 m');
 const pathS=pathStations(path),total=pathS.at(-1),vm=verticalModel(profile,total);
 const {layout,offsets,bands}=corridorOffsets(section),count=Math.max(1,Math.ceil(total/step));
 if(count+1>maxStations)throw Error('Quantidade de estacas excede o limite do modelo');
 const sections=[],vertices=[],positions=[];
 for(let i=0;i<=count;i++){
  const s=(i===count)?total:Math.min(total,i*step),p=atStation(path,s,pathS),v=vm.evaluate(s);
  const leftNormal={x:-Math.sin(p.heading),y:Math.cos(p.heading)};
  const samples=offsets.map((u,j)=>{
   const point={x:p.x+leftNormal.x*u,y:p.y+leftNormal.y*u,z:crossElevation(v.elevation,u,{crossfallPercent,superelevationPercent}),offset:u,station:s};
   vertices.push(point);positions.push(point.x,point.z,-point.y);
   return point;
  });
  sections.push({station:s,x:p.x,y:p.y,heading:p.heading,elevation:v.elevation,gradePercent:v.gradePercent,samples});
 }
 const triangles=[],trianglesByBand=bands.map(()=>[]),nv=offsets.length;
 for(let i=0;i<count;i++)for(let j=0;j<nv-1;j++){
  const a=i*nv+j,b=(i+1)*nv+j,c=a+1,d=b+1;
  // Index consistent with the Three.js coordinate convention [x,z,-y].
  const t1=[a,c,b],t2=[c,d,b];triangles.push(t1,t2);trianglesByBand[j].push(t1,t2);
 }
 const areaApprox=bands.reduce((sum,b)=>sum+(b.end-b.start)*total,0);
 return {schema:'roadworks-corridor/0.7',total,step,layout,offsets,bands,sections,vertices,positions,triangles,trianglesByBand,metrics:{lengthMeters:total,platformWidthMeters:layout.platformWidth,surfaceAreaApproxM2:areaApprox,stations:sections.length,vertices:vertices.length,triangles:triangles.length},limitations:['Superfície acabada somente, não inclui terreno natural.','Offsets e tangentes são amostrados; precisão depende do passo longitudinal.','Sem verificação de gabarito, drenagem, terraplenagem, transições de superelevação ou homologação normativa.']};
}
export function corridorOBJ(corridor,{objectName='RoadWorks_Corredor'}={}){
 if(!corridor?.vertices?.length)throw Error('Corredor vazio');
 const safe=String(objectName).replace(/[^A-Za-z0-9_-]/g,'_');
 const lines=['# RoadWorks v0.7 — design surface; metric local coordinates','o '+safe];
 for(const v of corridor.vertices)lines.push(`v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}`);
 for(let j=0;j<corridor.bands.length;j++){
  lines.push('g '+corridor.bands[j].kind+'_'+j);
  for(const t of corridor.trianglesByBand[j])lines.push('f '+t.map(v=>v+1).join(' '));
 }
 return lines.join('\n')+'\n';
}
export function corridorSectionsCSV(corridor){
 const rows=['estaca_m,offset_m,x_local_m,y_local_m,cota_projeto_m,tipo_banda'];
 for(const sec of corridor.sections)for(let j=0;j<sec.samples.length;j++){
  const p=sec.samples[j],kind=j===0?'borda_direita':j===sec.samples.length-1?'borda_esquerda':'quebra_secao';
  rows.push([sec.station.toFixed(3),p.offset.toFixed(3),p.x.toFixed(4),p.y.toFixed(4),p.z.toFixed(4),kind].join(','));
 }
 return rows.join('\n')+'\n';
}
export function corridorSummary(c){return {schema:c.schema,...c.metrics,bands:c.bands,limitations:c.limitations};}
