// RoadWorks v0.9: preliminary cut/fill and daylight side-slope quantities.
// Signed vertical difference: design - natural = fill (+), cut (-).
const good=z=>typeof z==='number'&&Number.isFinite(z);
export function signedAreas(samples){let cut=0,fill=0;for(let i=1;i<samples.length;i++){
 const a=samples[i-1],b=samples[i];if(!good(a.d)||!good(b.d))throw Error('Terreno não cobre toda a seção; volume não calculado');const w=b.u-a.u;if(!(w>0))throw Error('Offsets de seção precisam ser crescentes');
 if(a.d*b.d<0){const t=Math.abs(a.d)/(Math.abs(a.d)+Math.abs(b.d));const first=w*t*Math.abs(a.d)/2,second=w*(1-t)*Math.abs(b.d)/2;if(a.d>0){fill+=first;cut+=second;}else{cut+=first;fill+=second;}}
 else if(a.d>=0&&b.d>=0)fill+=w*(a.d+b.d)/2;else cut+=-w*(a.d+b.d)/2;
 }return {cut,fill};}
function xy(sec,u){return {x:sec.x-Math.sin(sec.heading)*u,y:sec.y+Math.cos(sec.heading)*u};}
function natural(terrain,sec,u){const p=xy(sec,u);return terrain.sample(p.x,p.y);}
export function findDaylight(sec,edge,side,terrain,{cutHV=1.5,fillHV=2,maxReach=60,step=.5}={}){
 if(![cutHV,fillHV,maxReach,step].every(v=>good(v)&&v>0))throw Error('Taludes: parâmetros devem ser positivos');
 const zn=natural(terrain,sec,edge.offset);if(!good(zn))throw Error(`Terreno sem cobertura na borda, estaca ${sec.station.toFixed(1)}m`);
 const diff=edge.z-zn,kind=diff>=0?'fill':'cut',hv=kind==='fill'?fillHV:cutHV;
 const slope=kind==='fill'?-1/hv:1/hv;
 const at=d=>{const u=edge.offset+side*d,p=xy(sec,u),design=edge.z+slope*d,ground=terrain.sample(p.x,p.y);return {station:sec.station,u,x:p.x,y:p.y,z:design,ground,d:ground===null?null:design-ground,dist:d}};
 if(Math.abs(diff)<1e-7)return {point:at(0),kind,hv,reach:0};
 let prev=at(0);
 for(let d=Math.min(step,maxReach);d<=maxReach+1e-8;d=Math.min(d+step,maxReach)){
  const next=at(d);if(!good(next.ground))throw Error(`Terreno sem cobertura em talude, estaca ${sec.station.toFixed(1)}m, distância ${d.toFixed(1)}m`);
  if(prev.d*next.d<=0){let lo=prev.dist,hi=next.dist;for(let k=0;k<30;k++){const mid=(lo+hi)/2,q=at(mid);if(!good(q.ground))throw Error('Terreno inválido no encontro do talude');if(q.d*prev.d>0)lo=mid;else hi=mid;}const p=at((lo+hi)/2);return {point:p,kind,hv,reach:p.dist};}
  prev=next;if(d===maxReach)break;
 }
 throw Error(`Talude não encontra terreno até ${maxReach}m, estaca ${sec.station.toFixed(1)}m, lado ${side<0?'direito':'esquerdo'}`);
}
export function earthworkSection(sec,terrain,{cutHV=1.5,fillHV=2,maxReach=60,lateralStep=.5}={}){
 if(!sec.samples||sec.samples.length<2)throw Error('Seção de corredor inválida');
 const right=sec.samples[0],left=sec.samples.at(-1);
 const dayRight=findDaylight(sec,right,-1,terrain,{cutHV,fillHV,maxReach,step:lateralStep}),dayLeft=findDaylight(sec,left,1,terrain,{cutHV,fillHV,maxReach,step:lateralStep});
 const sampleDesign=u=>{if(u<right.offset)return right.z+(right.offset-u)*(dayRight.kind==='fill'?-1/fillHV:1/cutHV);if(u>left.offset)return left.z+(u-left.offset)*(dayLeft.kind==='fill'?-1/fillHV:1/cutHV);for(let j=1;j<sec.samples.length;j++){const b=sec.samples[j];if(u<=b.offset+1e-9){const a=sec.samples[j-1],t=(u-a.offset)/(b.offset-a.offset);return a.z+t*(b.z-a.z);}}return left.z;};
 let us=[dayRight.point.u,dayLeft.point.u,...sec.samples.map(p=>p.offset)];
 for(const [a,b] of [[dayRight.point.u,right.offset],[left.offset,dayLeft.point.u]]){
  for(let u=a+lateralStep;u<b-1e-8;u+=lateralStep)us.push(u);
 }
 for(let j=1;j<sec.samples.length;j++)for(let u=sec.samples[j-1].offset+lateralStep;u<sec.samples[j].offset-1e-8;u+=lateralStep)us.push(u);
 us=[...new Set(us.map(u=>+u.toFixed(8)))].sort((a,b)=>a-b);
 const samples=us.map(u=>{const p=xy(sec,u),ground=terrain.sample(p.x,p.y);if(!good(ground))throw Error(`Terreno sem cobertura na estaca ${sec.station.toFixed(1)}m, offset ${u.toFixed(2)}m`);const z=sampleDesign(u);return {u,x:p.x,y:p.y,z,naturalZ:ground,d:z-ground};});
 const area=signedAreas(samples);
 return {station:sec.station,cutArea:area.cut,fillArea:area.fill,rightEdge:right,leftEdge:left,rightDaylight:dayRight,leftDaylight:dayLeft,samples};
}
export function calculateEarthworks(corridor,terrain,options={}){
 if(!corridor?.sections?.length||!terrain?.sample)throw Error('Corredor ou terreno não definido');
 if(corridor.sections.length>10001)throw Error('Volume: reduza a densidade da malha para até 10 mil seções');
 const sections=corridor.sections.map(s=>earthworkSection(s,terrain,options)),segments=[];let cut=0,fill=0;
 for(let i=1;i<sections.length;i++){const a=sections[i-1],b=sections[i],ds=b.station-a.station;if(!(ds>0))throw Error('Estacas duplicadas');const vc=ds*(a.cutArea+b.cutArea)/2,vf=ds*(a.fillArea+b.fillArea)/2;cut+=vc;fill+=vf;segments.push({from:a.station,to:b.station,cutM3:vc,fillM3:vf,cumulativeCutM3:cut,cumulativeFillM3:fill});}
 return {schema:'roadworks-earthworks/0.9',sections,segments,cutM3:cut,fillM3:fill,netM3:fill-cut,options:{cutHV:options.cutHV??1.5,fillHV:options.fillHV??2,maxReach:options.maxReach??60,lateralStep:options.lateralStep??.5},method:'seções transversais amostradas + método das áreas médias; encontro de taludes por busca de raiz',limitations:['Estimativa preliminar sem fator de empolamento, compactação, perdas ou transporte.','Sem áreas de pavimentação separadas nem remoção de solo vegetal.','Volumes sensíveis à resolução MDT, passo longitudinal e amostragem transversal.','Terreno precisa cobrir toda a plataforma e ambos os encontros de talude.']};
}
export function earthworksCSV(result){return ['estaca_inicial_m,estaca_final_m,corte_m3,aterro_m3,corte_acumulado_m3,aterro_acumulado_m3',...result.segments.map(s=>[s.from,s.to,s.cutM3,s.fillM3,s.cumulativeCutM3,s.cumulativeFillM3].map(v=>v.toFixed(3)).join(','))].join('\n')+'\n';}
export function earthworksSectionCSV(result){return ['estaca_m,area_corte_m2,area_aterro_m2,talude_direito_m,talude_esquerdo_m',...result.sections.map(s=>[s.station,s.cutArea,s.fillArea,s.rightDaylight.reach,s.leftDaylight.reach].map(v=>v.toFixed(3)).join(','))].join('\n')+'\n';}
export function earthworksOBJ(result){const lines=['# RoadWorks v0.9 taludes: X/Y horizontal Z vertical, metros','o taludes'];let index=0;
 for(const side of ['rightDaylight','leftDaylight']){
  lines.push('g '+side);for(const sec of result.sections){const p=sec[side].point,edge=side==='rightDaylight'?sec.samples.find(s=>Math.abs(s.u-sec.samples[0].u)<1e-8):sec.samples.at(-1); // use platform boundary from between daylight and center below
   const e=side==='rightDaylight'?sec.rightEdge:sec.leftEdge;for(const v of [e,p])lines.push(`v ${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}`);
  }
  for(let i=0;i<result.sections.length-1;i++){const a=index+i*2+1,b=a+1,c=a+2,d=c+1;lines.push(`f ${a} ${b} ${c}`,`f ${b} ${d} ${c}`);}index+=result.sections.length*2;
 }
 return lines.join('\n')+'\n';}
