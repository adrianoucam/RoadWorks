// Geometry-based swept envelope: conservative inter-frame convex hulls; edge/area intersection.
import {roadSurface,geometricOffset} from './cad.mjs';
import {dist,lerp} from './geometry.mjs';
const EPS=1e-9;
export function cross(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
export function convexHull(points){
 const p=points.map(v=>({x:v.x,y:v.y})).sort((a,b)=>a.x-b.x||a.y-b.y);const unique=p.filter((v,i)=>!i||dist(v,p[i-1])>EPS);if(unique.length<=2)return unique;
 const low=[],up=[];for(const x of unique){while(low.length>=2&&cross(low.at(-2),low.at(-1),x)<=EPS)low.pop();low.push(x)}
 for(let i=unique.length-1;i>=0;i--){const x=unique[i];while(up.length>=2&&cross(up.at(-2),up.at(-1),x)<=EPS)up.pop();up.push(x)}return [...low.slice(0,-1),...up.slice(0,-1)];
}
export function pointInPolygon(pt,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const a=polygon[i],b=polygon[j];if(Math.abs(cross(a,b,pt))<1e-7&&pt.x>=Math.min(a.x,b.x)-1e-7&&pt.x<=Math.max(a.x,b.x)+1e-7&&pt.y>=Math.min(a.y,b.y)-1e-7&&pt.y<=Math.max(a.y,b.y)+1e-7)return true;
 if((a.y>pt.y)!==(b.y>pt.y)&&pt.x<(b.x-a.x)*(pt.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;}
export function segmentsIntersect(a,b,c,d){
 const o1=cross(a,b,c),o2=cross(a,b,d),o3=cross(c,d,a),o4=cross(c,d,b);
 if(o1*o2< -EPS&&o3*o4< -EPS)return true;
 const on=(p,q,r)=>Math.abs(cross(p,q,r))<EPS&&r.x>=Math.min(p.x,q.x)-EPS&&r.x<=Math.max(p.x,q.x)+EPS&&r.y>=Math.min(p.y,q.y)-EPS&&r.y<=Math.max(p.y,q.y)+EPS;
 return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
export function distanceToSegment(p,a,b){let dx=b.x-a.x,dy=b.y-a.y,s=dx*dx+dy*dy;if(!s)return dist(p,a);let t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/s));return dist(p,{x:a.x+t*dx,y:a.y+t*dy});}
export function polygonContained(inner,outer){
 if(inner.some(p=>!pointInPolygon(p,outer)))return false;
 for(let i=0;i<inner.length;i++){const a=inner[i],b=inner[(i+1)%inner.length];for(let j=0;j<outer.length;j++){
  const c=outer[j],d=outer[(j+1)%outer.length];if(segmentsIntersect(a,b,c,d)){
   // Touching/collinear edges are acceptable; crossing confirmed by two interior probes.
   if(!pointInPolygon(lerp(a,b,.49),outer)||!pointInPolygon(lerp(a,b,.51),outer))return false;
  }
 }}return true;
}
export function sweptCells(states){const all=[];for(let i=0;i<states.length;i++){
 for(const part of ['tractor','trailer']){
  const current=states[i][part];if(!current)continue;
  all.push({frame:i,part,polygon:i===0||!states[i-1][part]?current:convexHull([...current,...states[i-1][part]])});
 }
 }return all;}
export function evaluateSwept(states,path,width,clearance=0,{maxSamples=5000,sideOffsets=null}={}){
 const effectiveWidth=width-2*clearance;if(!(effectiveWidth>0))throw Error('Largura útil da via inválida');
 const surface=sideOffsets?(()=>{const left=geometricOffset(path,sideOffsets.left-clearance),right=geometricOffset(path,sideOffsets.right+clearance);if(sideOffsets.left-clearance<=sideOffsets.right+clearance)throw Error('Corredor útil insuficiente para folga lateral');return {left,right,polygon:[...left,...right.slice().reverse()]}})():roadSurface(path,effectiveWidth),cells=sweptCells(states),stride=Math.max(1,Math.ceil(cells.length/maxSamples));
 let collisions=0,maxOutside=0,sampled=0;const offenders=[];
 for(let i=0;i<cells.length;i+=stride){let cell=cells[i];sampled++;
  if(!polygonContained(cell.polygon,surface.polygon)){
   collisions++;if(offenders.length<100)offenders.push(cell);
   for(const p of cell.polygon)if(!pointInPolygon(p,surface.polygon)){
    let best=Infinity;for(let j=0;j<surface.polygon.length;j++)best=Math.min(best,distanceToSegment(p,surface.polygon[j],surface.polygon[(j+1)%surface.polygon.length]));
    maxOutside=Math.max(maxOutside,best);
   }
  }
 }
 return {clear:collisions===0,violatingCells:collisions,checkedCells:sampled,maxOutside,offenders,surface,method:'conservative_convex_hull_discrete',stride,limits:'Envelopes por casco convexo de poses sucessivas, amostragem temporal; não representa união exata de varredura contínua nem certificação normativa'};
}
