import {simulateDetour} from './detour.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:simulateDetour(data.base,data.config)})}catch(e){self.postMessage({error:e.message})}};
