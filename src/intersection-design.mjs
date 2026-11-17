// RoadWorks v0.5 — lane-level planar junction geometry. SI units, local XY.
// A circular fillet is G1 tangent to the incoming and outgoing directed lines.
// This is a screening/teaching model, NOT a certified road intersection design.
import {dist,simulate,rad} from './geometry.mjs';
import {sectionGeometry,sectionLayout} from './roadmodel.mjs';
import {findCrossings} from './intersections.mjs';
import {pointInPolygon,sweptCells,distanceToSegment} from './swept.mjs';
const EPS=1e-8;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const mul=(a,k)=>({x:a.x*k,y:a.y*k});
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const norm=a=>{const n=Math.hypot(a.x,a.y);if(n<EPS)throw Error('Direção degenerada');return mul(a,1/n)};
const left=a=>({x:-a.y,y:a.x});
const angle=a=>Math.atan2(a.y,a.x);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function classifyMovement(incoming,outgoing){
 const u=norm(incoming),v=norm(outgoing),turn=wrap(angle(v)-angle(u)),abs=Math.abs(turn);
 return {kind:abs<rad(12)?'straight':abs>rad(165)?'uturn':turn>0?'left':'right',angleDegrees:turn*180/Math.PI};
}
export function laneDirections(section){return sectionLayout(section).lanes.map(l=>({id:l.id,direction:l.direction,offset:l.centerOffset,width:l.width}));}
export function directedLane(path,section,laneId){
 const lane=sectionGeometry(path,section).lanes.find(l=>l.id===laneId);
 if(!lane)throw Error(`Faixa desconhecida: ${laneId}`);
 const pts=lane.direction===1?lane.center:lane.center.slice().reverse();
 return {id:lane.id,direction:lane.direction,width:lane.width,points:pts};
}
export function lineCrossing(p,u,q,v){const den=cross(u,v);if(Math.abs(den)<EPS)return null;const t=cross(sub(q,p),v)/den,s=cross(sub(q,p),u)/den;return {point:add(p,mul(u,t)),t,s};}
function cumulative(path,index,t){let s=0;for(let i=1;i<index;i++)s+=dist(path[i-1],path[i]);return s+t*dist(path[index-1],path[index]);}
function totalLength(path){return path.slice(1).reduce((a,p,i)=>a+dist(path[i],p),0)}
export function circularFillet(origin,u,v,radius,{approachLength=24,departureLength=24,step=.4}={}){
 if(!(radius>0&&Number.isFinite(radius)))throw Error('Raio deve ser positivo');
 const a=norm(u),b=norm(v),movement=classifyMovement(a,b),turn=rad(movement.angleDegrees),angleAbs=Math.abs(turn);
 if(movement.kind==='uturn')throw Error('Retorno de 180° exige geometria específica');
 if(movement.kind==='straight'){
  if(angleAbs>rad(2))throw Error('Deflexão pequena não nula: ajuste alinhamento para trecho reto');
  const start=sub(origin,mul(a,approachLength)),end=add(origin,mul(b,departureLength));
  return {points:[start,{...origin},end],arc:[],radius:Infinity,tangentLength:0,turnDegrees:movement.angleDegrees,movement:movement.kind,center:null};
 }
 if(angleAbs>=Math.PI-1e-4)throw Error('Deflexão próxima de 180° não suportada');
 const t=radius*Math.tan(angleAbs/2);
 if(!(approachLength>=t&&departureLength>=t))throw Error(`Espaço insuficiente: tangência exige ${t.toFixed(2)} m em cada aproximação; disponível ${approachLength.toFixed(2)} / ${departureLength.toFixed(2)} m`);
 const sign=Math.sign(turn),start=sub(origin,mul(a,t)),end=add(origin,mul(b,t));
 const center=add(start,mul(left(a),sign*radius));
 const c2=add(end,mul(left(b),sign*radius));
 if(dist(center,c2)>Math.max(1e-5,radius*1e-6))throw Error('Incompatibilidade geométrica de centro do arco');
 const theta0=angle(sub(start,center)),n=Math.max(2,Math.ceil(radius*angleAbs/Math.max(.1,step)));
 const arc=Array.from({length:n+1},(_,i)=>{const th=theta0+turn*i/n;return add(center,{x:radius*Math.cos(th),y:radius*Math.sin(th)})});
 const lead=sub(origin,mul(a,approachLength)),exit=add(origin,mul(b,departureLength));
 return {points:[lead,...arc,exit],arc,center,radius,tangentLength:t,turnDegrees:movement.angleDegrees,movement:movement.kind,tangentStart:start,tangentEnd:end};
}
export function designLaneTurn(roadA,roadB,{sectionA,sectionB,fromLane='L1',toLane='L1',radius=12,approachLength=40,departureLength=40,step=.5,allowLeft=true,allowRight=true,allowStraight=true}={}){
 if(!Array.isArray(roadA)||roadA.length<2||!Array.isArray(roadB)||roadB.length<2)throw Error('Duas vias com ao menos dois pontos são necessárias');
 const incoming=directedLane(roadA,sectionA,fromLane),outgoing=directedLane(roadB,sectionB,toLane);
 // Offset lane centerlines do not always geometrically cross within their finite bounds.
 // Find the intersection of supporting lines near the crossing of road centerlines.
 const roadCross=findCrossings(roadA,roadB)[0];
 if(!roadCross)throw Error('Vias centrais não se cruzam geometricamente');
 let best=null;
 for(let i=1;i<incoming.points.length;i++)for(let j=1;j<outgoing.points.length;j++){
  const p=incoming.points[i-1],q=outgoing.points[j-1],u=norm(sub(incoming.points[i],p)),v=norm(sub(outgoing.points[j],q));
  const meet=lineCrossing(p,u,q,v);if(!meet)continue;
  const near=dist(meet.point,{x:roadCross.x,y:roadCross.y});
  if(near>Math.max(80,2*Math.max(approachLength,departureLength,radius)))continue;
  const sIn=cumulative(incoming.points,i,meet.t/dist(p,incoming.points[i])),sOut=cumulative(outgoing.points,j,meet.s/dist(q,outgoing.points[j]));
  const cost=near+Math.abs(meet.t-.5)*.02+Math.abs(meet.s-.5)*.02;
  if(!best||cost<best.cost)best={point:meet.point,u,v,cost,sIn,sOut};
 }
 if(!best)throw Error('Não foi possível obter interseção das tangentes das faixas');
 const move=classifyMovement(best.u,best.v);
 const allowed={left:allowLeft,right:allowRight,straight:allowStraight,uturn:false};
 if(!allowed[move.kind])throw Error(`Movimento ${move.kind} proibido pela política configurada`);
 const availableIn=Math.min(approachLength,best.sIn),availableOut=Math.min(departureLength,totalLength(outgoing.points)-best.sOut);
 if(availableIn<=0||availableOut<=0)throw Error('Via não contém comprimento útil suficiente para a manobra');
 const fillet=circularFillet(best.point,best.u,best.v,radius,{approachLength:availableIn,departureLength:availableOut,step});
 return {...fillet,fromLane,toLane,roadA,roadB,sectionA,sectionB,approachAvailable:availableIn,departureAvailable:availableOut,source:'v0.5 tangent line circular fillet, not clothoid',warning:'Checar vértices, alinhamento real, implantação, gabaritos, acessos e continuidade de curvatura; OSM não informa restrições completas de conversão'};
}
// Verify a discrete swept footprint against the union of the TWO existing road platforms.
// Does not model a separately designed corner curb return or expanded junction pavement.
export function checkIntersectionFootprint(turn,simulation,{clearance=0,maxCells=1400,edgeStep=.5}={}){
 if(!turn.roadA||!turn.roadB||!turn.sectionA||!turn.sectionB)throw Error('Geometria das duas plataformas indisponível');
 if(!(edgeStep>0&&maxCells>0))throw Error('Passo de amostragem inválido');
 const surfaces=[sectionGeometry(turn.roadA,turn.sectionA),sectionGeometry(turn.roadB,turn.sectionB)];
 const polys=surfaces.map(x=>x.polygon);const cells=sweptCells(simulation.states);
 const stride=Math.max(1,Math.ceil(cells.length/maxCells));let checked=0,violations=0,maximum=0;const bad=[];
 for(let i=0;i<cells.length;i+=stride){const cell=cells[i];checked++;let outside=false;
  const pts=cell.polygon;
  for(let j=0;j<pts.length;j++){
   const a=pts[j],b=pts[(j+1)%pts.length],steps=Math.max(1,Math.ceil(dist(a,b)/edgeStep));
   for(let k=0;k<=steps;k++){
    const p=add(a,mul(sub(b,a),k/steps));
    if(polys.some(poly=>pointInPolygon(p,poly)))continue;
    outside=true;
    let nearest=Infinity;
    for(const poly of polys)for(let t=0;t<poly.length;t++)nearest=Math.min(nearest,distanceToSegment(p,poly[t],poly[(t+1)%poly.length]));
    maximum=Math.max(maximum,nearest);
   }
  }
  if(outside){violations++;if(bad.length<100)bad.push({frame:cell.frame,part:cell.part});}
 }
 return {clear:violations===0,checkedCells:checked,violatingCells:violations,maxOutside:Math.max(0,maximum-clearance),offenders:bad,method:'edge-sampled intersection union of road cross-sections',limitations:'Amostragem discreta de bordas sobre união de duas plataformas; não testa integralmente o interior de todas as células, nem considera alargamentos de esquina, cotas ou gabaritos verticais. Precisa de validação por CAD de engenharia.'};
}
export function checkDesignVehicle(turn,vehicle,{steeringLimitDegrees=35,clearance=.3,articulationLimitDegrees=75,maxSteps=3000}={}){
 if(!turn?.points||!vehicle)throw Error('Trajeto e veículo são necessários');
 if(!(steeringLimitDegrees>0&&steeringLimitDegrees<90))throw Error('Limite de esterçamento inválido');
 const rMin=vehicle.wheelbase/Math.tan(rad(steeringLimitDegrees));
 const radiusOK=turn.radius===Infinity||turn.radius>=rMin-1e-8;
 if(turn.points.length>maxSteps)throw Error('Trajetória muito extensa para análise interativa');
 const simulation=simulate(turn.points,vehicle,.4);
 const articulationOK=!vehicle.trailer||simulation.maxAngle<=articulationLimitDegrees;
 const width=Math.max(vehicle.width,vehicle.trailer?vehicle.trailerWidth:0);
 const footprint=turn.roadA&&turn.roadB?checkIntersectionFootprint(turn,simulation,{clearance}):null;
 return {footprint,radiusOK,articulationOK,feasiblePreliminary:radiusOK&&articulationOK&&(!footprint||footprint.clear),minSteeringRadius:rMin,designRadius:turn.radius,turnAngle:turn.turnDegrees,maxArticulationDegrees:simulation.maxAngle,vehicleWidth:width,clearance,simulation,limitations:'Modelo bicicleta simplificado sem pneus/eixos múltiplos; comparação de envelopes amostrados apenas contra a união das duas plataformas, sem projeto do alargamento de esquina. A compatibilidade não é homologação.'};
}
