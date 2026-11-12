// Geometric intersection prototype: planar crossing and cubic Hermite turn connector.
import {dist} from './geometry.mjs';
const cross=(a,b)=>a.x*b.y-a.y*b.x;
export function segmentCrossing(a,b,c,d){const u={x:b.x-a.x,y:b.y-a.y},v={x:d.x-c.x,y:d.y-c.y};const det=cross(u,v);if(Math.abs(det)<1e-9)return null;const delta={x:c.x-a.x,y:c.y-a.y},t=cross(delta,v)/det,s=cross(delta,u)/det;if(t<-1e-9||t>1+1e-9||s<-1e-9||s>1+1e-9)return null;return {x:a.x+t*u.x,y:a.y+t*u.y,t,s}}
export function findCrossings(a,b){const hits=[];for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){const p=segmentCrossing(a[i-1],a[i],b[j-1],b[j]);if(p)hits.push({...p,i,j})}return hits}
export function tangent(path,index){const a=path[Math.max(0,index-1)],b=path[Math.min(path.length-1,index+1)],d=dist(a,b)||1;return {x:(b.x-a.x)/d,y:(b.y-a.y)/d}}
export function turnConnector(from,into,{offsetStart=16,offsetEnd=16,steps=30,minChord=1}={}){
 if(!from?.point||!into?.point||!from?.heading||!into?.heading)throw Error('Extremidades de conversão inválidas');
 const p0=from.point,p1=into.point,chord=dist(p0,p1);if(chord<minChord)throw Error('Pontos de início e fim muito próximos');
 const a=Math.max(1,Math.min(offsetStart,chord*1.2)),b=Math.max(1,Math.min(offsetEnd,chord*1.2));
 const out=[];for(let i=0;i<=steps;i++){const t=i/steps,q=1-t;
  const h00=2*t**3-3*t*t+1,h10=t**3-2*t*t+t,h01=-2*t**3+3*t*t,h11=t**3-t*t;
  out.push({x:h00*p0.x+h10*a*from.heading.x+h01*p1.x+h11*b*into.heading.x,y:h00*p0.y+h10*a*from.heading.y+h01*p1.y+h11*b*into.heading.y});
 }return out;
}
export function crossingTurn(pathA,pathB,{approach=15,departure=15,steps=36}={}){
 const crosses=findCrossings(pathA,pathB);if(!crosses.length)throw Error('As duas vias não se cruzam em nível geométrico');
 const hit=crosses[0],origin={x:hit.x,y:hit.y};
 // First road approaches from pathA[i-1]; second departs toward pathB[j].
 const before=pathA[hit.i-1],after=pathB[hit.j];
 const u=tangent(pathA,hit.i-1),v=tangent(pathB,hit.j);
 const start={x:origin.x-u.x*approach,y:origin.y-u.y*approach};
 const end={x:origin.x+v.x*departure,y:origin.y+v.y*departure};
 const connector=turnConnector({point:start,heading:u},{point:end,heading:v},{steps,offsetStart:approach,offsetEnd:departure});
 return {crossing:origin,connector,sourceSegments:[hit.i,hit.j],note:'Conexão Hermite preliminar: validar curvatura, faixa, sentidos e interferências'};
}
