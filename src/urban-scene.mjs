/** Pure, bounded urban geometry in local metres. No inferred surveyed elevations. */
import {coordinateFrame} from './geometry.mjs';
import {validateUrban} from './urban-traffic.mjs';
import {terrainPreview,terrainFromGrid} from './terrain.mjs';
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateOrigin(o){if(!o||!finite(o.lat,-85,85)||!finite(o.lon,-180,180))throw Error('Origem geográfica inválida');return {lat:o.lat,lon:o.lon}}

/** Restores a decimated preview without inventing triangles across NoData holes. */
export function meshTerrain(mesh){
 if(!mesh||!Array.isArray(mesh.vertices)||!Array.isArray(mesh.triangles)||mesh.vertices.length<3||mesh.vertices.length>20000||mesh.triangles.length>40000)throw Error('Malha de terreno inválida ou acima do limite');
 const vertices=mesh.vertices.map(p=>{if(!finite(p.x,-200000,200000)||!finite(p.y,-200000,200000)||!finite(p.z,-12000,12000))throw Error('Coordenada do terreno inválida');return {...p}});
 const triangles=mesh.triangles.map(t=>{if(!Array.isArray(t)||t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))throw Error('Face de terreno inválida');return [...t]});
 const extent={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const p of vertices){extent.minX=Math.min(extent.minX,p.x);extent.maxX=Math.max(extent.maxX,p.x);extent.minY=Math.min(extent.minY,p.y);extent.maxY=Math.max(extent.maxY,p.y)}
 const size=32,cells=new Map(),sx=Math.max(1,extent.maxX-extent.minX),sy=Math.max(1,extent.maxY-extent.minY),cell=(x,y)=>[Math.max(0,Math.min(size-1,Math.floor((x-extent.minX)/sx*size))),Math.max(0,Math.min(size-1,Math.floor((y-extent.minY)/sy*size)))];
 const faces=[];for(const t of triangles){const [a,b,c]=t.map(i=>vertices[i]),den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-10)continue;const face={a,b,c,den};faces.push(face);const lo=cell(Math.min(a.x,b.x,c.x),Math.min(a.y,b.y,c.y)),hi=cell(Math.max(a.x,b.x,c.x),Math.max(a.y,b.y,c.y));for(let i=lo[0];i<=hi[0];i++)for(let j=lo[1];j<=hi[1];j++){const key=i+':'+j;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(face)}}
 if(!faces.length)throw Error('Terreno sem faces não degeneradas');
 return {type:'mesh',source:mesh.source||'Prévia importada',metadata:mesh.metadata||{},vertices,triangles,extent,sample(x,y){if(x<extent.minX||x>extent.maxX||y<extent.minY||y>extent.maxY)return null;const [i,j]=cell(x,y);for(const {a,b,c,den} of cells.get(i+':'+j)||[]){const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-8)return u*a.z+v*b.z+w*c.z}return null}};
}
export function terrainSnapshot(terrain,origin){
 validateOrigin(origin);const preview=terrain.type==='mesh'?terrain:terrainPreview(terrain,{maxCells:6000});
 const snapshot={origin,vertices:preview.vertices,triangles:preview.triangles,source:terrain.source,metadata:{...terrain.metadata,previewOnly:true,warning:'Prévia para visualização; não substitui o MDT original para cálculos de volumes.'}};
 if(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength>2000000)throw Error('Prévia de terreno acima de 2 MB; recorte ou reduza o arquivo');return snapshot;
}
export function syntheticUrbanTerrain(document){
 const d=validateUrban(document),origin={lat:d.city.lat,lon:d.city.lon},frame=coordinateFrame(origin.lat,origin.lon),pts=d.nodes.map(n=>frame.toXY({lat:n.lat,lng:n.lon}));if(!pts.length)throw Error('Carregue uma rede urbana');
 const minX=Math.min(...pts.map(p=>p.x))-100,minY=Math.min(...pts.map(p=>p.y))-100,maxX=Math.max(...pts.map(p=>p.x))+100,maxY=Math.max(...pts.map(p=>p.y))+100,n=41,dx=(maxX-minX)/(n-1),dy=(maxY-minY)/(n-1);
 const values=Array.from({length:n*n},(_,k)=>{const x=minX+(k%n)*dx,y=minY+Math.floor(k/n)*dy;return 20+35*Math.exp(-((x-(minX+maxX)/2)**2+(y-(minY+maxY)/2)**2)/90000)+.01*x});
 return {origin,terrain:terrainFromGrid({width:n,height:n,values,originX:minX,originY:minY,dx,dy,source:'TERRENO FICTÍCIO — NÃO É TOPOGRAFIA DE NITERÓI',metadata:{sourceType:'synthetic',verticalDatum:'fictício',crs:'XY local em metros',origin}})};
}
export function buildUrbanScene(input,{origin,terrain=null,terrainOrigin=null,spacing=15,selectedId=null,queues={},time=0}={}){
 const d=validateUrban(input);origin=validateOrigin(origin||{lat:d.city.lat,lon:d.city.lon});if(!finite(spacing,5,100)||!finite(time,0,14400))throw Error('Resolução/instante da cena inválidos');const frame=coordinateFrame(origin.lat,origin.lon),nodes=new Map(d.nodes.map(n=>[n.id,frame.toXY({lat:n.lat,lng:n.lon})]));
 let terrainMesh=null,sample=()=>0,baseElevation=0;const warnings=new Set();
 if(terrain){const nativeOrigin=validateOrigin(terrainOrigin),native=coordinateFrame(nativeOrigin.lat,nativeOrigin.lon),preview=terrain.type==='mesh'?terrain:terrainPreview(terrain,{maxCells:10000});const vertices=preview.vertices.map(p=>{const ll=native.toLatLng(p);return {...frame.toXY(ll),z:p.z}});terrainMesh={vertices,triangles:preview.triangles,source:terrain.source,metadata:terrain.metadata};baseElevation=vertices.reduce((m,p)=>Math.min(m,p.z),Infinity);if(!Number.isFinite(baseElevation))throw Error('Terreno sem cotas válidas');sample=(x,y)=>{const ll=frame.toLatLng({x,y}),p=native.toXY(ll);return terrain.sample(p.x,p.y)}}else warnings.add('Sem MDT: plano de referência z=0, não elevação real.');
 const directed=new Set(d.edges.map(e=>`${e.osmWay||''}|${e.from}|${e.to}`)),roads=[];let missing=0,unknownLevels=0,totalSections=0;
 for(const e of d.edges){const a=nodes.get(e.from),b=nodes.get(e.to),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.01)continue;
  const laneWidth=e.visualGeometry?.laneWidthM??3.2,offset=e.visualGeometry?.elevationOffsetM,absolute=e.visualGeometry?.elevationM;if(!finite(laneWidth,2,5)||offset!==undefined&&!finite(offset,-500,500)||absolute!==undefined&&!finite(absolute,-1000,9000))throw Error(`Geometria visual inválida: ${e.id}`);
  const tags=e.tags||{},special=tags.bridge==='yes'||tags.tunnel==='yes'||Number(tags.layer||0)!==0,verticalUnknown=special&&offset===undefined&&absolute===undefined;if(verticalUnknown){unknownLevels++;warnings.add('Pontes/túneis sem cota: representação esquemática no plano de referência; layer não é altura em metros.')}
  const width=laneWidth*e.lanes,hasReverse=directed.has(`${e.osmWay||''}|${e.to}|${e.from}`),shift=hasReverse?width/2+.15:0,nx=dy/length,ny=-dx/length,count=Math.max(1,Math.min(512,Math.ceil(length/spacing)));totalSections+=count+1;if(totalSections>60000)throw Error('Cena muito detalhada: aumente o espaçamento ou reduza a área');
  const sections=[];for(let i=0;i<=count;i++){const t=i/count,x=a.x+dx*t+nx*shift,y=a.y+dy*t+ny*shift,left={x:x-nx*width/2,y:y-ny*width/2},right={x:x+nx*width/2,y:y+ny*width/2};let z=absolute??(verticalUnknown?0:sample(x,y)),zl=absolute??(verticalUnknown?0:sample(left.x,left.y)),zr=absolute??(verticalUnknown?0:sample(right.x,right.y));if(z===null||zl===null||zr===null){missing++;sections.push({x,y,z:null});continue}z+=offset||0;left.z=zl+(offset||0);right.z=zr+(offset||0);sections.push({x,y,z,left,right})}
  const events=d.events.filter(v=>v.edge===e.id&&v.begin<=time&&time<v.end),queue=Number(queues[e.id]||0);roads.push({id:e.id,name:e.name||e.id,lanes:e.lanes,laneWidth,width,sections,selected:e.id===selectedId,verticalUnknown,source:e.source||d.source,queue:Number.isFinite(queue)&&queue>=0?queue:0,event:events.some(v=>v.closedLanes>=e.lanes)?'closed':events.length?'work':null,direction:{x:dx/length,y:dy/length},hasReverse,assumptions:e.assumptions||['Largura de faixa visual configurada; não é levantamento']});
 }
 if(missing)warnings.add(`${missing} amostras de vias fora da cobertura/NoData: superfícies omitidas nessas lacunas.`);
 const extent={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const p of [...nodes.values(),...(terrainMesh?.vertices||[])]){extent.minX=Math.min(extent.minX,p.x);extent.maxX=Math.max(extent.maxX,p.x);extent.minY=Math.min(extent.minY,p.y);extent.maxY=Math.max(extent.maxY,p.y)}if(!Number.isFinite(extent.minX))throw Error('Cena sem rede ou terreno');
 const inventory=(d.inventory||[]).map(a=>{const p=frame.toXY({lat:a.lat,lng:a.lon});return {...a,...p,z:sample(p.x,p.y)}});
 return {schema:'roadworks-urban-scene/1.9',origin,baseElevation,roads,terrain:terrainMesh,inventory,extent,warnings:[...warnings],stats:{roads:roads.length,terrainFaces:terrainMesh?.triangles.length||0,missingSamples:missing,unknownLevels},source:d.source};
}
export function urbanSceneOBJ(scene){let next=1;const out=['# RoadWorks 1.9 — local XY metres, Z elevation; not surveyed unless input verified',`# WGS84 origin lat=${scene.origin.lat} lon=${scene.origin.lon}`,`# ${scene.warnings.join(' | ')}`];
 if(scene.terrain){out.push('o terrain');for(const p of scene.terrain.vertices)out.push(`v ${p.x} ${p.y} ${p.z}`);for(const t of scene.terrain.triangles)out.push('f '+t.map(i=>i+next).join(' '));next+=scene.terrain.vertices.length}
 for(const road of scene.roads){out.push('o road_'+road.id.replace(/[^\w.-]/g,'_'));for(let i=1;i<road.sections.length;i++){const a=road.sections[i-1],b=road.sections[i];if(a.z===null||b.z===null)continue;for(const p of [a.left,a.right,b.left,b.right])out.push(`v ${p.x} ${p.y} ${p.z+.08}`);out.push(`f ${next} ${next+1} ${next+2}`,`f ${next+1} ${next+3} ${next+2}`);next+=4}}
 return out.join('\n');
}
