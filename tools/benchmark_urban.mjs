/** Run: node tools/benchmark_urban.mjs [path/to/previous/urban-traffic.mjs] */
import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import * as current from '../src/urban-traffic.mjs';
const network=JSON.parse(readFileSync(new URL('../samples/niteroi_rede_OSM_sem_demanda.json',import.meta.url),'utf8'));
network.settings.durationSeconds=2400;const edge=network.edges[0];network.od=[{id:'BENCHMARK_FICTICIO',from:edge.from,to:edge.to,mode:'car',rateVph:600,begin:0,end:1800,occupancy:1.4}];network.source='mixed';
const studies=[current.exampleUrban(),network];
function measure(module){const cases=[];for(const study of studies){module.simulateUrban(study);const times=[];let result;for(let i=0;i<5;i++){const start=performance.now();result=module.simulateUrban(study);times.push(performance.now()-start)}times.sort((a,b)=>a-b);cases.push({edges:study.edges.length,seconds:study.settings.durationSeconds,medianMs:times[2],result})}return cases}
const after=measure(current),before=process.argv[2]?measure(await import(pathToFileURL(resolve(process.argv[2])))):null;
const reports=after.map((a,i)=>({edges:a.edges,seconds:a.seconds,currentMedianMs:a.medianMs,...(before?{previousMedianMs:before[i].medianMs,sameOutputs:JSON.stringify(a.result)===JSON.stringify(before[i].result),speedup:before[i].medianMs/a.medianMs}:{})}));
console.log(JSON.stringify({benchmark:'five runs after one warmup; machine-dependent; demand is synthetic',cases:reports},null,2));if(before&&reports.some(r=>!r.sameOutputs))process.exitCode=1;
