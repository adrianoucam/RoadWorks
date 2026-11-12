/** Segmentation baseline + actual ONNX inference adapter, distinct evidence sources. */
export function heuristicRoadMask(rgba,width,height,{threshold=38,minLight=40,maxLight=210}={}){
 if(!rgba||rgba.length!==width*height*4||width<=0||height<=0)throw Error('Imagem RGBA inválida');
 const mask=new Uint8Array(width*height);
 for(let i=0;i<mask.length;i++){
  const j=4*i,r=rgba[j],g=rgba[j+1],b=rgba[j+2],light=(r+g+b)/3,chrom=Math.max(r,g,b)-Math.min(r,g,b);
  mask[i]=(light>=minLight&&light<=maxLight&&chrom<=threshold)?1:0;
 }
 return {width,height,mask,method:'heuristic-neutral-color',neural:false,warning:'Segmentação por cor NÃO neural; falsas detecções são esperadas'};
}
export function imageTensor(rgba,width,height,{mean=[.485,.456,.406],std=[.229,.224,.225]}={}){
 if(rgba.length!==width*height*4)throw Error('RGBA inválido');
 const n=width*height,out=new Float32Array(n*3);
 for(let i=0;i<n;i++)for(let c=0;c<3;c++)out[c*n+i]=(rgba[4*i+c]/255-mean[c])/std[c];
 return {data:out,dims:[1,3,height,width]};
}
export function logitsToMask(logits,dims,roadClass=1){
 if(!Array.isArray(dims)||dims.length!==4||dims[0]!==1)throw Error('Esperado tensor ONNX [1,C,H,W]');
 const [,classes,height,width]=dims,n=height*width;if(!(classes>1&&roadClass>=0&&roadClass<classes))throw Error('Classe rodovia inválida');
 if(logits.length!==classes*n)throw Error('Logits inconsistentes');
 const mask=new Uint8Array(n);let detected=0;
 for(let i=0;i<n;i++){let best=-Infinity,index=-1;for(let c=0;c<classes;c++){const score=logits[c*n+i];if(score>best){best=score;index=c;}}if(index===roadClass){mask[i]=1;detected++;}}
 return {width,height,mask,coverage:detected/n,method:'onnx-semantic-segmentation',neural:true,roadClass};
}
export function overlayMask(imageRGBA,mask,{red=45,green=235,blue=167,alpha=.58}={}){
 if(mask.length*4!==imageRGBA.length)throw Error('Tamanhos divergentes');const out=new Uint8ClampedArray(imageRGBA);
 for(let i=0;i<mask.length;i++)if(mask[i]){const j=i*4;out[j]=Math.round(out[j]*(1-alpha)+red*alpha);out[j+1]=Math.round(out[j+1]*(1-alpha)+green*alpha);out[j+2]=Math.round(out[j+2]*(1-alpha)+blue*alpha);}
 return out;
}
export function maskToGeoJSON(mask,width,height,bbox,{cell=8,minCoverage=.4}={}){
 if(mask.length!==width*height)throw Error('Máscara inválida');if(!bbox||!Number.isFinite(bbox.west)||!Number.isFinite(bbox.east))throw Error('Janela inválida');
 const features=[];for(let y=0;y<height;y+=cell)for(let x=0;x<width;x+=cell){let yes=0,all=0;
  for(let j=y;j<Math.min(y+cell,height);j++)for(let i=x;i<Math.min(x+cell,width);i++){all++;yes+=mask[j*width+i]}
  if(yes/all<minCoverage)continue;
  const lon=a=>bbox.west+a/width*(bbox.east-bbox.west);
  const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));const inv=m=>(2*Math.atan(Math.exp(m))-Math.PI/2)*180/Math.PI;
  const lat=a=>inv(merc(bbox.north)+a/height*(merc(bbox.south)-merc(bbox.north)));
  const x1=Math.min(width,x+cell),y1=Math.min(height,y+cell);
  features.push({type:'Feature',properties:{source:'image-segmentation',confidence:yes/all,warning:'Célula de máscara; requer georreferenciamento e revisão'},geometry:{type:'Polygon',coordinates:[[[lon(x),lat(y)],[lon(x1),lat(y)],[lon(x1),lat(y1)],[lon(x),lat(y1)],[lon(x),lat(y)]]]}});
 }
 return {type:'FeatureCollection',features};
}
