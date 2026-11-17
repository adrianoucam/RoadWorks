// RoadWorks v0.4: road section objects and sampled lane boundaries.
import {geometricOffset,roadSurface} from './cad.mjs';
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
export const SECTION_PRESETS=Object.freeze({
 rural_two:{name:'Rural — pista simples (modelo ilustrativo)',lanesPerDirection:1,laneWidth:3.5,shoulderLeft:1.5,shoulderRight:2,median:0},
 rural_dual:{name:'Rural — pista dupla (modelo ilustrativo)',lanesPerDirection:2,laneWidth:3.5,shoulderLeft:2,shoulderRight:2.5,median:2},
 urban_arterial:{name:'Travessia urbana (modelo ilustrativo)',lanesPerDirection:2,laneWidth:3.25,shoulderLeft:0,shoulderRight:0.5,median:1.5},
 custom:{name:'Personalizado',lanesPerDirection:1,laneWidth:3.6,shoulderLeft:0,shoulderRight:0,median:0}
});
export function validateSection(section){
 const s={...section};const n=Number(s.lanesPerDirection);
 if(!Number.isInteger(n)||n<1||n>6)throw Error('Faixas por sentido devem ser um inteiro de 1 a 6');
 for(const k of ['laneWidth','shoulderLeft','shoulderRight','median']){s[k]=Number(s[k]);if(!finite(s[k])||s[k]<0||s[k]>30)throw Error('Dimensão inválida: '+k)}
 if(s.laneWidth<2||s.laneWidth>5)throw Error('Largura de faixa deve estar entre 2 e 5 m');
 s.lanesPerDirection=n;return s;
}
export function sectionLayout(section){
 const s=validateSection(section),n=s.lanesPerDirection,w=s.laneWidth;
 const paved=n*2*w+s.median,whole=paved+s.shoulderLeft+s.shoulderRight;
 // One centerline for entire platform; physical median is centered on reference line.
 const lanes=[];
 for(let side of [-1,1])for(let i=0;i<n;i++){
  const inner=s.median/2+i*w,outer=inner+w;
  const a=side===1?inner:-outer,b=side===1?outer:-inner;
  lanes.push({id:`${side===1?'L':'R'}${i+1}`,direction:side===1?1:-1,offsetMin:a,offsetMax:b,centerOffset:(a+b)/2,width:w});
 }
 const leftEdge=s.median/2+n*w+s.shoulderLeft,rightEdge=-(s.median/2+n*w+s.shoulderRight);
 return {...s,lanes,trafficWidth:2*n*w,platformWidth:whole,leftEdge,rightEdge,innerLeft:s.median/2,innerRight:-s.median/2};
}
export function sectionGeometry(path,section){
 if(!Array.isArray(path)||path.length<2)throw Error('Eixo viário precisa de dois pontos');
 const layout=sectionLayout(section);
 const offset=(d)=>geometricOffset(path,d);
 const boundaries={left:offset(layout.leftEdge),right:offset(layout.rightEdge),medianLeft:offset(layout.innerLeft),medianRight:offset(layout.innerRight)};
 const lanes=layout.lanes.map(l=>({...l,left:offset(l.offsetMax),right:offset(l.offsetMin),center:offset(l.centerOffset)}));
 const polygon=[...boundaries.left,...boundaries.right.slice().reverse()];
 return {layout,boundaries,lanes,polygon,left:boundaries.left,right:boundaries.right,centerline:path};
}
export function laneForOffset(layout,offset){return layout.lanes.find(l=>offset>=l.offsetMin&&offset<=l.offsetMax)||null}
