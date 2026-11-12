/** RoadWorks 1.8: local numerical analysis. No sensors or signal optimization. */
import {validateUrban,simulateUrban,routeUrban} from './urban-traffic.mjs';

const finite=(x,label,min=-1e12,max=1e12)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw Error(`${label}: número inválido`);return x};
const array=(x,label,max)=>{if(!Array.isArray(x)||!x.length||x.length>max)throw Error(`${label}: lista vazia ou acima de ${max}`);return x};
const mean=x=>x.reduce((s,v)=>s+v,0)/x.length;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const ANALYSIS_SCHEMA='roadworks-analysis/1.8';
export function errorMetrics(actual,predicted){
 array(actual,'Observações',10000);if(!Array.isArray(predicted)||predicted.length!==actual.length)throw Error('Dimensões incompatíveis');let abs=0,sq=0;const avg=mean(actual);let total=0;
 actual.forEach((y,i)=>{finite(y,'Observado');finite(predicted[i],'Estimado');abs+=Math.abs(y-predicted[i]);sq+=(y-predicted[i])**2;total+=(y-avg)**2});
 return {n:actual.length,mae:abs/actual.length,rmse:Math.sqrt(sq/actual.length),r2:total>1e-12?1-sq/total:null};
}

/** Householder QR on an augmented ridge system; never forms inverse(X'X). */
export function fitRidge(X,y,lambda=1){
 array(X,'Matriz de atributos',10000);const p=X[0]?.length;if(!p||p>20||X.length<2||!Array.isArray(y)||y.length!==X.length)throw Error('Matriz de regressão inválida');finite(lambda,'Regularização',1e-8,1e8);
 for(const row of X){if(!Array.isArray(row)||row.length!==p)throw Error('Matriz irregular');row.forEach(v=>finite(v,'Atributo'))}y.forEach(v=>finite(v,'Resposta'));
 const means=Array.from({length:p},(_,j)=>mean(X.map(row=>row[j]))),scales=means.map((m,j)=>Math.sqrt(mean(X.map(row=>(row[j]-m)**2)))||1);
 const A=X.map(row=>[1,...row.map((v,j)=>(v-means[j])/scales[j])]),b=[...y],n=p+1;
 for(let j=1;j<n;j++){const row=Array(n).fill(0);row[j]=Math.sqrt(lambda);A.push(row);b.push(0)}
 for(let k=0;k<n;k++){
  let norm=0;for(let i=k;i<A.length;i++)norm=Math.hypot(norm,A[i][k]);if(norm<1e-12)throw Error('Sistema sem posto numérico suficiente');const alpha=A[k][k]>=0?-norm:norm;
  const v=A.slice(k).map(row=>row[k]);v[0]-=alpha;const vv=dot(v,v);
  for(let j=k;j<n;j++){let projection=0;for(let i=k;i<A.length;i++)projection+=v[i-k]*A[i][j];projection*=2/vv;for(let i=k;i<A.length;i++)A[i][j]-=projection*v[i-k]}
  let projection=0;for(let i=k;i<A.length;i++)projection+=v[i-k]*b[i];projection*=2/vv;for(let i=k;i<A.length;i++)b[i]-=projection*v[i-k];
 }
 const coefficients=Array(n).fill(0);for(let i=n-1;i>=0;i--){let value=b[i];for(let j=i+1;j<n;j++)value-=A[i][j]*coefficients[j];coefficients[i]=value/A[i][i];finite(coefficients[i],'Coeficiente')}
 return {schema:'roadworks-ridge/1.8',means,scales,coefficients,lambda,trainingRows:X.length,features:p};
}
export function predictRidge(model,X){return X.map(row=>{if(row.length!==model.features)throw Error('Atributos incompatíveis com o modelo');return model.coefficients[0]+row.reduce((s,v,j)=>s+(finite(v,'Atributo')-model.means[j])/model.scales[j]*model.coefficients[j+1],0)})}

function calendar(timestamp){
 if(typeof timestamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)||!Number.isFinite(Date.parse(timestamp)))throw Error('Timestamp deve ser ISO com fuso: 2026-11-12T08:00:00-03:00');
 const date=timestamp.slice(0,10),h=Number(timestamp.slice(11,13)),minute=Number(timestamp.slice(14,16));if(h>23||minute>59||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Calendário inválido');const hour=h+minute/60,day=new Date(date+'T00:00:00Z').getUTCDay();
 return {features:[Math.sin(2*Math.PI*hour/24),Math.cos(2*Math.PI*hour/24),Math.sin(2*Math.PI*day/7),Math.cos(2*Math.PI*day/7)],hour:h,time:Date.parse(timestamp),offset:timestamp.endsWith('Z')?'Z':timestamp.slice(-6)};
}
export function trainDemand(dataset,{lambda=1,testFraction=.25}={}){
 if(dataset?.schema!=='roadworks-demand-history/1.8'||!['observed','synthetic','mixed'].includes(dataset.source))throw Error('Histórico de demanda inválido');array(dataset.rows,'Histórico',5000);if(dataset.rows.length<24)throw Error('Informe ao menos 24 observações temporais');finite(testFraction,'Fração de teste',.15,.4);
 const rows=dataset.rows.map(r=>({...r,...calendar(r.timestamp),demandVph:finite(r.demandVph,'Demanda observada',0,30000)})).sort((a,b)=>a.time-b.time);
 if(new Set(rows.map(r=>r.time)).size!==rows.length)throw Error('Timestamps duplicados; use uma série por área e classe');if(new Set(rows.map(r=>r.offset)).size!==1)throw Error('Use o mesmo fuso explícito em toda a série');
 const split=Math.floor(rows.length*(1-testFraction)),train=rows.slice(0,split),test=rows.slice(split),model=fitRidge(train.map(r=>r.features),train.map(r=>r.demandVph),lambda),predictions=predictRidge(model,test.map(r=>r.features)).map(v=>Math.max(0,v));
 const trainMean=mean(train.map(r=>r.demandVph)),byHour=new Map();for(const r of train){const values=byHour.get(r.hour)||[];values.push(r.demandVph);byHour.set(r.hour,values)}
 const seasonal=test.map(r=>byHour.has(r.hour)?mean(byHour.get(r.hour)):trainMean),actual=test.map(r=>r.demandVph),metrics=errorMetrics(actual,predictions),baseline=errorMetrics(actual,seasonal);
 return {schema:'roadworks-demand-model/1.8',source:dataset.source,unit:'vehicles/hour',model,timezone:rows[0].offset,trainCount:train.length,testCount:test.length,trainEnd:train.at(-1).timestamp,testBegin:test[0].timestamp,metrics,baselineMetrics:baseline,beatsBaseline:metrics.rmse<baseline.rmse,trainingFeatureRanges:model.means.map((_,j)=>[Math.min(...train.map(r=>r.features[j])),Math.max(...train.map(r=>r.features[j]))]),holdout:test.map((r,i)=>({timestamp:r.timestamp,observed:r.demandVph,predicted:predictions[i],baseline:seasonal[i]})),calibrated:false,warning:'Regressão sazonal simples; teste cronológico final sem ajuste dos parâmetros. MAE/RMSE em veículos/h. Treino sintético não valida tráfego real; correlação não demonstra efeito causal.'};
}
export function forecastDemand(training,timestamp){
 if(training?.schema!=='roadworks-demand-model/1.8')throw Error('Modelo de demanda inválido');const row=calendar(timestamp);if(row.offset!==training.timezone)throw Error('Use o mesmo fuso do treinamento');const raw=predictRidge(training.model,[row.features])[0];
 return {timestamp,rateVph:Math.max(0,raw),rawPrediction:raw,source:training.source,extrapolated:row.features.some((v,j)=>v<training.trainingFeatureRanges[j][0]-1e-9||v>training.trainingFeatureRanges[j][1]+1e-9),warning:'Estimativa estatística para a série importada; não é medição. Aplicar a uma OD exige conferir área, classe e período.'};
}

const summary=r=>({maxQueue:r.maxQueue,completed:r.completed,pending:r.pending,meanTravelSecondsCompleted:r.meanTravelSecondsCompleted,totalQueueVehicleSeconds:r.totalQueueVehicleSeconds});
function budget(d,calls){if(d.edges.length*d.settings.durationSeconds*calls>30000000)throw Error('Análise excede o orçamento de cálculo; reduza área, duração ou quantidade de parâmetros')}
export function scaledStudy(input,{demandScale=1,capacityScale=1,speedScale=1}={}){
 const d=structuredClone(input);for(const [key,value] of Object.entries({demandScale,capacityScale,speedScale}))finite(value,key,.1,3);
 for(const o of d.od)o.rateVph*=demandScale;for(const e of d.edges){e.capacityVphLane*=capacityScale;e.speedKmh*=speedScale}return validateUrban(d);
}
export function sensitivityUrban(input,{percent=10,parameters=[{kind:'demandScale'},{kind:'capacityScale'},{kind:'speedScale'}]}={}){
 const d=validateUrban(input);finite(percent,'Perturbação (%)',1,50);array(parameters,'Parâmetros',12);budget(d,1+parameters.length*2);const base=summary(simulateUrban(d,{collectSeries:false}));
 const variations=parameters.map(p=>{if(!['demandScale','capacityScale','speedScale'].includes(p.kind))throw Error('Parâmetro de sensibilidade não permitido');const make=factor=>{if(!p.id)return scaledStudy(d,{[p.kind]:factor});const next=structuredClone(d),items=p.kind==='demandScale'?next.od:next.edges,key=p.kind==='demandScale'?'rateVph':p.kind==='capacityScale'?'capacityVphLane':'speedKmh',item=items.find(x=>x.id===p.id);if(!item)throw Error('OD/trecho de sensibilidade ausente');item[key]*=factor;return validateUrban(next)};
  const low=summary(simulateUrban(make(1-percent/100),{collectSeries:false})),high=summary(simulateUrban(make(1+percent/100),{collectSeries:false}));const slopes={};for(const k of Object.keys(base))slopes[k]=low[k]===null||high[k]===null?null:(high[k]-low[k])/(2*percent);
  return {...p,low,high,changePerPercentagePoint:slopes};
 });
 return {schema:'roadworks-sensitivity/1.8',source:d.source,percent,baseline:base,variations,warning:'Variações finitas controladas, não derivadas exatas. Arredondamentos e escolhas de rota podem criar patamares ou saltos. Não altera semáforos nem identifica causalidade real.'};
}

const calibrationMetrics=['maxQueue','completed','pending','meanTravelSecondsCompleted','totalQueueVehicleSeconds'];
export function calibrateUrban(input,observations,{parameters=[{kind:'capacityScale',min:.6,max:1.4}],passes=3,observationSource='observed'}={}){
 if(!['observed','synthetic','mixed'].includes(observationSource))throw Error('Origem das observações inválida');
 const d=validateUrban(input);array(observations,'Observações',100);array(parameters,'Parâmetros',3);finite(passes,'Passes',1,6);if(!Number.isInteger(passes))throw Error('Passes devem ser inteiros');if(new Set(parameters.map(p=>p.kind)).size!==parameters.length)throw Error('Parâmetro repetido');
 for(const p of parameters){if(!['demandScale','capacityScale','speedScale'].includes(p.kind))throw Error('A calibração não altera semáforos');finite(p.min,'Limite inferior',.1,1);finite(p.max,'Limite superior',1,3);if(p.max<=p.min)throw Error('Limites invertidos')}
 const ids=new Set(),periodRoles=new Map();for(const o of observations){if(typeof o.id!=='string'||ids.has(o.id))throw Error('ID de observação ausente ou repetido');ids.add(o.id);if(!['fit','validation'].includes(o.role)||typeof o.period!=='string'||!o.period.trim()||!calibrationMetrics.includes(o.metric))throw Error('Papel, período ou métrica inválidos');if(periodRoles.has(o.period)&&periodRoles.get(o.period)!==o.role)throw Error('Um período não pode estar no ajuste e na validação');periodRoles.set(o.period,o.role);finite(o.observed,'Observado',0,1e12);finite(o.scale,'Escala da métrica',1e-8,1e12);finite(o.percent??d.settings.demandPercent,'Demanda da observação (%)',-100,300)}
 const fit=observations.filter(o=>o.role==='fit'),validation=observations.filter(o=>o.role==='validation');if(!fit.length||!validation.length)throw Error('Separe ao menos um período de ajuste e um de validação');
 const scenarios=new Set(observations.map(o=>o.percent??d.settings.demandPercent));budget(d,(1+2*parameters.length*passes)*scenarios.size);const cache=new Map();let evaluations=0;
 function evaluate(theta,rows){const predictions=[];try{const study=scaledStudy(d,theta);for(const o of rows){const percent=o.percent??d.settings.demandPercent,key=JSON.stringify([theta,percent]);if(!cache.has(key)){cache.set(key,summary(simulateUrban(study,{percent,collectSeries:false})));evaluations++}const value=cache.get(key)[o.metric];if(value===null)return null;predictions.push(value)}return {loss:mean(rows.map((o,i)=>((predictions[i]-o.observed)/o.scale)**2)),rows:rows.map((o,i)=>({...o,predicted:predictions[i],error:predictions[i]-o.observed}))}}catch(e){if(/limite|excede|inválido|invalid/i.test(e.message))return null;throw e}}
 let theta=Object.fromEntries(parameters.map(p=>[p.kind,1])),best=evaluate(theta,fit);if(!best)throw Error('O cenário inicial não produz métricas válidas; revise dados e duração');const before=structuredClone(best),trace=[{parameters:{...theta},loss:best.loss}];
 for(let pass=0;pass<passes;pass++)for(const p of parameters){const step=(p.max-p.min)/4/2**pass;for(const sign of [-1,1]){const candidate={...theta,[p.kind]:Math.max(p.min,Math.min(p.max,theta[p.kind]+sign*step))},score=evaluate(candidate,fit);if(score&&score.loss<best.loss-1e-12){theta=candidate;best=score;trace.push({parameters:{...theta},loss:best.loss})}}}
 // Holdout is evaluated only after parameter selection; it never guides the search.
 const initial=Object.fromEntries(parameters.map(p=>[p.kind,1])),validationBefore=evaluate(initial,validation),validationAfter=evaluate(theta,validation);
 return {schema:'roadworks-calibration-result/1.8',source:d.source,observationSource,parameters:theta,bounds:parameters,fitBefore:before,fitAfter:best,validationBefore,validationAfter,evaluations,trace,improvedFit:best.loss<before.loss,improvedValidation:!!validationBefore&&!!validationAfter&&validationAfter.loss<validationBefore.loss,calibrated:false,warning:'Busca limitada por coordenadas; pode encontrar mínimo local ou parâmetros não identificáveis. Erro é normalizado pelas escalas informadas. Validação não é usada no ajuste. Aplicar sugestão não comprova calibração de campo.'};
}

function matrixRank(matrix){const a=matrix.map(r=>[...r]);let rank=0;for(let col=0;col<a[0].length&&rank<a.length;col++){let pivot=rank;for(let i=rank+1;i<a.length;i++)if(Math.abs(a[i][col])>Math.abs(a[pivot][col]))pivot=i;if(Math.abs(a[pivot][col])<1e-9)continue;[a[rank],a[pivot]]=[a[pivot],a[rank]];for(let i=rank+1;i<a.length;i++){const f=a[i][col]/a[rank][col];for(let j=col;j<a[0].length;j++)a[i][j]-=f*a[rank][j]}rank++}return rank}
export function nonnegativeLeastSquares(A,b,{prior,lambda=.1,total=null,maxIterations=5000}={}){
 array(A,'Matriz de atribuição',100);const n=A[0].length;if(!n||n>50||b.length!==A.length)throw Error('Dimensões do ajuste OD inválidas');A.forEach(row=>{if(row.length!==n)throw Error('Matriz irregular');row.forEach(v=>finite(v,'Coeficiente',0,10))});b.forEach(v=>finite(v,'Contagem',0,1e6));if(!prior||prior.length!==n)throw Error('Prior OD ausente');prior.forEach(v=>finite(v,'Prior OD',0,30000));finite(lambda,'Regularização',1e-6,100);finite(maxIterations,'Iterações',1,10000);if(total!==null)finite(total,'Total OD',0,n*30000);
 const project=v=>{if(total===null)return v.map(x=>Math.max(0,Math.min(30000,x)));let lo=Math.min(...v)-30000,hi=Math.max(...v);for(let k=0;k<80;k++){const mid=(lo+hi)/2,sum=v.reduce((s,x)=>s+Math.max(0,Math.min(30000,x-mid)),0);if(sum>total)lo=mid;else hi=mid}return v.map(x=>Math.max(0,Math.min(30000,x-(lo+hi)/2)))};
 let x=project(prior),iterations=0,converged=false;const step=1/(A.reduce((s,row)=>s+dot(row,row),0)+lambda);
 for(;iterations<maxIterations;iterations++){const residual=A.map((row,i)=>dot(row,x)-b[i]),gradient=x.map((v,j)=>A.reduce((s,row,i)=>s+row[j]*residual[i],0)+lambda*(v-prior[j])),next=project(x.map((v,j)=>v-step*gradient[j])),delta=Math.sqrt(next.reduce((s,v,j)=>s+(v-x[j])**2,0));x=next;if(delta<=1e-7*(1+Math.sqrt(dot(x,x)))){converged=true;iterations++;break}}
 const predicted=A.map(row=>dot(row,x)),rank=matrixRank(A);return {values:x,predicted,metrics:errorMetrics(b,predicted),rank,unknowns:n,identifiable:rank===n,converged,iterations,lambda,total,warning:'Atribuição estática por rotas livres; não reproduz descarga de vias congestionadas. Regularização escolhe uma solução próxima ao prior; não torna observações insuficientes identificáveis.'};
}
export function fitOriginDestination(input,{counts,time=0,lambda=.1,total=null}={}){
 const d=validateUrban(input);finite(time,'Instante OD',0,14399);array(counts,'Contagens',100);const active=d.od.filter(o=>o.begin<=time&&time<o.end);array(active,'OD ativas',50);const edgeIDs=new Set(d.edges.map(e=>e.id)),seen=new Set();
 for(const c of counts){if(!edgeIDs.has(c.edge)||seen.has(c.edge))throw Error('Trecho de contagem ausente ou duplicado');seen.add(c.edge);finite(c.observedVph,'Contagem (veíc./h)',0,30000)}
 const routes=active.map(o=>routeUrban(d,o.from,o.to,{mode:o.mode,time}));if(routes.some(r=>!r))throw Error('Uma OD ativa não possui rota no instante escolhido');
 const A=counts.map(c=>active.map((o,j)=>{const adj=d.demandAdjustments.find(a=>a.od===o.id&&a.begin<=time&&time<a.end);return routes[j].includes(c.edge)?(1+d.settings.demandPercent/100)*(1+(adj?.percent||0)/100):0}));
 const result=nonnegativeLeastSquares(A,counts.map(c=>c.observedVph),{prior:active.map(o=>o.rateVph),lambda,total});return {schema:'roadworks-od-fit/1.8',source:d.source,time,od:active.map((o,i)=>({id:o.id,before:o.rateVph,after:result.values[i]})),counts:counts.map((c,i)=>({...c,predictedVph:result.predicted[i]})),...result,calibrated:false};
}

/** Standardized PCA using Jacobi rotations of a symmetric covariance matrix. */
export function principalComponents({rows,labels,columns},components=2){
 array(rows,'Cenários PCA',2000);const n=rows.length,p=rows[0]?.length;if(n<3||p<2||p>20||!Number.isInteger(components)||components<1||components>p)throw Error('PCA exige ao menos 3 cenários e 2 a 20 indicadores');rows.forEach(r=>{if(r.length!==p)throw Error('Matriz PCA irregular');r.forEach(v=>finite(v,'Indicador'))});if(!Array.isArray(columns)||columns.length!==p||!Array.isArray(labels)||labels.length!==n)throw Error('Rótulos PCA incompatíveis');
 const means=Array.from({length:p},(_,j)=>mean(rows.map(r=>r[j]))),scales=means.map((m,j)=>Math.sqrt(mean(rows.map(r=>(r[j]-m)**2)))||1),Z=rows.map(r=>r.map((v,j)=>(v-means[j])/scales[j]));
 const C=Array.from({length:p},(_,j)=>Array.from({length:p},(_,k)=>Z.reduce((s,r)=>s+r[j]*r[k],0)/(n-1))),V=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>i===j?1:0));let converged=false;
 for(let iteration=0;iteration<100*p*p;iteration++){let a=0,b=1,max=0;for(let i=0;i<p;i++)for(let j=i+1;j<p;j++)if(Math.abs(C[i][j])>max){max=Math.abs(C[i][j]);a=i;b=j}if(max<1e-11){converged=true;break}const theta=.5*Math.atan2(2*C[a][b],C[b][b]-C[a][a]),s=Math.sin(theta),c=Math.cos(theta),aa=C[a][a],bb=C[b][b],ab=C[a][b];
  for(let i=0;i<p;i++)if(i!==a&&i!==b){const ia=C[i][a],ib=C[i][b];C[i][a]=C[a][i]=c*ia-s*ib;C[i][b]=C[b][i]=s*ia+c*ib}C[a][a]=c*c*aa-2*s*c*ab+s*s*bb;C[b][b]=s*s*aa+2*s*c*ab+c*c*bb;C[a][b]=C[b][a]=0;
  for(let i=0;i<p;i++){const ia=V[i][a],ib=V[i][b];V[i][a]=c*ia-s*ib;V[i][b]=s*ia+c*ib}
 }
 const order=Array.from({length:p},(_,i)=>i).sort((a,b)=>C[b][b]-C[a][a]),eigenvalues=order.map(i=>Math.max(0,C[i][i])),total=eigenvalues.reduce((s,v)=>s+v,0);if(total<1e-12)throw Error('Os cenários não apresentam variação');const vectors=order.slice(0,components).map(j=>V.map(r=>r[j]));
 return {schema:'roadworks-pca/1.8',columns,labels,means,scales,eigenvalues,components:vectors,explainedVarianceRatio:eigenvalues.slice(0,components).map(v=>v/total),scores:Z.map(r=>vectors.map(v=>dot(r,v))),converged,warning:'PCA padronizada explora variação, não importância causal, risco ou qualidade da solução. Similaridade visual não prova equivalência entre cenários.'};
}
