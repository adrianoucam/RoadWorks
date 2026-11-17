/** RoadWorks Digital Twin: cartographic baseline and traceable asset register.
 * Geometry from OSM/GeoJSON is observational and approximate, never a survey.
 */
import {coordinateFrame} from './geometry.mjs';
const allowed=new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','living_street','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link']);
const widths={motorway:3.65,trunk:3.6,primary:3.5,secondary:3.5,tertiary:3.25,residential:3.0,unclassified:3.0,service:2.75,living_street:2.75};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const goodPt=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
function cleanCoords(coords){if(!Array.isArray(coords))throw Error('Coordenadas inválidas');const out=[];for(const p of coords){if(!goodPt(p))throw Error('Coordenada lon/lat inválida');if(!out.length||Math.hypot(out.at(-1)[0]-p[0],out.at(-1)[1]-p[1])>1e-10)out.push([p[0],p[1]])}if(out.length<2)throw Error('Trecho requer dois pontos distintos');return out;}
export function roadClass(tags={}){return allowed.has(tags.highway)?tags.highway:'unknown'}
export function inferWidth(tags={},opts={}){
 const c=roadClass(tags);const defaultLane=widths[c.replace(/_link$/,'')]||3.2;
 const laneCount=Number(tags.lanes),n=Number.isInteger(laneCount)&&laneCount>0&&laneCount<=12?laneCount:(['motorway','trunk'].includes(c)?4:2);
 const declared=Number(tags.width);
 const pavement=Number.isFinite(declared)&&declared>=2&&declared<=70?declared:n*defaultLane;
 const width=clamp(Number.isFinite(opts.overrideWidth)?opts.overrideWidth:pavement,2,70);
 const confidence=Number.isFinite(declared)&&declared>=2&&declared<=70?'mapped-width':'estimated-from-class';
 return {width,lanes:n,confidence,laneWidth:defaultLane};
}
export function normalizeRoadGeoJSON(input,{limit=2000}={}){
 if(!input||typeof input!=='object')throw Error('GeoJSON inválido');
 const features=input.type==='FeatureCollection'?input.features:input.type==='Feature'?[input]:[{type:'Feature',geometry:input,properties:{}}];
 if(!Array.isArray(features)||features.length>limit)throw Error('Quantidade de feições inválida (limite '+limit+')');
 const roads=[];let rejected=0;
 for(const [i,f] of features.entries()){
  const props=f.properties||{},geom=f.geometry||{},parts=geom.type==='LineString'?[geom.coordinates]:geom.type==='MultiLineString'?geom.coordinates:[];
  if(!parts.length){rejected++;continue;}
  for(const [j,part] of parts.entries()){
   let coords;try{coords=cleanCoords(part)}catch(e){rejected++;continue;}
   const highway=props.highway||props.road_class||'unclassified';
   const tags={...props,highway};
   roads.push({id:String(f.id??props['@id']??props.osm_id??'geojson-'+i)+'-'+j,name:String(props.name||props.ref||'Via sem nome'),tags,coordinates:coords,source:'GeoJSON',sourceId:String(f.id??props.osm_id??'feature-'+i),observedAt:null});
  }
 }
 return {roads,rejected};
}
export function roadsFromOverpass(elements){
 if(!Array.isArray(elements))throw Error('Resposta Overpass inválida');
 return elements.filter(e=>e.type==='way'&&Array.isArray(e.geometry)&&e.geometry.length>=2).map(e=>({
  id:'osm-way-'+e.id,name:e.tags?.name||e.tags?.ref||'Via sem nome',tags:e.tags||{},coordinates:e.geometry.map(p=>[p.lon,p.lat]),source:'OpenStreetMap / Overpass',sourceId:'way/'+e.id,observedAt:null
 })).filter(r=>r.coordinates.every(goodPt));
}
export function lengthMeters(coordinates){const c=cleanCoords(coordinates),f=coordinateFrame(c[0][1],c[0][0]);let d=0;for(let i=1;i<c.length;i++){const a=f.toXY({lng:c[i-1][0],lat:c[i-1][1]}),b=f.toXY({lng:c[i][0],lat:c[i][1]});d+=Math.hypot(b.x-a.x,b.y-a.y)}return d;}
/** Offset polygon in local metres; joins are averaged normals (miter-limited). */
export function roadFootprint(road,widthOverride=null){
 const coords=cleanCoords(road.coordinates),frame=coordinateFrame(coords[0][1],coords[0][0]),points=coords.map(([lng,lat])=>frame.toXY({lng,lat}));
 const settings=inferWidth(road.tags,{overrideWidth:widthOverride});const half=settings.width/2;
 const dirs=[];for(let i=0;i<points.length-1;i++){const dx=points[i+1].x-points[i].x,dy=points[i+1].y-points[i].y,n=Math.hypot(dx,dy);if(n<1e-4)throw Error('Vértices demasiado próximos');dirs.push({x:-dy/n,y:dx/n});}
 const sides=[[],[]];for(let i=0;i<points.length;i++){
  let n=i===0?dirs[0]:i===points.length-1?dirs.at(-1):{x:dirs[i-1].x+dirs[i].x,y:dirs[i-1].y+dirs[i].y};
  const nn=Math.hypot(n.x,n.y);if(nn<1e-7)n=dirs[Math.max(0,i-1)];else n={x:n.x/nn,y:n.y/nn};
  const dot=i===0||i===points.length-1?1:Math.abs(n.x*dirs[i-1].x+n.y*dirs[i-1].y);
  const miter=clamp(1/Math.max(dot,.1),1,2);
  for(const [idx,sign] of [[0,1],[1,-1]]){const p=frame.toLatLng({x:points[i].x+sign*half*miter*n.x,y:points[i].y+sign*half*miter*n.y});sides[idx].push([p.lng,p.lat]);}
 }
 const ring=[...sides[0],...sides[1].reverse()];ring.push([...ring[0]]);
 return {type:'Feature',properties:{id:road.id,name:road.name,source:road.source,sourceId:road.sourceId,highway:roadClass(road.tags),widthMeters:settings.width,widthEvidence:settings.confidence,estimatedLanes:settings.lanes,warning:'Envelope cartográfico aproximado; não é levantamento nem limite legal da pista'},geometry:{type:'Polygon',coordinates:[ring]}};
}
export function buildTwin(roads,{maxRoads=1200,minLength=5,overrideWidth=null,createdAt=new Date().toISOString()}={}){
 if(!Array.isArray(roads)||roads.length>maxRoads)throw Error('Quantidade de vias excede o limite do gêmeo');
 const assets=[],features=[],issues=[];
 for(const r of roads){try{
   const len=lengthMeters(r.coordinates);if(len<minLength)continue;
   const footprint=roadFootprint(r,overrideWidth);
   const asset={id:r.id,name:r.name,source:r.source,sourceId:r.sourceId,classification:roadClass(r.tags),lengthMeters:len,widthMeters:footprint.properties.widthMeters,widthEvidence:footprint.properties.widthEvidence,lanes:footprint.properties.estimatedLanes,review:'pendente',updatedAt:createdAt,observations:[],geometry:{type:'LineString',coordinates:r.coordinates},footprint:footprint.geometry};
   assets.push(asset);features.push(footprint,{type:'Feature',properties:{id:r.id,name:r.name,layer:'axis',source:r.source,review:'pendente'},geometry:asset.geometry});
  }catch(e){issues.push({id:r.id,error:e.message});}}
 return {schema:'roadworks-digital-twin/0.1',createdAt,crs:'EPSG:4326',status:'modelo_geometrico_sem_sincronizacao',assets,features,issues,provenance:{method:'OSM ou GeoJSON + largura cartográfica estimada',limitations:'Sem sensores, sem calibração geométrica e sem atualização em tempo real'}};
}
export function addInspection(twin,id,{status,note,observedAt=new Date().toISOString(),author='engenheiro'}={}){
 if(!twin||!Array.isArray(twin.assets))throw Error('Gêmeo inválido');
 const asset=twin.assets.find(a=>a.id===id);if(!asset)throw Error('Ativo não encontrado');
 if(!['pendente','verificado','revisar','interditado'].includes(status))throw Error('Situação inválida');
 if(typeof note!=='string'||note.length>2000)throw Error('Observação inválida');
 const observation={status,note,observedAt,author};asset.observations.push(observation);asset.review=status;asset.updatedAt=observedAt;return observation;
}
export function twinGeoJSON(twin){return {type:'FeatureCollection',name:'RoadWorks road twin geometries',features:twin.assets.flatMap(a=>[
 {type:'Feature',properties:{id:a.id,name:a.name,layer:'road_surface',review:a.review,width_m:a.widthMeters,source:a.source,source_id:a.sourceId},geometry:a.footprint},
 {type:'Feature',properties:{id:a.id,name:a.name,layer:'axis',review:a.review,source:a.source,source_id:a.sourceId},geometry:a.geometry}
 ])};}
