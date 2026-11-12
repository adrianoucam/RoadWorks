// RoadWorks v0.8: bounded, independent terrain algorithms in local metres.
// All datasets MUST have been converted into the current project frame before processing.
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const fail=m=>{throw new Error(m)};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const sqdist=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export function terrainFromGrid({width,height,values,originX,originY,dx,dy,dxY=0,dyX=0,nodata=null,source='grid',metadata={}}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>4e6)fail('Grid: dimensões inválidas ou muito grandes (máx. 4 milhões de células)');
 if(![originX,originY,dx,dy,dxY,dyX].every(finite)||Math.abs(dx*dy-dxY*dyX)<1e-12)fail('Grid: origem/resolução inválidas');
 if(!values||values.length!==width*height)fail('Grid: quantidade de cotas incompatível');
 const data=Float64Array.from(values,v=>Number(v));
 const sample=(x,y)=>{
  const xx=x-originX,yy=y-originY,det=dx*dy-dxY*dyX,c=(xx*dy-yy*dyX)/det,r=(yy*dx-xx*dxY)/det;
  if(c<0||r<0||c>width-1||r>height-1)return null;
  const i=Math.min(width-2,Math.floor(c)),j=Math.min(height-2,Math.floor(r)),tx=c-i,ty=r-j;
  const ids=[j*width+i,j*width+i+1,(j+1)*width+i,(j+1)*width+i+1],z=ids.map(k=>data[k]);
  const valid=v=>finite(v)&&(nodata===null||v!==nodata);
  // For exact cell boundaries, invalid neighbors with zero weight are ignored.
  const weights=[(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty];
  if(z.some((v,k)=>weights[k]>1e-10&&!valid(v)))return null;
  return z.reduce((acc,v,k)=>acc+(weights[k]>1e-10?v*weights[k]:0),0);
 };
 const corners=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]].map(([c,r])=>({x:originX+c*dx+r*dyX,y:originY+c*dxY+r*dy}));
 return {type:'grid',source,metadata,width,height,originX,originY,dx,dy,dxY,dyX,nodata,values:data,extent:{minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y))},sample};
}
function circumcircle(a,b,c){const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-12)return null;
 const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
 const x=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,y=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;return {x,y,r2:(x-a.x)**2+(y-a.y)**2};}
// Small TINs: Bowyer-Watson Delaunay triangulation; no interpolation outside convex hull.
export function triangulate(points,{maxPoints=2000}={}){
 if(!Array.isArray(points)||points.length<3||points.length>maxPoints)fail('TIN: requer de 3 a '+maxPoints+' pontos');
 for(const p of points)if(![p.x,p.y,p.z].every(finite))fail('TIN: coordenadas inválidas');
 const keys=new Set(points.map(p=>`${p.x.toFixed(7)},${p.y.toFixed(7)}`));if(keys.size!==points.length)fail('TIN: pontos XY duplicados');
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const span=Math.max(maxX-minX,maxY-minY);if(span<1e-8)fail('TIN: pontos coincidentes');const cx=(maxX+minX)/2,cy=(minY+maxY)/2,n=points.length;
 const pts=[...points,{x:cx-30*span,y:cy-20*span},{x:cx,y:cy+30*span},{x:cx+30*span,y:cy-20*span}];let triangles=[[n,n+1,n+2]];
 for(let i=0;i<n;i++){
  const bad=[],edges=new Map();
  for(let t=0;t<triangles.length;t++){
   const tri=triangles[t],circ=circumcircle(pts[tri[0]],pts[tri[1]],pts[tri[2]]);
   if(circ&&sqdist(pts[i],circ)<=circ.r2+1e-7){bad.push(t);for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],key=`${Math.min(a,b)}:${Math.max(a,b)}`;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
  }
  const remove=new Set(bad);triangles=triangles.filter((_,t)=>!remove.has(t));
  for(const [a,b] of edges.values())if(Math.abs(cross(pts[a],pts[b],pts[i]))>1e-10)triangles.push([a,b,i]);
 }
 return triangles.filter(t=>t.every(i=>i<n)&&Math.abs(cross(points[t[0]],points[t[1]],points[t[2]]))>1e-10);
}
export function terrainFromTIN(points,{maxEdge=Infinity,source='XYZ',metadata={}}={}){
 if(!(maxEdge>0))fail('TIN: limite de aresta inválido');const triangles=triangulate(points);if(!triangles.length)fail('TIN: pontos colineares');
 const kept=triangles.filter(t=>t.every((id,k)=>Math.sqrt(sqdist(points[id],points[t[(k+1)%3]]))<=maxEdge));
 if(!kept.length)fail('TIN: nenhuma face dentro do comprimento máximo');
 const boxes=kept.map(t=>{const p=t.map(i=>points[i]);return {t,p,minX:Math.min(...p.map(p=>p.x)),maxX:Math.max(...p.map(p=>p.x)),minY:Math.min(...p.map(p=>p.y)),maxY:Math.max(...p.map(p=>p.y))}});
 const sample=(x,y)=>{for(const b of boxes){if(x<b.minX-1e-8||x>b.maxX+1e-8||y<b.minY-1e-8||y>b.maxY+1e-8)continue;const [a,c,d]=b.p,den=cross(a,c,d),u=cross({x,y},c,d)/den,v=cross(a,{x,y},d)/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-8)return u*a.z+v*c.z+w*d.z;}return null};
 return {type:'tin',source,metadata,points,triangles:kept,extent:{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))},sample};
}
export function parseXYZ(text,{columns='xyz',frame=null,maxPoints=2000}={}){
 const rows=String(text).split(/\r?\n/),points=[];
 for(let k=0;k<rows.length;k++){const line=rows[k].trim();if(!line||line.startsWith('#')||line.startsWith('//'))continue;const fields=line.split(/[;,\t ]+/).map(Number);if(fields.length<3||fields.slice(0,3).some(v=>!finite(v))){if(points.length===0)continue;fail('XYZ: linha inválida '+(k+1));}
  let [x,y,z]=fields;if(columns==='lonlat'){if(!frame||Math.abs(x)>180||Math.abs(y)>90)fail('XYZ: longitude/latitude ou âncora inválida');const p=frame.toXY({lat:y,lng:x});x=p.x;y=p.y;}
  points.push({x,y,z});if(points.length>maxPoints)fail('XYZ: mais de '+maxPoints+' pontos — reduza/amostre o levantamento');
 }if(points.length<3)fail('XYZ: são necessários pelo menos três pontos');return points;
}
// A GIS GeoTIFF reader is injected, so pure geometry remains independently testable.
export async function terrainFromGeoTIFF(buffer,{frame,decoder,project,source='GeoTIFF'}={}){
 if(!frame||!decoder?.fromArrayBuffer)fail('GeoTIFF: biblioteca/âncora indisponível');
 const tif=await decoder.fromArrayBuffer(buffer),image=await tif.getImage(),width=image.getWidth(),height=image.getHeight();
 if(width*height>4e6)fail('GeoTIFF: mais de 4 milhões de pixels; recorte/reduza o MDT');
 const keys=image.getGeoKeys(),epsg=keys.ProjectedCSTypeGeoKey||keys.GeographicTypeGeoKey;
 if(!epsg)fail('GeoTIFF sem código EPSG identificado');
 const tie=image.getTiePoints()[0],scale=image.getFileDirectory().ModelPixelScale;
 if(!tie||!scale||!scale[0]||!scale[1])fail('GeoTIFF: requer transformação afim north-up por TiePoint e PixelScale; reprojete rasters rotacionados');
 const raster=await image.readRasters({samples:[0],interleave:true}),nodata=image.getGDALNoData();
 const toWorld=(col,row)=>[tie.x+(col-tie.i)*scale[0],tie.y-(row-tie.j)*scale[1]];
 const toLocal=(col,row)=>{const [x,y]=toWorld(col,row);let ll;if(epsg===4326)ll={lng:x,lat:y};else{if(!project)fail('GeoTIFF: EPSG:'+epsg+' precisa de transformação CRS cadastrada');const [lng,lat]=project(`EPSG:${epsg}`,'EPSG:4326',[x,y]);ll={lng,lat};}return frame.toXY(ll)};
 const a=toLocal(0,0),b=toLocal(1,0),c=toLocal(0,1);
 return terrainFromGrid({width,height,values:raster,originX:a.x,originY:a.y,dx:b.x-a.x,dxY:b.y-a.y,dy:c.y-a.y,dyX:c.x-a.x,nodata:nodata===null?null:Number(nodata),source,metadata:{epsg,crs:`EPSG:${epsg}`,geotransform:'north-up affine approximation in local tangent plane',note:'Projeção local aproximada; conferir datum, escala e precisão em campo'}});
}
export function terrainPreview(terrain,{maxCells=20000}={}){
 if(terrain.type==='tin')return {vertices:terrain.points,triangles:terrain.triangles};
 const {width,height,originX,originY,dx,dy,dxY=0,dyX=0}=terrain;
 const stride=Math.max(1,Math.ceil(Math.sqrt(width*height/maxCells))),vertices=[],triangles=[],ids=new Map();
 for(let r=0;r<height;r+=stride)for(let c=0;c<width;c+=stride){const x=originX+c*dx+r*dyX,y=originY+c*dxY+r*dy,z=terrain.sample(x,y);if(z===null)continue;ids.set(`${r}:${c}`,vertices.length);vertices.push({x,y,z});}
 for(let r=0;r+stride<height;r+=stride)for(let c=0;c+stride<width;c+=stride){const a=ids.get(`${r}:${c}`),b=ids.get(`${r}:${c+stride}`),d=ids.get(`${r+stride}:${c}`),e=ids.get(`${r+stride}:${c+stride}`);if([a,b,d,e].every(v=>v!==undefined))triangles.push([a,b,d],[b,e,d]);}
 return {vertices,triangles};
}
