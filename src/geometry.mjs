export const rad = x => x * Math.PI / 180;
export const deg = x => x * 180 / Math.PI;
export function dist(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
export function lerp(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
export function length(poly){return poly.slice(1).reduce((s,p,i)=>s+dist(poly[i],p),0)}
export function resample(poly,step=1){
 if(poly.length<2)return [...poly];const out=[{...poly[0]}]; let carry=0;
 for(let i=1;i<poly.length;i++){
  let a=poly[i-1],b=poly[i],seg=dist(a,b);if(seg<1e-8)continue;
  let at=step-carry;
  while(at<=seg+1e-8){out.push(lerp(a,b,Math.min(1,at/seg)));at+=step}
  carry=seg-(at-step);if(carry>=step-1e-8)carry=0;
 }
 if(dist(out[out.length-1],poly.at(-1))>1e-5)out.push({...poly.at(-1)});
 return out;
}
export function nearestPointDistance(p,poly){let best=Infinity;
 for(let i=1;i<poly.length;i++){
  let a=poly[i-1],b=poly[i],dx=b.x-a.x,dy=b.y-a.y,v=dx*dx+dy*dy;
  if(v<1e-12)continue;
  let t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/v));
  best=Math.min(best,dist(p,{x:a.x+t*dx,y:a.y+t*dy}));
 }return best;
}
export function poseRectangle(origin,theta,length,width,rearToBack){
 const ux=Math.cos(theta),uy=Math.sin(theta),vx=-uy,vy=ux;
 const rect=[[-rearToBack,-width/2],[length-rearToBack,-width/2],[length-rearToBack,width/2],[-rearToBack,width/2]];
 return rect.map(([a,b])=>({x:origin.x+a*ux+b*vx,y:origin.y+a*uy+b*vy}));
}
export function coordinateFrame(lat0,lon0){
 const R=6378137,c=Math.cos(rad(lat0));
 return {toXY:({lat,lng})=>({x:R*rad(lng-lon0)*c,y:R*rad(lat-lat0)}),toLatLng:({x,y})=>({lat:lat0+deg(y/R),lng:lon0+deg(x/(R*c))})};
}
export function simulate(path,vehicle,step=.6){
 if(path.length<2)throw Error('Desenhe pelo menos dois pontos');
 if(vehicle.wheelbase<=0||vehicle.width<=0||vehicle.length<=0)throw Error('Dimensões inválidas');
 const points=resample(path,step),states=[],env=[];
 const h0=Math.atan2(points[1].y-points[0].y,points[1].x-points[0].x);
 let trailerTheta=h0,trailerAxle=null;
 let maxAngle=0,maxGap=0;
 for(let i=0;i<points.length;i++){
  const p=points[i],next=points[Math.min(i+1,points.length-1)],prev=points[Math.max(0,i-1)];
  const theta=Math.atan2(next.y-prev.y,next.x-prev.x);
  const tractor=poseRectangle(p,theta,vehicle.length,vehicle.width,vehicle.rearOverhang);
  let trailer=null,angle=0;
  if(vehicle.trailer){
   const hitch={x:p.x-vehicle.hitchOffset*Math.cos(theta),y:p.y-vehicle.hitchOffset*Math.sin(theta)};
   if(!trailerAxle){trailerTheta=theta;trailerAxle={x:hitch.x-vehicle.trailerAxleToHitch*Math.cos(theta),y:hitch.y-vehicle.trailerAxleToHitch*Math.sin(theta)}};
   // Modelo cinemático: o eixo do reboque segue o engate, sem escorregamento lateral.
   if(i>0){
    const dx=hitch.x-(states.at(-1).hitch.x),dy=hitch.y-(states.at(-1).hitch.y);
    const dS=Math.hypot(dx,dy),hHeading=Math.atan2(dy,dx);
    const n=Math.max(1,Math.ceil(dS/.12));
    for(let k=0;k<n;k++){
     const delta=dS/n;
     trailerTheta+=delta*Math.sin(hHeading-trailerTheta)/vehicle.trailerAxleToHitch;
     // A posição do eixo é reconstruída após a integração para preservar a restrição do engate.
    }
   }
   trailerAxle={x:hitch.x-vehicle.trailerAxleToHitch*Math.cos(trailerTheta),y:hitch.y-vehicle.trailerAxleToHitch*Math.sin(trailerTheta)};
   const trailerBack=vehicle.trailerLength-vehicle.trailerAxleToHitch;
   trailer=poseRectangle(trailerAxle,trailerTheta,vehicle.trailerLength,vehicle.trailerWidth,trailerBack);
   angle=Math.abs(Math.atan2(Math.sin(theta-trailerTheta),Math.cos(theta-trailerTheta)));
   maxAngle=Math.max(maxAngle,angle);
   maxGap=Math.max(maxGap,dist(hitch,{x:trailerAxle.x+vehicle.trailerAxleToHitch*Math.cos(trailerTheta),y:trailerAxle.y+vehicle.trailerAxleToHitch*Math.sin(trailerTheta)}));
  }
  states.push({p,theta,tractor,trailer,trailerAxle,hitch:{x:p.x-((vehicle.trailer?vehicle.hitchOffset:0)*Math.cos(theta)),y:p.y-((vehicle.trailer?vehicle.hitchOffset:0)*Math.sin(theta))},angle});
  env.push(tractor);if(trailer)env.push(trailer);
 }
 return {states,env,length:length(path),maxAngle:deg(maxAngle),trailerNumericalGap:maxGap};
}
export function evaluate(sim,path,roadWidth,clearance=0){
 const half=roadWidth/2-clearance;
 let worst=0,failCount=0,total=0;
 for(const poly of sim.env){for(const p of poly){const outside=nearestPointDistance(p,path)-half;worst=Math.max(worst,outside);if(outside>1e-6)failCount++;total++}}
 return {clear:failCount===0,violatingVertices:failCount,checkedVertices:total,maxExcess:worst};
}
