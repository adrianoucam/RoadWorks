import {sensitivityUrban,calibrateUrban,trainDemand,fitOriginDestination,principalComponents} from './urban-analysis.mjs';
self.onmessage=({data})=>{try{
 let result;
 switch(data.kind){
  case 'sensitivity':result=sensitivityUrban(data.study,data.input);break;
  case 'calibration':result=calibrateUrban(data.study,data.input.observations,{...data.input.options,observationSource:data.input.source});break;
  case 'demand':result=trainDemand(data.input.dataset,data.input.options);break;
  case 'od':result={...fitOriginDestination(data.study,data.input),observationSource:data.input.source};break;
  case 'pca':result=principalComponents(data.input);break;
  default:throw Error('Análise desconhecida');
 }self.postMessage({result});
}catch(e){self.postMessage({error:e.message})}};
