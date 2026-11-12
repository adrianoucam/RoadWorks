/** RoadWorks v1.1: deterministic, editable, non-normative procedural road components. */
import {segmentFromRadius,buildAlignment} from './cad.mjs';
const check=(n,min,max,label)=>{n=Number(n);if(!Number.isFinite(n)||n<min||n>max)throw Error(`${label}: esperado ${min}–${max}`);return n};
export const COMPONENTS=Object.freeze([
 {id:'straight',label:'Reta de implantação',description:'Segmento retilíneo editável'},
 {id:'curve',label:'Curva com transições',description:'Clotóide de entrada, arco e clotóide de saída'},
 {id:'reverse',label:'Curvas reversas',description:'Duas curvas de sinais opostos com continuidade de curvatura'},
 {id:'access',label:'Acesso com transição',description:'Reta de aproximação e curva circular com transição'},
]);
export function createComponent(id,{length=120,radius=100,transition=25,direction=1,lanes=2,laneWidth=3.5,shoulder=1.5}={}){
 length=check(length,15,3000,'Comprimento');radius=check(radius,10,20000,'Raio');transition=check(transition,0,500,'Transição');
 lanes=check(lanes,1,12,'Faixas');laneWidth=check(laneWidth,2,5,'Largura de faixa');shoulder=check(shoulder,0,8,'Acostamento');
 if(![-1,1].includes(Number(direction)))throw Error('Sentido deve ser -1 ou 1');direction=Number(direction);
 const line=L=>segmentFromRadius('line',L),arc=L=>segmentFromRadius('arc',L,radius,0,direction),cl=(L,r0,r1,sg=direction)=>segmentFromRadius('clothoid',L,r0,r1,sg);
 let segments=[];
 if(id==='straight')segments=[line(length)];
 else if(id==='curve'){
  if(2*transition>=length)throw Error('A soma das clotóides deve ser menor que o comprimento');
  segments=transition>0?[cl(transition,0,radius),arc(length-2*transition),cl(transition,radius,0)]:[arc(length)];
 }else if(id==='reverse'){
  if(4*transition>=length)throw Error('Transições muito longas para a reversa');
  const a=(length-4*transition)/2;
  segments=transition>0?[cl(transition,0,radius),arc(a),cl(transition,radius,0),cl(transition,0,radius,-direction),segmentFromRadius('arc',a,radius,0,-direction),cl(transition,radius,0,-direction)]:[arc(length/2),segmentFromRadius('arc',length/2,radius,0,-direction)];
 }else if(id==='access'){
  if(transition>=length/2)throw Error('Transição muito longa');
  segments=[line(length/2),...(transition>0?[cl(transition,0,radius)]:[]),arc(length/2-transition)];
 }else throw Error('Componente não reconhecido');
 // Validate by constructing independent local alignment; caller can append to the CAD editor.
 const alignment=buildAlignment({x:0,y:0,heading:0},segments,2);
 return {id,segments,parameters:{length,radius,transition,direction,lanes,laneWidth,shoulder},section:{lanes,laneWidth,shoulder},lengthMeters:alignment.station,source:'procedural-user-parameters',normative:false};
}
export function componentPreview(component,anchor={x:0,y:0,heading:0}){return buildAlignment(anchor,component.segments,2).points;}
export function componentRecipeJSON(component){return JSON.stringify({schema:'roadworks-component/1.1',...component},null,2);}
