import {compareUrban,saturationUrban} from './urban-traffic.mjs';
self.onmessage=({data})=>{try{const result=data.kind==='saturation'?saturationUrban(data.document,data.levels):compareUrban(data.document,{baselineDocument:data.reference});self.postMessage({result})}catch(e){self.postMessage({error:e.message})}};
