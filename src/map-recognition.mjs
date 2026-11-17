/** Vector-first visible-viewport road recognition; OCR is only a text assist. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function crossesSegment(a,b,box){
 // Liang-Barsky clipping in lon/lat, appropriate for this viewport-scale test.
 const dx=b[0]-a[0],dy=b[1]-a[1],p=[-dx,dx,-dy,dy],q=[a[0]-box.west,box.east-a[0],a[1]-box.south,box.north-a[1]];
 let t0=0,t1=1;for(let i=0;i<4;i++){if(Math.abs(p[i])<1e-15){if(q[i]<0)return false;continue}const r=q[i]/p[i];if(p[i]<0)t0=Math.max(t0,r);else t1=Math.min(t1,r);if(t0>t1)return false}return true;
}
export function visibleRoads(roads,bbox,{limit=1500}={}){
 if(!Array.isArray(roads))throw Error('Vias inválidas');
 const {south,west,north,east}=bbox;
 if(![south,west,north,east].every(Number.isFinite)||south>=north||west>=east)throw Error('Janela inválida');
 return roads.filter(r=>Array.isArray(r.coordinates)&&r.coordinates.some(p=>p[0]>=west&&p[0]<=east&&p[1]>=south&&p[1]<=north)||r.coordinates.some((p,i)=>i>0&&crossesSegment(r.coordinates[i-1],p,bbox))).slice(0,limit).map(r=>({id:String(r.id),name:r.name||'Sem nome',class:r.tags?.highway||'não classificada',geometry:r.coordinates,source:r.source||'OSM'}));
}
export function dedupeStreetNames(roads){const m=new Map();for(const r of roads){const name=String(r.name||'').trim();if(!name||/^(via sem nome|sem nome)$/i.test(name))continue;const k=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!m.has(k))m.set(k,{name,segments:0,classes:new Set()});const o=m.get(k);o.segments++;o.classes.add(r.class)}return [...m.values()].map(v=>({...v,classes:[...v.classes]})).sort((a,b)=>b.segments-a.segments||a.name.localeCompare(b.name));}
export function ocrWordHints(words,imageWidth,imageHeight,bbox,{minConfidence=45}={}){
 if(!(imageWidth>0&&imageHeight>0))throw Error('Dimensões inválidas');
 return words.filter(w=>String(w.text||'').trim().length>1&&Number(w.confidence)>=minConfidence).map(w=>{
  const b=w.bbox||{x0:w.x0,y0:w.y0,x1:w.x1,y1:w.y1};if(!b||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite))return null;
  const x=clamp((b.x0+b.x1)/2/imageWidth,0,1),y=clamp((b.y0+b.y1)/2/imageHeight,0,1);
  // Mercator interpolation in pixel space, approximate screenshot bounds only.
  const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
  const inv=my=>(2*Math.atan(Math.exp(my))-Math.PI/2)*180/Math.PI;
  return {text:String(w.text).trim(),confidence:Number(w.confidence),lng:bbox.west+x*(bbox.east-bbox.west),lat:inv(merc(bbox.north)+y*(merc(bbox.south)-merc(bbox.north))),source:'ocr-screenshot',verified:false};
 }).filter(Boolean);
}
