import {mountUrbanScene} from './urban-scene-ui.mjs';
import {mountUrban} from './urban-ui.mjs';
import {analyzeRoadHierarchy,assessBottleneck,intersectionAlternatives,multimodalDemand,compareTrafficStrategies,strategiesCSV,HIERARCHY_LABELS,auditLaneMovements,screenRoadAccesses} from './traffic-engineering.mjs';
import {trafficPreview,buildTrafficScenario,scheduleImpact,previewCSV,validateSumoReport} from './traffic.mjs';
import {validateStage,validateSchedule,stageGeometry,scheduleAt,scheduleBounds,scheduleWarnings,constructionCSV,DAY_MS} from './construction4d.mjs';
import {reviewEngineering,reviewCSV,importObstaclesGeoJSON} from './engineering-review.mjs';
import {createComponent,COMPONENTS,componentRecipeJSON} from './procedural.mjs';
import {visibleRoads,dedupeStreetNames,ocrWordHints} from './map-recognition.mjs';
import {heuristicRoadMask,imageTensor,logitsToMask,overlayMask,maskToGeoJSON} from './image-segmentation.mjs';
import {parseClassifiedRoadCSV,measureRoadPointCloud} from './pointcloud-road.mjs';
import {buildTwin,normalizeRoadGeoJSON,roadsFromOverpass,addInspection,twinGeoJSON} from './digital-twin.mjs';
import {coordinateFrame,length,simulate,evaluate,deg,rad} from './geometry.mjs';
import {startPose,buildAlignment,segmentFromRadius,roadSurface,alignmentRules} from './cad.mjs';
import {evaluateSwept} from './swept.mjs';
import {createVisualizer} from './visualizer.mjs';
import {SECTION_PRESETS,sectionLayout,sectionGeometry} from './roadmodel.mjs';
import {diagnoseNetwork,repairSelectedEndpoint} from './topology.mjs';
import {crossingTurn} from './intersections.mjs';
import {designLaneTurn,checkDesignVehicle,laneDirections} from './intersection-design.mjs';
import {pathStations,atStation,stationSamples,stationLabel,verticalModel,sectionAtStation} from './vertical.mjs';
import {createEngineeringViews} from './vertical-view.mjs';
import {generateCorridor,corridorOBJ,corridorSectionsCSV,corridorSummary} from './corridor.mjs';
import {terrainFromTIN,parseXYZ,terrainFromGeoTIFF,terrainPreview} from './terrain.mjs';
import {calculateEarthworks,earthworksCSV,earthworksSectionCSV,earthworksOBJ} from './earthworks.mjs';
const el=id=>document.getElementById(id);
let constructionStages=[],constructionDate='2026-12-01',constructionLayer=null,constructionTimer=null;
let trafficComparison=null,trafficSumoReport=null,trafficLayer=null;
let cityView=null;
let trafficEngineeringScenarios=[],trafficEngineeringLast=null;
const MAP_HOME=[-22.904,-43.103];
const engineeringViews=createEngineeringViews({profileCanvas:el('profileCanvas'),sectionCanvas:el('sectionCanvas'),onPick:setSelectedStation});
let profilePVIs=[],selectedStation=0,stationLayer=null,verticalReady=false,corridor=null,terrain=null,earthworks=null;
const visualizer=createVisualizer({canvas:el('technicalCanvas'),canvas3d:el('threeCanvas'),onStatus:t=>status(t)});
const map=L.map('map',{preferCanvas:true}).setView(MAP_HOME,14);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',maxZoom:19}).addTo(map);
map.zoomControl.setPosition('bottomleft');
let cadOrigin=null,cadSegments=[],cadAnchor=null,cadSelected=-1,cadMapMode=false,cadFrame=null,cadBuild=null,sweptResult=null,ruleResult=null;
let lastTurn=null,lastTurnCheck=null;
let engineeringReview=null,reviewObstacles=[],reviewLayer=null;
let urbanOSM=null;
let osmRoadData=[],twin=null,twinSelectedId=null,twinLayer=L.layerGroup().addTo(map);
let v11Mask=null,v11Image=null,v11ImageData=null,v11BBox=null,v11Roads=[],v11OCRLayer=L.layerGroup().addTo(map);
let osmNetwork=[],crossingSelection=[],selectingCrossing=false,section=structuredClone(SECTION_PRESETS.rural_two);
constructionLayer=L.layerGroup().addTo(map);
trafficLayer=L.layerGroup().addTo(map);
let points=[],drawMode=false,osmRoadLayer=L.layerGroup().addTo(map),shapes=L.layerGroup().addTo(map),sim=null,frame=0,timer=null,projectName='Novo projeto',roadWidth=7.2,vehicle=null;
const presets={
 car:{length:4.5,width:1.8,wheelbase:2.7,rearOverhang:1,trailer:false,hitchOffset:0,trailerLength:8,trailerWidth:2.5,trailerAxleToHitch:6},
 bus:{length:12,width:2.6,wheelbase:6,rearOverhang:3,trailer:false,hitchOffset:0,trailerLength:8,trailerWidth:2.5,trailerAxleToHitch:6},
 truck:{length:9.1,width:2.6,wheelbase:5.2,rearOverhang:2.5,trailer:false,hitchOffset:0,trailerLength:8,trailerWidth:2.5,trailerAxleToHitch:6},
 semi:{length:6.2,width:2.6,wheelbase:3.7,rearOverhang:1,trailer:true,hitchOffset:.6,trailerLength:13.6,trailerWidth:2.6,trailerAxleToHitch:9.2}
};
const vKeys=['length','width','wheelbase','rearOverhang','hitchOffset','trailerLength','trailerWidth','trailerAxleToHitch'];
const inputs={length:'vLength',width:'vWidth',wheelbase:'wheelbase',rearOverhang:'rearOverhang',hitchOffset:'hitchOffset',trailerLength:'trailerLength',trailerWidth:'trailerWidth',trailerAxleToHitch:'trailerAxleToHitch'};
function fillVehicle(v){for(const k of vKeys)el(inputs[k]).value=v[k];el('trailer').checked=v.trailer;toggleTrailer()}
function getVehicle(){const v={};for(const k of vKeys)v[k]=Number(el(inputs[k]).value);v.trailer=el('trailer').checked;
 for(const k of ['length','width','wheelbase'])if(!Number.isFinite(v[k])||v[k]<=0)throw Error('Dimensões inválidas: '+k);
 if(v.length<v.wheelbase||v.rearOverhang>v.length-v.wheelbase)throw Error('Entre-eixos e balanço traseiro incompatíveis com comprimento');
 if(v.trailer&&(v.trailerLength<=0||v.trailerWidth<=0||v.trailerAxleToHitch<=0||v.trailerAxleToHitch>v.trailerLength))throw Error('Dimensões do reboque inválidas');return v;
}
function toggleTrailer(){el('trailerFields').style.display=el('trailer').checked?'grid':'none'}
function status(t){el('status').textContent=t}
function ll(p){return [p.lat,p.lng]}
function frameObj(){const [lat,lng]=ll(points[0]);return coordinateFrame(lat,lng)}
function localPath(){if(points.length<2)throw Error('Selecione ou desenhe pelo menos dois pontos');const f=frameObj();return {f,path:points.map(p=>f.toXY(p))}}
function localLL(poly,f){return poly.map(p=>ll(f.toLatLng(p)))}
function clearShapes(){shapes.clearLayers();}
function cadRefresh(){const list=el('cadList');list.replaceChildren();if(!cadSegments.length){list.textContent='Nenhum segmento CAD.';return}
 cadSegments.forEach((seg,i)=>{const b=document.createElement('button');b.className='cad-row'+(i===cadSelected?' selected':'');
 let curvature=seg.type==='line'?'':seg.type==='arc'?`R=${(1/Math.abs(seg.curvature)).toFixed(1)}m`: `κ ${seg.k0.toFixed(4)} → ${seg.k1.toFixed(4)} /m`;
 b.textContent=`${i+1}. ${seg.type==='line'?'Reta':seg.type==='arc'?'Arco':'Clotóide'} · ${seg.length.toFixed(1)}m ${curvature}`;
 b.onclick=()=>{cadSelected=i;cadLoadSelected();cadRefresh()};list.append(b)});
}
function cadLoadSelected(){if(cadSelected<0||!cadSegments[cadSelected])return;const seg=cadSegments[cadSelected];el('cadType').value=seg.type;el('cadLength').value=seg.length;
 if(seg.type==='arc'){el('cadSide').value=seg.curvature<0?'-1':'1';el('cadRadius').value=(1/Math.abs(seg.curvature)).toFixed(3)}
 if(seg.type==='clothoid'){const sign=seg.k1||seg.k0;el('cadSide').value=sign<0?'-1':'1';el('cadRadius').value=seg.k0? (1/Math.abs(seg.k0)).toFixed(3):0;el('cadEndRadius').value=seg.k1?(1/Math.abs(seg.k1)).toFixed(3):0}
}
function cadInput(){const type=el('cadType').value,len=Number(el('cadLength').value),r=Number(el('cadRadius').value),r2=Number(el('cadEndRadius').value),side=Number(el('cadSide').value);
 if(!Number.isFinite(len)||len<=0||len>10000||!Number.isFinite(r)||r<0||!Number.isFinite(r2)||r2<0)throw Error('Parâmetros CAD inválidos');
 if(type==='arc'&&r===0)throw Error('Para arco circular, use raio maior que zero');
 return segmentFromRadius(type,len,r,r2,side)}
function cadApply(){clearEngineeringReview();if(!cadAnchor||!cadFrame)throw Error('Use “Âncora CAD” e selecione no mapa o ponto inicial');
 if(!cadSegments.length){cadBuild=null;points=[];resetSim();cadRefresh();return}
 cadBuild=buildAlignment(cadAnchor,cadSegments,.55);if(cadBuild.points.length>18000)throw Error('CAD excede 18 mil amostras: divida em trechos');
 points=cadBuild.points.map(p=>cadFrame.toLatLng(p));projectName='Alinhamento CAD paramétrico';drawMode=false;cadMapMode=false;
 resetSim();cadRefresh();map.fitBounds(L.latLngBounds(points.map(ll)).pad(.15),{maxZoom:18});
 status(`${cadSegments.length} segmentos CAD; ${cadBuild.station.toFixed(1)} m gerados. Analise a geometria.`)}
function cadClear(keepPoints=false){cadSegments=[];cadAnchor=null;cadFrame=null;cadOrigin=null;cadBuild=null;cadSelected=-1;cadMapMode=false;cadRefresh();if(!keepPoints){points=[];resetSim()}}

function readSection(){return sectionLayout({lanesPerDirection:Number(el('lanesPerDirection').value),laneWidth:Number(el('laneWidth').value),shoulderLeft:Number(el('shoulderLeft').value),shoulderRight:Number(el('shoulderRight').value),median:Number(el('median').value)})}
function applySectionPreset(key){const p=SECTION_PRESETS[key];if(!p)return;for(const k of ['lanesPerDirection','laneWidth','shoulderLeft','shoulderRight','median'])el(k).value=p[k];section=p;onSectionChange()}
function currentSection(){return readSection()}
function currentWidth(){return el('sectionEvaluation').checked?currentSection().platformWidth:Number(el('roadWidth').value)}
function onSectionChange(){try{clearEngineeringReview();corridor=null;earthworks=null;updateEarthworkInfo();updateCorridorInfo();section=currentSection();updateLaneSelects();el('sectionTotal').textContent=section.platformWidth.toFixed(2)+' m / '+section.lanes.length+' faixas';if(sim)resetSim();else{render();refreshVisualization()}}catch(e){el('sectionTotal').textContent='Inválido';status('Seção: '+e.message)}}
function getNetworkLocal(f){return osmNetwork.map(l=>l.map(p=>f.toXY(p)))}
function updateLaneSelects(){
 const options=laneDirections(currentSection());
 for(const id of ['turnFromLane','turnToLane']){
  const e=el(id),previous=e.value;e.replaceChildren();
  for(const lane of options){const o=document.createElement('option');o.value=lane.id;o.textContent=`${lane.id} (${lane.direction===1?'sentido +':'sentido −'})`;e.append(o)}
  e.value=options.some(x=>x.id===previous)?previous:'L1';
 }
}
function createTurn(a,b){
 const radius=Number(el('turnRadius').value);
 if(!(radius>=.5&&radius<=300))throw Error('Raio fora do intervalo 0,5–300 m');
 const approach=Number(el('approachDist').value),departure=Number(el('departureDist').value);
 if(!(approach>0&&departure>0))throw Error('Comprimentos de aproximação e saída devem ser positivos');
 return designLaneTurn(a,b,{sectionA:currentSection(),sectionB:currentSection(),fromLane:el('turnFromLane').value,toLane:el('turnToLane').value,radius,approachLength:approach,departureLength:departure,step:.5,allowLeft:el('allowLeft').checked,allowRight:el('allowRight').checked,allowStraight:el('allowStraight').checked});
}
function commitTurn(turn){lastTurn={...turn,arc:undefined};updateTurnVehicle();}
function updateTurnVehicle(){
 if(!lastTurn)return;
 try{
 const v=getVehicle();lastTurnCheck=checkDesignVehicle(lastTurn,v,{steeringLimitDegrees:Number(el('steerLimit').value),articulationLimitDegrees:Number(el('articulationLimit').value),clearance:Number(el('clearance').value)});
 el('mTurnRadius').textContent=Number.isFinite(lastTurn.radius)?lastTurn.radius.toFixed(1)+' m':'Reto';
 el('mTurnVehicle').textContent=lastTurnCheck.feasiblePreliminary?'Sem alerta cinemático':'Revisar manobra';
 el('turnSummary').textContent=`${lastTurn.movement.toUpperCase()} · ${lastTurn.fromLane} → ${lastTurn.toLane} · ${lastTurn.turnDegrees.toFixed(1)}°\nRaio: ${Number.isFinite(lastTurn.radius)?lastTurn.radius.toFixed(2)+' m':'trecho reto'} · tangente: ${lastTurn.tangentLength.toFixed(2)} m\nRaio mínimo por esterçamento: ${lastTurnCheck.minSteeringRadius.toFixed(2)} m · articulação máxima: ${lastTurnCheck.maxArticulationDegrees.toFixed(1)}°\nEnvelope × plataformas: ${lastTurnCheck.footprint?lastTurnCheck.footprint.violatingCells+' / '+lastTurnCheck.footprint.checkedCells+' células fora (máx. '+lastTurnCheck.footprint.maxOutside.toFixed(2)+' m)':'não calculado'}\n${lastTurnCheck.feasiblePreliminary?'Sem alertas nos testes simplificados.':'ALERTA: raio, articulação e/ou envelope requer revisão.'}\nNão considera o pavimento adicional do retorno de esquina nem comprova normas.`;
 }catch(e){lastTurnCheck=null;el('turnSummary').textContent='Análise de veículo: '+e.message;el('mTurnVehicle').textContent='Não avaliado'}
}
function selectRoad(way){if(selectingCrossing){crossingSelection.push(way);if(crossingSelection.length===1){status('Primeira via escolhida. Clique agora em outra via OSM que cruze a primeira.');return}
 try{const f=coordinateFrame(crossingSelection[0].geometry[0].lat,crossingSelection[0].geometry[0].lng);
 const paths=crossingSelection.map(x=>x.geometry.map(p=>f.toXY(p)));
 const r=createTurn(paths[0],paths[1]);
 usePath(r.points.map(p=>f.toLatLng(p)),'Interseção v0.5: '+crossingSelection.map(x=>x.name).join(' / '));
 commitTurn(r);el('topologySummary').textContent='Concordância circular gerada entre faixas; verificar sentidos, permissões OSM, raios e área pavimentada.';
 }catch(e){status('Interseção: '+e.message)}finally{selectingCrossing=false;crossingSelection=[];el('intersectionMode').classList.remove('active')}return}
 usePath(way.geometry,way.name,false)}

function profileInputs(){return {startElevation:Number(el('vStartZ').value),startGradePercent:Number(el('vStartGrade').value),pvis:profilePVIs.map(x=>({...x}))};}
function profileState(){const {f,path}=localPath(),stations=pathStations(path),total=stations.at(-1),model=verticalModel(profileInputs(),total);return {f,path,stations,total,model};}
function selectedVisualModel(){const {path,total}=profileState();return {path,profile:profileInputs(),station:Math.min(selectedStation,total),layout:currentSection(),crossfallPercent:Number(el('crossfall').value),superelevationPercent:el('vCrossSlope').value.trim()===''?null:Number(el('vCrossSlope').value),stationInterval:Number(el('stationInterval').value)};}
function updatePviList(){const e=el('pviList');e.replaceChildren();if(!profilePVIs.length)e.textContent='Greide único, sem PVIs.';for(const [i,p] of profilePVIs.entries()){const line=document.createElement('button');line.className='cad-row';line.textContent=`PVI ${i+1} · s=${p.station.toFixed(2)} m · rampa saída=${p.gradeOutPercent.toFixed(2)}% · L=${p.curveLength.toFixed(2)} m`;line.onclick=()=>{el('pviStation').value=p.station;el('pviGrade').value=p.gradeOutPercent;el('pviLength').value=p.curveLength};e.append(line);}}
function refreshEngineering(){if(points.length<2){el('stationText').textContent='Sem eixo';return}try{const m=selectedVisualModel(),v=verticalModel(m.profile,pathStations(m.path).at(-1));selectedStation=Math.min(selectedStation,v.total);m.station=selectedStation;const r=v.evaluate(selectedStation);el('stationSlider').max=v.total;el('stationSlider').value=selectedStation;el('stationText').textContent=stationLabel(selectedStation,m.stationInterval);el('mStation').textContent=stationLabel(selectedStation,m.stationInterval);el('mElevation').textContent=r.elevation.toFixed(2)+' m';el('mGrade').textContent=r.gradePercent.toFixed(3)+' %';engineeringViews.update(m);updateStationMarker();}catch(err){el('stationText').textContent='Greide inválido';el('mElevation').textContent='—';el('mGrade').textContent='—';status('Perfil: '+err.message)}}
function updateStationMarker(){if(stationLayer){map.removeLayer(stationLayer);stationLayer=null}if(points.length<2)return;try{const {path,f,stations}=profileState(),p=atStation(path,selectedStation,stations),ll=f.toLatLng(p);stationLayer=L.circleMarker([ll.lat,ll.lng],{radius:7,color:'#fff',weight:2,fillColor:'#ebaa45',fillOpacity:1,interactive:false}).addTo(map);}catch(e){/* invalid vertical profile should not block mapping */}}
function setSelectedStation(s){if(!Number.isFinite(s)||points.length<2)return;try{const {total}=profileState();selectedStation=Math.max(0,Math.min(s,total));refreshEngineering();refreshVisualization();}catch(e){status('Estaca: '+e.message)}}
function profileChanged(){clearEngineeringReview();corridor=null;earthworks=null;updateEarthworkInfo();refreshEngineering();refreshVisualization();updateCorridorInfo()}
function updateCorridorInfo(){const m=el('corridorSummary');if(!m)return;
 if(!corridor){m.textContent='Corredor não calculado. Clique em Gerar corredor 3D.';el('mCorridorArea').textContent='—';el('mCorridorTriangles').textContent='—';return;}
 m.textContent=`Extensão: ${corridor.metrics.lengthMeters.toFixed(1)} m | largura: ${corridor.metrics.platformWidthMeters.toFixed(2)} m | ${corridor.metrics.stations} seções | ${corridor.metrics.vertices} vértices | ${corridor.metrics.triangles} triângulos. Área planimétrica aprox.: ${corridor.metrics.surfaceAreaApproxM2.toFixed(1)} m².`;
 el('mCorridorArea').textContent=corridor.metrics.surfaceAreaApproxM2.toFixed(1)+' m²';el('mCorridorTriangles').textContent=String(corridor.metrics.triangles);
}
function buildCorridor(){const {path}=localPath();const result=generateCorridor({path,profile:profileInputs(),section:currentSection(),step:Number(el('corridorStep').value),crossfallPercent:Number(el('crossfall').value),superelevationPercent:el('vCrossSlope').value.trim()===''?null:Number(el('vCrossSlope').value)});
 corridor=result;earthworks=null;updateEarthworkInfo();updateCorridorInfo();refreshVisualization();status(`Corredor 3D: ${result.metrics.stations} seções, ${result.metrics.triangles} triângulos. Superfície projetada; sem terreno natural.`);return result;
}

function terrainInfo(){
 const box=el('terrainInfo');if(!box)return;
 box.textContent=terrain?`Terreno ${terrain.type.toUpperCase()} · ${terrain.source} · ${terrain.type==='tin'?terrain.points.length+' pontos / '+terrain.triangles.length+' triângulos':terrain.width+'×'+terrain.height+' células'} · CRS: ${terrain.metadata?.crs||'local (m)'}. Geometria preliminar.`:'Nenhum terreno importado. OSM não fornece cotas confiáveis para cálculo de volumes.';
}
function updateEarthworkInfo(){
 const box=el('earthworkInfo');if(!box)return;
 box.textContent=earthworks?`Corte: ${earthworks.cutM3.toFixed(2)} m³ | Aterro: ${earthworks.fillM3.toFixed(2)} m³ | Saldo aterro−corte: ${earthworks.netM3.toFixed(2)} m³ · ${earthworks.sections.length} seções. Estimativa por áreas médias, sem empolamento/compactação.`:'Calcule o corredor e importe um terreno cobrindo plataforma e taludes.';
 el('mCut').textContent=earthworks?earthworks.cutM3.toFixed(1)+' m³':'—';
 el('mFill').textContent=earthworks?earthworks.fillM3.toFixed(1)+' m³':'—';
}
async function importTerrain(){
 const file=el('terrainFile').files?.[0];if(!file)throw Error('Selecione o arquivo XYZ/CSV ou GeoTIFF');
 if(file.size>30e6)throw Error('Arquivo maior que 30 MB; recorte o MDT');
 if(points.length<2)throw Error('Defina primeiro o eixo, para fixar as coordenadas locais');
 const {f}=localPath(),ext=file.name.toLowerCase();let loaded;
 if(ext.endsWith('.tif')||ext.endsWith('.tiff')){
  if(!window.GeoTIFF)throw Error('GeoTIFF.js indisponível; verifique a conexão com CDN');
  loaded=await terrainFromGeoTIFF(await file.arrayBuffer(),{frame:f,decoder:window.GeoTIFF,project:window.proj4,source:file.name});
 }else{
  const parsed=parseXYZ(await file.text(),{columns:el('xyzMode').value,frame:f,maxPoints:2000});
  loaded=terrainFromTIN(parsed,{maxEdge:Number(el('tinMaxEdge').value),source:file.name,metadata:{crs:el('xyzMode').value==='lonlat'?'EPSG:4326':'local XY; origem no primeiro ponto da via'}});
 }
 terrain=loaded;earthworks=null;updateEarthworkInfo();terrainInfo();refreshVisualization();status(`Terreno importado: ${file.name}. Confira cobertura, projeção e datum antes do cálculo de volumes.`);
}
function createSyntheticTerrain(){
 const {path}=localPath(),xs=path.map(p=>p.x),ys=path.map(p=>p.y),minX=Math.min(...xs)-100,maxX=Math.max(...xs)+100,minY=Math.min(...ys)-100,maxY=Math.max(...ys)+100;
 const nx=20,ny=20,arr=[];for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=minX+i*(maxX-minX)/(nx-1),y=minY+j*(maxY-minY)/(ny-1);arr.push({x,y,z:20+0.012*x+0.008*y+2*Math.sin(x/120)*Math.cos(y/85)});}
 terrain=terrainFromTIN(arr,{maxEdge:10000,source:'TERRENO FICTÍCIO — SOMENTE DEMONSTRAÇÃO',metadata:{crs:'local fictício'}});earthworks=null;terrainInfo();updateEarthworkInfo();refreshVisualization();status('ATENÇÃO: terreno sintético carregado. NÃO é topografia de Niterói ou da área escolhida.');
}
function buildEarthworks(){
 if(!terrain)throw Error('Importe um MDT antes de calcular volumes');const c=corridor||buildCorridor();
 const result=calculateEarthworks(c,terrain,{cutHV:Number(el('cutHV').value),fillHV:Number(el('fillHV').value),maxReach:Number(el('maxReach').value),lateralStep:Number(el('lateralStep').value)});
 earthworks=result;updateEarthworkInfo();refreshVisualization();status(`Terraplenagem preliminar: corte ${result.cutM3.toFixed(1)}m³, aterro ${result.fillM3.toFixed(1)}m³.`);return result;
}
function render(){clearShapes();renderConstructionMap();if(!points.length)return;
 const centerline=L.polyline(points.map(ll),{color:'#35d5b0',weight:3,opacity:.9}).addTo(shapes);
 if(el('showRoad').checked&&points.length>1){const w=currentWidth();
 const f=frameObj();const path=points.map(p=>f.toXY(p));const edges=el('sectionEvaluation').checked?sectionGeometry(path,currentSection()):roadSurface(path,w);
 L.polyline(localLL(edges.left,f),{color:'#83a6d2',weight:2,opacity:.95,interactive:false}).addTo(shapes);
 L.polyline(localLL(edges.right,f),{color:'#83a6d2',weight:2,opacity:.95,interactive:false}).addTo(shapes);
 if(el('showLanes').checked&&el('sectionEvaluation').checked){const sec=sectionGeometry(path,currentSection());for(const lane of sec.lanes){L.polyline(localLL(lane.center,f),{color:lane.direction===1?'#f8efaa':'#efbf6d',weight:1.4,opacity:.85,dashArray:'6 9',interactive:false}).addTo(shapes);}if(sec.layout.median>0)for(const edge of [sec.boundaries.medianLeft,sec.boundaries.medianRight])L.polyline(localLL(edge,f),{color:'#cbd6d8',weight:1.5,opacity:.85,interactive:false}).addTo(shapes);}centerline.bringToFront();}
 const markerSkip=Math.max(1,Math.ceil(points.length/80));points.forEach((p,i)=>{if(i%markerSkip!==0&&i!==points.length-1)return;L.circleMarker(ll(p),{radius:3,color:'#e1f4ed',weight:1,fillColor:'#2ac29f',fillOpacity:1}).addTo(shapes).bindTooltip(`P${i+1}`)});
 if(!sim)return;
 const {f}=localPath();
 if(el('showEnvelope').checked){
  const sampleSkip=Math.max(1,Math.ceil(sim.env.length/320));
  for(let i=0;i<sim.env.length;i+=sampleSkip)L.polygon(localLL(sim.env[i],f),{stroke:false,fillColor:'#f0a957',fillOpacity:.07,interactive:false}).addTo(shapes);
 }
 if(sweptResult?.offenders?.length){const skip=Math.max(1,Math.ceil(sweptResult.offenders.length/70));for(let i=0;i<sweptResult.offenders.length;i+=skip){const cell=sweptResult.offenders[i];L.polygon(localLL(cell.polygon,f),{color:'#ff5364',weight:1,fillColor:'#ec4558',fillOpacity:.25,interactive:false}).addTo(shapes)}}
 const state=sim.states[Math.min(frame,sim.states.length-1)];
 if(state.trailer)L.polygon(localLL(state.trailer,f),{color:'#fdbf70',weight:2,fillColor:'#a36a27',fillOpacity:.52,interactive:false}).addTo(shapes);
 L.polygon(localLL(state.tractor,f),{color:'#f5f7fa',weight:2,fillColor:'#45d4aa',fillOpacity:.6,interactive:false}).addTo(shapes);
 L.circleMarker(ll(f.toLatLng(state.p)),{radius:3,color:'#fff',fillColor:'#fff',fillOpacity:1}).addTo(shapes);
}
function refreshVisualization(){if(points.length<2){visualizer.update(null);return}try{const {path}=localPath();let elev=null;try{const m=profileState();elev={profile:profileInputs(),station:selectedStation,stations:m.stations,crossfallPercent:Number(el('crossfall').value),superelevationPercent:el('vCrossSlope').value.trim()===''?null:Number(el('vCrossSlope').value)}}catch(e){}visualizer.update({path,sim,frame,vehicle:vehicle||getVehicle(),width:currentWidth(),section:el('showLanes').checked&&el('sectionEvaluation').checked?currentSection():null,vertical:elev,corridor:el('corridorEnable').checked?corridor:null,terrain:el('terrainVisible').checked?terrain:null,earthworks:el('earthworkVisible').checked?earthworks:null,construction:el('cVisible').checked?constructionForView():null},{showEnvelope:el('showEnvelope').checked,showRoad:el('showRoad').checked,follow:el('followVehicle').checked})}catch(e){console.warn('Visualizador:',e)}}
function switchView(mode){const isMap=mode==='map',isCity=mode==='urban3d';el('map').hidden=!isMap;el('visualStage').hidden=isMap||isCity;if(cityView){cityView.stage.hidden=!isCity;cityView.show(isCity)}if(isMap){setTimeout(()=>map.invalidateSize(),0);render();status('Mapa OSM · clique nas vias para selecionar.')}else if(isCity){el('engineeringDock').classList.add('collapsed');el('dockToggle').textContent='Expandir';cityView?.refresh()}else{refreshVisualization();visualizer.setMode(mode)}}
function resetSim(){clearEngineeringReview();pause();corridor=null;earthworks=null;updateEarthworkInfo();updateCorridorInfo();sim=null;sweptResult=null;ruleResult=null;frame=0;el('time').value=0;el('time').max=0;el('frame').textContent='0 / 0';for(const id of ['mLength','mPoints','mExcess','mAngle','mRadius','mNorm','mCells'])el(id).textContent='—';el('result').textContent='Sem análise';el('normIssues').replaceChildren();el('result').className='result';render();refreshVisualization();refreshEngineering()}
function usePath(arr,name,zoom=true){stopConstruction();constructionStages=[];delete el('cAdd').dataset.edit;reviewObstacles=[];if(el('reviewObstacleSummary'))el('reviewObstacleSummary').textContent='Os obstáculos foram limpos ao trocar o referencial do trecho.';terrain=null;earthworks=null;terrainInfo();updateEarthworkInfo();lastTurn=null;lastTurnCheck=null;el('mTurnRadius').textContent='—';el('mTurnVehicle').textContent='—';el('turnSummary').textContent='Nenhuma interseção v0.5 calculada.';cadClear(true);points=arr.map(p=>({lat:Number(p.lat),lng:Number(p.lng)}));projectName=name;drawMode=false;el('draw').classList.remove('active');resetSim();if(zoom&&points.length>1)map.fitBounds(L.latLngBounds(points.map(ll)).pad(.25),{maxZoom:18});updateConstructionUI();status(`${name}: ${points.length} vértices carregados. Execute a simulação.`)}
function simulateNow(){try{vehicle=getVehicle();const w=currentWidth(),c=Number(el('clearance').value);
 if(!Number.isFinite(w)||w<=0||!Number.isFinite(c)||c<0||w<=2*c)throw Error('Verifique a largura da via e a folga lateral');
 const {path}=localPath();if(length(path)>15000)throw Error('Trecho acima de 15 km: divida em trechos menores');
 status('Processando envelope geométrico…');sim=simulate(path,vehicle,.8);
 sweptResult=evaluateSwept(sim.states,path,w,c,{maxSamples:850,sideOffsets:el('sectionEvaluation').checked?{left:currentSection().leftEdge,right:currentSection().rightEdge}:null});
 const steering=Number(el('steerLimit').value),rSteering=vehicle.wheelbase/Math.tan(rad(steering));
 const speed=Number(el('designSpeed').value),e=Number(el('superelevation').value)/100,f=Number(el('sideFriction').value);
 ruleResult=cadSegments.length?alignmentRules(cadSegments,{speedKmh:speed,superelevation:e,friction:f}):null;
 frame=0;el('time').max=sim.states.length-1;el('time').value=0;
 el('mLength').textContent=sim.length.toFixed(1)+' m';el('mPoints').textContent=sim.states.length.toLocaleString('pt-BR');
 el('mExcess').textContent=sweptResult.maxOutside.toFixed(2)+' m';el('mCells').textContent=`${sweptResult.violatingCells} / ${sweptResult.checkedCells}`;
 el('mAngle').textContent=sim.maxAngle.toFixed(1)+'°';el('mRadius').textContent=ruleResult?ruleResult.requiredRadius.toFixed(1)+' m':'Sem CAD';
 el('mNorm').textContent=ruleResult?`${ruleResult.issues.length} alerta(s)`:'Sem CAD';
 if(lastTurn)updateTurnVehicle();
 const box=el('normIssues');box.replaceChildren();box.className='norm-issues'+(ruleResult&&!ruleResult.issues.length?' ok':'');
 if(ruleResult){const line=document.createElement('p');line.textContent=`Raio de esterçamento de referência (modelo bicicleta): ${rSteering.toFixed(1)} m, limite selecionado ${steering}°. Não garante dirigibilidade no traçado.`;box.append(line);
 if(!ruleResult.issues.length){const x=document.createElement('p');x.textContent='Nenhum alerta nas duas verificações CAD implementadas: raio mínimo teórico e salto de curvatura.';box.append(x)}
 ruleResult.issues.slice(0,20).forEach(item=>{const x=document.createElement('p');x.textContent=item.type==='minimum_radius'?`Segmento ${item.segment}: raio ${item.radius.toFixed(1)} m inferior a ${item.required.toFixed(1)} m (modelo teórico).`:`Segmento ${item.segment}: descontinuidade de curvatura Δκ=${item.delta.toFixed(5)} /m.`;box.append(x)})
 }else{const x=document.createElement('p');x.textContent='Via manual/OSM: sem segmentos CAD paramétricos para aplicar verificação de raios. Crie alinhamento CAD para ativá-la.';box.append(x)}
 const result=el('result');result.className='result'+(sweptResult.clear?'':' bad');result.textContent=sweptResult.clear?'Sem extrapolação detectada nas células amostradas.':'Invasão geométrica da pista detectada: '+sweptResult.violatingCells+' células verificadas fora da área da via.';
 status('Análise preliminar concluída. Envelopes por casco convexo, bordas offset e regra de raio teórico; não homologado.');refreshVisualization();updateFrame();
 }catch(err){status('Erro: '+err.message);console.error(err)}}
function updateFrame(){el('time').value=frame;el('frame').textContent=sim?`${frame+1} / ${sim.states.length}`:'0 / 0';if(el('viewMode').value==='map')render();visualizer.seek(frame)}
function pause(){if(timer)clearInterval(timer);timer=null;el('play').textContent='▶'}
function download(filename,content,type){const a=document.createElement('a'),blob=new Blob([content],{type});a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function report(){return {schema:'roadworks-swept-path/1.6',urbanSceneV19:cityView?.snapshot()||null,urbanV17:urban.snapshot(),trafficEngineeringV16:{scenarios:trafficEngineeringScenarios.slice(-25),last:trafficEngineeringLast} ,construction4D:{stages:constructionStages,date:constructionDate,simulationOnly:true},trafficV14:trafficComparison?{date:trafficComparison.date,impact:trafficComparison.impact,parameters:trafficComparison.conf,previewOnly:true}:null,engineeringReview:engineeringReview?{...engineeringReview,sight:undefined,conflicts:undefined}:null,digitalTwin:twin?{...twin,features:undefined}:null,terrainMetadata:terrain?{type:terrain.type,source:terrain.source,metadata:terrain.metadata,extent:terrain.extent,warning:'Terreno NÃO é incorporado ao JSON; reimportar arquivo original'}:null,earthworksSummary:earthworks?{cutM3:earthworks.cutM3,fillM3:earthworks.fillM3,options:earthworks.options,warning:'Recalcular após reimportar MDT'}:null,corridorConfig:{step:Number(el('corridorStep').value),enabled:el('corridorEnable').checked},corridorSummary:corridor?corridorSummary(corridor):null,verticalProfile:profileInputs(),stationInterval:Number(el('stationInterval').value),crossfallPercent:Number(el('crossfall').value),superelevationPercent:el('vCrossSlope').value.trim()===''?null:Number(el('vCrossSlope').value),intersectionDesign:lastTurn?{...lastTurn,points:undefined}:null,intersectionVehicle:lastTurnCheck?{...lastTurnCheck,simulation:undefined}:null,cad:{anchor:cadAnchor,segments:cadSegments,frameOrigin:cadOrigin||null},rules:ruleResult,sweptSummary:sweptResult?{clear:sweptResult.clear,maxOutside:sweptResult.maxOutside,violatingCells:sweptResult.violatingCells,checkedCells:sweptResult.checkedCells,method:sweptResult.method}:null,name:projectName,source:lastTurn?'Concordância circular v0.5':cadSegments.length?'CAD paramétrico':'desenho manual ou eixo cartográfico OpenStreetMap (quando aplicável)',designParameters:{speedKmh:Number(el('designSpeed').value),superelevationPercent:Number(el('superelevation').value),sideFriction:Number(el('sideFriction').value),steeringLimitDegrees:Number(el('steerLimit').value)},crs:'EPSG:4326',points,vehicle:getVehicle(),roadWidth:Number(el('roadWidth').value),section:{...currentSection(),enabled:el('sectionEvaluation').checked},clearance:Number(el('clearance').value),notes:'Modelo cinemático experimental; não constitui certificação DNIT/AASHTO.'}}
function csv(){if(!sim)throw Error('Execute a simulação antes de exportar a trajetória');const {f}=localPath();return ['indice,latitude,longitude,angulo_rad,articulacao_rad',...sim.states.map((s,i)=>{const p=f.toLatLng(s.p);return [i,p.lat.toFixed(8),p.lng.toFixed(8),s.theta.toFixed(6),s.angle.toFixed(6)].join(',')})].join('\n')}
function sampleDemo(){const type=el('demo').value;if(type==='niteroi')usePath([{lat:-22.904,lng:-43.103},{lat:-22.9029,lng:-43.1021},{lat:-22.9022,lng:-43.1004},{lat:-22.9018,lng:-43.0988},{lat:-22.9025,lng:-43.0977}], 'Niterói — geometria FICTÍCIA (não corresponde ao eixo viário)',true);
 else{const orig=map.getCenter(),f=coordinateFrame(orig.lat,orig.lng);const coords=type==='straight'?[{x:0,y:0},{x:140,y:0}]:Array.from({length:26},(_,i)=>({x:40*Math.sin(i*Math.PI/50),y:40*(1-Math.cos(i*Math.PI/50))}));usePath(coords.map(p=>f.toLatLng(p)),type==='straight'?'Trecho reto de laboratório':'Curva de 90° (laboratório)',true)}}
map.on('click',e=>{if(cadMapMode){cadClear(true);cadOrigin={lat:e.latlng.lat,lng:e.latlng.lng};cadFrame=coordinateFrame(cadOrigin.lat,cadOrigin.lng);cadAnchor=startPose({x:0,y:0},rad(Number(el('cadHeading').value)||0));cadMapMode=false;points=[];resetSim();status('Âncora CAD posicionada. Adicione reta, arco ou clotóide.');return}if(!drawMode)return;points.push({lat:e.latlng.lat,lng:e.latlng.lng});resetSim();status(`Desenhando: ${points.length} pontos. Clique em “Concluir” para finalizar.`)});
el('draw').onclick=()=>{cadClear(true);drawMode=true;points=[];resetSim();status('Clique no mapa para posicionar os vértices. Finalize clicando em Concluir.')};
el('finish').onclick=()=>{drawMode=false;status(points.length>=2?'Traçado concluído. Clique em Calcular trajetória.':'Desenhe pelo menos dois pontos.')};
el('undo').onclick=()=>{if(points.length)points.pop();resetSim();status('Último vértice removido.')};
el('clear').onclick=()=>{stopConstruction();constructionStages=[];cadClear(true);points=[];resetSim();osmRoadLayer.clearLayers();updateConstructionUI();status('Projeto limpo.')};
el('useDemo').onclick=sampleDemo;
el('cadStart').onclick=()=>{cadMapMode=true;drawMode=false;status('Clique no mapa para posicionar a âncora CAD (ponto inicial).')};
el('cadAdd').onclick=()=>{try{if(!cadAnchor)throw Error('Posicione a âncora CAD no mapa antes de adicionar segmentos');cadSegments.push(cadInput());cadSelected=cadSegments.length-1;cadApply()}catch(e){status(e.message)}};
el('cadUpdate').onclick=()=>{try{if(cadSelected<0)throw Error('Selecione um segmento na lista');const prev=cadSegments[cadSelected];cadSegments[cadSelected]=cadInput();try{cadApply()}catch(e){cadSegments[cadSelected]=prev;throw e}}catch(e){status(e.message)}};
el('cadRemove').onclick=()=>{if(cadSelected<0)return;cadSegments.splice(cadSelected,1);cadSelected=-1;cadApply()};
el('cadUndo').onclick=()=>{cadSegments.pop();cadSelected=-1;cadApply()};
el('cadReset').onclick=()=>{cadClear();status('CAD limpo.')};

el('preset').onchange=()=>{fillVehicle(presets[el('preset').value]);resetSim()};el('trailer').onchange=()=>{toggleTrailer();resetSim()};
el('simulate').onclick=simulateNow;
el('play').onclick=()=>{if(!sim){status('Calcule a simulação primeiro.');return}if(timer){pause();return}el('play').textContent='Ⅱ';timer=setInterval(()=>{if(frame>=sim.states.length-1){pause();return}frame=Math.min(sim.states.length-1,frame+Math.max(1,Math.floor(sim.states.length/180)));updateFrame()},65)};
el('time').oninput=e=>{if(sim){frame=Number(e.target.value);updateFrame()}};
el('showEnvelope').onchange=()=>{render();visualizer.setSettings({showEnvelope:el('showEnvelope').checked})};el('showRoad').onchange=()=>{render();visualizer.setSettings({showRoad:el('showRoad').checked})};
el('viewMode').onchange=e=>switchView(e.target.value);el('followVehicle').onchange=e=>visualizer.setSettings({follow:e.target.checked});el('fitView').onclick=()=>{if(el('viewMode').value==='urban3d'){cityView?.fit();return}el('followVehicle').checked=false;refreshVisualization();if(el('viewMode').value==='map'&&points.length>1)map.fitBounds(L.latLngBounds(points.map(ll)).pad(.15),{maxZoom:18})};
el('roadWidth').onchange=()=>{if(sim)simulateNow();else{render();refreshVisualization()}};el('clearance').onchange=()=>{if(sim)simulateNow()};
el('saveJSON').onclick=()=>{try{download('roadworks_projeto.json',JSON.stringify(report(),null,2),'application/json')}catch(e){status(e.message)}};
el('saveGeo').onclick=()=>{if(points.length<2){status('Crie uma via antes de exportar.');return}
 const {f,path}=localPath(),w=currentWidth(),edges=el('sectionEvaluation').checked?sectionGeometry(path,currentSection()):roadSurface(path,w);
 const line=(p)=>p.map(x=>{const z=f.toLatLng(x);return [z.lng,z.lat]});
 const feat=(name,geom)=>({type:'Feature',properties:{name,road_width_m:w,source:cadSegments.length?'parametric_cad':'osm_or_manual',note:'cartografia preliminar'},geometry:geom});
 const features=[feat(projectName,{type:'LineString',coordinates:points.map(p=>[p.lng,p.lat])}),feat('Borda esquerda',{type:'LineString',coordinates:line(edges.left)}),feat('Borda direita',{type:'LineString',coordinates:line(edges.right)}),feat('Pista ilustrativa',{type:'Polygon',coordinates:[[...line(edges.polygon),line(edges.polygon)[0]]]})];
 if(el('showLanes').checked&&el('sectionEvaluation').checked){const g=sectionGeometry(path,currentSection());for(const lane of g.lanes)features.push(feat('Faixa '+lane.id,{type:'Polygon',coordinates:[[...line([...lane.left,...lane.right.slice().reverse()]),line(lane.left)[0]]] }));}download('roadworks_alinhamento_v06.geojson',JSON.stringify({type:'FeatureCollection',features},null,2),'application/geo+json')};
el('exportProfile').onclick=()=>{try{const {model,path,stations}=profileState(),samples=stationSamples(path,Number(el('stationInterval').value),stations);download('roadworks_perfil_v06.csv',['estaca_m,estaca_formatada,x_local_m,y_local_m,cota_projeto_m,rampa_percentual',...samples.map(p=>{const v=model.evaluate(p.s);return [p.s.toFixed(3),p.label,p.x.toFixed(3),p.y.toFixed(3),v.elevation.toFixed(3),v.gradePercent.toFixed(4)].join(',')})].join('\n'),'text/csv')}catch(e){status('CSV perfil: '+e.message)}};
el('saveCSV').onclick=()=>{try{download('roadworks_trajetoria.csv',csv(),'text/csv')}catch(e){status(e.message)}};
el('corridorBuild').onclick=()=>{try{buildCorridor()}catch(e){status('Corredor: '+e.message)}};
el('corridorEnable').onchange=()=>refreshVisualization();
el('corridorStep').onchange=()=>{corridor=null;earthworks=null;updateEarthworkInfo();updateCorridorInfo();refreshVisualization()};
el('corridorOBJ').onclick=()=>{try{const c=corridor||buildCorridor();download('roadworks_corredor_v07.obj',corridorOBJ(c),'text/plain')}catch(e){status('OBJ: '+e.message)}};
el('corridorCSV').onclick=()=>{try{const c=corridor||buildCorridor();download('roadworks_secoes_v07.csv',corridorSectionsCSV(c),'text/csv')}catch(e){status('Seções: '+e.message)}};
el('terrainLoad').onclick=async()=>{try{await importTerrain()}catch(e){status('MDT: '+e.message)}};
el('terrainDemo').onclick=()=>{try{createSyntheticTerrain()}catch(e){status('Terreno sintético: '+e.message)}};
el('terrainClear').onclick=()=>{terrain=null;earthworks=null;terrainInfo();updateEarthworkInfo();refreshVisualization();status('Terreno removido.')};
el('terrainVisible').onchange=refreshVisualization;el('earthworkVisible').onchange=refreshVisualization;
el('earthworkBuild').onclick=()=>{try{buildEarthworks()}catch(e){earthworks=null;updateEarthworkInfo();status('Terraplenagem: '+e.message)}};
el('earthworkCSV').onclick=()=>{try{const a=earthworks||buildEarthworks();download('roadworks_terraplenagem_v09.csv',earthworksCSV(a),'text/csv')}catch(e){status(e.message)}};
el('earthworkSections').onclick=()=>{try{const a=earthworks||buildEarthworks();download('roadworks_areas_v09.csv',earthworksSectionCSV(a),'text/csv')}catch(e){status(e.message)}};
el('earthworkOBJ').onclick=()=>{try{const a=earthworks||buildEarthworks();download('roadworks_taludes_v09.obj',earthworksOBJ(a),'text/plain')}catch(e){status(e.message)}};

async function applyProjectData(data){try{if(!['roadworks-swept-path/0.1','roadworks-swept-path/0.2','roadworks-swept-path/0.4','roadworks-swept-path/0.5','roadworks-swept-path/0.6','roadworks-swept-path/0.7','roadworks-swept-path/0.8','roadworks-swept-path/0.9','roadworks-swept-path/1.0','roadworks-swept-path/1.1','roadworks-swept-path/1.2','roadworks-swept-path/1.3','roadworks-swept-path/1.4','roadworks-swept-path/1.5','roadworks-swept-path/1.6'].includes(data.schema)||!Array.isArray(data.points)||(data.points.length<2&&!(data.points.length===0&&data.urbanV17?.document?.edges?.length))||data.points.length>20000)throw Error('Arquivo de projeto inválido');trafficEngineeringScenarios=Array.isArray(data.trafficEngineeringV16?.scenarios)?data.trafficEngineeringV16.scenarios.slice(-25):[];trafficEngineeringLast=data.trafficEngineeringV16?.last||null;urban.restore(data.urbanV17);fillVehicle(data.vehicle);el('roadWidth').value=data.roadWidth;el('clearance').value=data.clearance; if(data.section){for(const k of ['lanesPerDirection','laneWidth','shoulderLeft','shoulderRight','median'])if(data.section[k]!==undefined)el(k).value=data.section[k];el('sectionEvaluation').checked=data.section.enabled!==false;onSectionChange()}if(data.corridorConfig){el('corridorStep').value=data.corridorConfig.step??2;el('corridorEnable').checked=data.corridorConfig.enabled!==false}if(data.verticalProfile){profilePVIs=Array.isArray(data.verticalProfile.pvis)?data.verticalProfile.pvis:[];el('vStartZ').value=data.verticalProfile.startElevation;el('vStartGrade').value=data.verticalProfile.startGradePercent;el('stationInterval').value=data.stationInterval||20;el('crossfall').value=data.crossfallPercent??2;el('vCrossSlope').value=data.superelevationPercent??'';updatePviList()}else{profilePVIs=[];updatePviList();}if(data.designParameters){el('designSpeed').value=data.designParameters.speedKmh;el('superelevation').value=data.designParameters.superelevationPercent;el('sideFriction').value=data.designParameters.sideFriction;el('steerLimit').value=data.designParameters.steeringLimitDegrees}usePath(data.points,data.name||'Projeto importado');renderTrafficEngineeringHistory();if(data.construction4D){try{constructionStages=validateSchedule(data.construction4D.stages||[],localPath().path.length?pathStations(localPath().path).at(-1):Infinity);constructionDate=data.construction4D.date||constructionDate;el('cDate').value=constructionDate;}catch(err){constructionStages=[];status('Cronograma importado não passou na validação: '+err.message)}updateConstructionUI();}
 if(['roadworks-swept-path/0.5','roadworks-swept-path/0.6','roadworks-swept-path/0.7','roadworks-swept-path/0.8','roadworks-swept-path/0.9','roadworks-swept-path/1.0','roadworks-swept-path/1.1','roadworks-swept-path/1.2','roadworks-swept-path/1.3','roadworks-swept-path/1.4','roadworks-swept-path/1.5','roadworks-swept-path/1.6'].includes(data.schema)&&data.intersectionDesign?.roadA&&data.intersectionDesign?.roadB){try{const {path}=localPath();lastTurn={...data.intersectionDesign,points:path};updateTurnVehicle()}catch(error){status('Interseção não restaurada: '+error.message)}}
 if(data.digitalTwin?.assets){twin=data.digitalTwin;renderTwin();}
 if(['roadworks-swept-path/0.2','roadworks-swept-path/0.4','roadworks-swept-path/0.5','roadworks-swept-path/0.6','roadworks-swept-path/0.7','roadworks-swept-path/0.8','roadworks-swept-path/0.9','roadworks-swept-path/1.0','roadworks-swept-path/1.1','roadworks-swept-path/1.2','roadworks-swept-path/1.3','roadworks-swept-path/1.4','roadworks-swept-path/1.5','roadworks-swept-path/1.6'].includes(data.schema)&&data.cad?.segments?.length&&data.cad.frameOrigin){
  cadOrigin=data.cad.frameOrigin;cadFrame=coordinateFrame(cadOrigin.lat,cadOrigin.lng);cadAnchor=data.cad.anchor;cadSegments=data.cad.segments;cadSelected=-1;
  cadBuild=buildAlignment(cadAnchor,cadSegments,.55);cadRefresh();status('Projeto CAD importado com segmentos editáveis.')}refreshEngineering();cityView?.restore(data.urbanSceneV19);
 }catch(err){status('Erro ao importar: '+err.message);throw err}}
el('openJSON').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{await applyProjectData(JSON.parse(await file.text()));currentDbProject=null;localStorage.removeItem('rw15_project_id');dbStatus('JSON importado, ainda não salvo no SQLite.');}catch(err){status('Arquivo JSON: '+err.message)}};
el('search').onclick=async()=>{const query=el('place').value.trim();if(!query){status('Informe um local.');return}status('Consultando geocodificação…');try{const url='https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(query);const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!data.length)throw Error('Local não encontrado');map.setView([+data[0].lat,+data[0].lon],15);status('Mapa localizado. Clique em Vias OSM para obter os eixos viários desta área.')}catch(e){status('Falha ao buscar: '+e.message)}};
el('loadRoads').onclick=async()=>{const b=map.getBounds(),width=b.getEast()-b.getWest(),height=b.getNorth()-b.getSouth();if(width>.035||height>.035){status('Aproxime o zoom: selecione uma área menor que ~3 km antes de importar vias.');return}status('Consultando Overpass: carregando vias apenas da janela atual…');
 const q=`[out:json][timeout:20];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|motorway_link|trunk_link|primary_link|secondary_link)$"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()})->.roads;(.roads;rel(bw.roads)["type"="restriction"];);(._;>;);out body;`;
 try{const response=await fetch('https://overpass.kumi.systems/api/interpreter',{method:'POST',body:new URLSearchParams({data:q})});if(!response.ok)throw Error('Serviço Overpass HTTP '+response.status);
 const json=await response.json();urbanOSM=structuredClone(json);const nodeMap=new Map((json.elements||[]).filter(e=>e.type==='node').map(n=>[n.id,n]));for(const w of json.elements||[])if(w.type==='way'&&w.nodes)w.geometry=w.nodes.map(id=>nodeMap.get(id)).filter(Boolean).map(n=>({lat:n.lat,lon:n.lon}));osmRoadData=roadsFromOverpass(json.elements||[]);osmRoadLayer.clearLayers();osmNetwork=[];let count=0;
 for(const way of json.elements||[]){if(!way.geometry||way.geometry.length<2)continue;count++;const geometry=way.geometry.map(c=>({lat:c.lat,lng:c.lon}));osmNetwork.push(geometry);const latlngs=geometry.map(p=>[p.lat,p.lng]);
 const layer=L.polyline(latlngs,{color:'#7b97ed',weight:5,opacity:.65});layer.bindTooltip((way.tags?.name||'Via sem nome')+' · OSM '+way.id);layer.on('click',ev=>{L.DomEvent.stopPropagation(ev);selectRoad({geometry,name:(way.tags?.name||'Via OSM')+' #'+way.id})});layer.addTo(osmRoadLayer)}
 status(`${count} segmentos OSM encontrados. Clique na linha azul para selecionar o eixo.`);el('topologySummary').textContent=`${count} polilinhas carregadas. Clique em Diagnosticar OSM.`;
 }catch(err){status('Importação OSM indisponível: '+err.message+'. Use desenho manual ou exemplo.')}};
for(const k of ['lanesPerDirection','laneWidth','shoulderLeft','shoulderRight','median'])el(k).addEventListener('change',()=>{el('sectionPreset').value='custom';onSectionChange()});
el('sectionPreset').onchange=e=>applySectionPreset(e.target.value);
el('sectionEvaluation').onchange=()=>{onSectionChange();};el('showLanes').onchange=()=>{render();refreshVisualization()};
el('diagnoseTopo').onclick=()=>{try{if(!osmNetwork.length)throw Error('Carregue primeiro as vias OSM');const f=coordinateFrame(osmNetwork[0][0].lat,osmNetwork[0][0].lng);const lines=getNetworkLocal(f);const r=diagnoseNetwork(lines,Number(el('topologyTolerance').value));el('topologySummary').textContent=`Rede OSM: ${lines.length} vias, ${r.endpoints} extremidades e ${r.nearPairs} pares próximos (≤${r.tolerance} m). Não representa conectividade viária comprovada.`;status('Diagnóstico topológico concluído.')}catch(e){status(e.message)}};
el('repairTopo').onclick=()=>{try{if(points.length<2||!osmNetwork.length)throw Error('Selecione uma via e importe as vias OSM');if(cadSegments.length)throw Error('Não altere CAD paramétrico desta forma; selecione via OSM');const f=frameObj(),r=repairSelectedEndpoint(points.map(p=>f.toXY(p)),getNetworkLocal(f),Number(el('topologyTolerance').value));if(!r.changed)throw Error('Nenhuma extremidade próxima encontrada dentro da tolerância');points=r.path.map(p=>f.toLatLng(p));resetSim();status(`Extremidade ajustada em ${r.distance.toFixed(2)} m. Geometria alterada apenas no projeto local.`)}catch(e){status(e.message)}};
function runTurnDemo(){try{const c=map.getCenter(),f=coordinateFrame(c.lat,c.lng);const r=createTurn([{x:-100,y:0},{x:100,y:0}],[{x:0,y:-100},{x:0,y:100}]);usePath(r.points.map(p=>f.toLatLng(p)),'Concordância entre faixas · laboratório v0.5');commitTurn(r);status('Concordância v0.5 gerada. Execute a animação e avalie os alertas cinemáticos.')}catch(e){status('Concordância: '+e.message)}}
el('demoIntersection').onclick=runTurnDemo;
el('turnDemo').onclick=runTurnDemo;
for(const id of ['turnRadius','articulationLimit','steerLimit','clearance','trailer','preset',...Object.values(inputs)])el(id).addEventListener('change',()=>{if(lastTurn)updateTurnVehicle()});
for(const id of ['vStartZ','vStartGrade','stationInterval','crossfall','vCrossSlope'])el(id).addEventListener('change',profileChanged);
el('pviAdd').onclick=()=>{try{const p={station:Number(el('pviStation').value),gradeOutPercent:Number(el('pviGrade').value),curveLength:Number(el('pviLength').value)};const {total}=profileState();verticalModel({...profileInputs(),pvis:[...profilePVIs,p]},total);profilePVIs.push(p);profilePVIs.sort((a,b)=>a.station-b.station);updatePviList();profileChanged()}catch(e){status('PVI não incluído: '+e.message)}};
el('pviRemove').onclick=()=>{profilePVIs.pop();updatePviList();profileChanged()};el('pviReset').onclick=()=>{profilePVIs=[];updatePviList();profileChanged()};
el('vSample').onclick=()=>{try{const {total}=profileState(),L=Math.min(50,total*.25),s=total*.5;profilePVIs=[{station:s,gradeOutPercent:-1.5,curveLength:L}];el('vStartZ').value=20;el('vStartGrade').value=2;updatePviList();profileChanged();status('Greide demonstrativo aplicado. Cotas fictícias.') }catch(e){status(e.message)}};
el('stationSlider').oninput=e=>setSelectedStation(Number(e.target.value));
el('dockToggle').onclick=()=>{const d=el('engineeringDock'),closed=d.classList.toggle('collapsed');el('dockToggle').textContent=closed?'Expandir':'Recolher';if(!closed)requestAnimationFrame(refreshEngineering)};
el('intersectionMode').onclick=()=>{selectingCrossing=!selectingCrossing;crossingSelection=[];el('intersectionMode').classList.toggle('active',selectingCrossing);status(selectingCrossing?'Selecione duas vias OSM cruzadas (clique nas linhas azuis).':'Seleção cancelada.')};
fillVehicle(presets.car);applySectionPreset('rural_two');cadRefresh();updatePviList();sampleDemo();refreshEngineering();

// v0.8/v0.9 initial state
terrainInfo();updateEarthworkInfo();


// v1.1 – Vector identification, OCR text assistance, editable procedural components,
// optional ONNX inference. Human review is mandatory before geometry adoption.
function visibleBBox(){const b=map.getBounds();return {south:b.getSouth(),west:b.getWest(),north:b.getNorth(),east:b.getEast()}}
function listVisibleRoads(){
 const roads=visibleRoads(osmRoadData,visibleBBox()),names=dedupeStreetNames(roads);v11Roads=roads;
 el('visibleRoadSummary').textContent=`${roads.length} eixos cruzam a janela; ${names.length} nomes distintos. OSM fornece vetores, não OCR nem geometria 3D.`;
 const list=el('visibleRoadNames');list.replaceChildren();
 for(const n of names.slice(0,100)){const b=document.createElement('button');b.className='cad-row';b.textContent=`${n.name} · ${n.segments} trecho(s) · ${n.classes.join(', ')}`;b.onclick=()=>{
  const r=roads.find(z=>z.name===n.name);if(!r)return;
  const asset={name:r.name,geometry:r.geometry.map(([lng,lat])=>({lat,lng}))};selectRoad(asset);status(`Eixo OSM selecionado: ${r.name}. Verifique suas bordas na vistoria.`);
 };list.append(b)}
}
el('recognizeVisible').onclick=()=>{try{if(!osmRoadData.length)throw Error('Carregue as vias pelo botão Vias OSM');listVisibleRoads()}catch(e){status('Reconhecimento vetorial: '+e.message)}};
el('procAppend').onclick=()=>{try{
 if(!cadAnchor||!cadFrame)throw Error('Use Âncora CAD e clique num ponto no mapa');
 const c=createComponent(el('procType').value,{length:+el('procLength').value,radius:+el('procRadius').value,transition:+el('procTransition').value,direction:+el('procDirection').value,lanes:+el('lanesPerDirection').value*2,laneWidth:+el('laneWidth').value,shoulder:+el('shoulderRight').value});
 const previous=cadSegments.slice();try{cadSegments.push(...c.segments);cadSelected=cadSegments.length-1;cadApply()}catch(e){cadSegments=previous;throw e}
 el('procSummary').textContent=`Adicionado ${c.id}: ${c.segments.length} segmentos, ${c.lengthMeters.toFixed(1)} m. Edite no painel CAD.`;
 }catch(e){status('Procedural: '+e.message)}};
el('procExport').onclick=()=>{try{const c=createComponent(el('procType').value,{length:+el('procLength').value,radius:+el('procRadius').value,transition:+el('procTransition').value,direction:+el('procDirection').value});download(`roadworks_componente_${c.id}.json`,componentRecipeJSON(c),'application/json')}catch(e){status('Componente: '+e.message)}};
const loadScript=async(src,globalName)=>{
 if(window[globalName])return window[globalName];await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src=src;sc.onload=resolve;sc.onerror=()=>reject(Error('Biblioteca indisponível: '+globalName));document.head.append(sc)});
 if(!window[globalName])throw Error('Biblioteca carregada mas API ausente: '+globalName);return window[globalName];
};
async function decodeLocalImage(file){if(!file)throw Error('Selecione uma imagem');if(file.size>12_000_000)throw Error('Limite de imagem 12 MB');const bitmap=await createImageBitmap(file);return bitmap;}
function renderSegPreview(rgba,w,h){const c=el('segPreview');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0)}
async function inferSegmentation(){
 const file=el('segImage').files?.[0];const bitmap=await decodeLocalImage(file),size=+el('segSize').value;
 const cv=document.createElement('canvas');cv.width=cv.height=size;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(bitmap,0,0,size,size);bitmap.close();
 const pixels=cx.getImageData(0,0,size,size);v11ImageData=pixels;v11Image={name:file.name,size};v11BBox=visibleBBox();
 let result;
 if(el('segMode').value==='baseline')result=heuristicRoadMask(pixels.data,size,size);
 else{
  const model=el('segModel').files?.[0];if(!model)throw Error('Forneça uma rede neural .onnx treinada para segmentação de estradas');if(model.size>80_000_000)throw Error('Limite do modelo 80 MB');
  const ort=await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js','ort');
  const session=await ort.InferenceSession.create(await model.arrayBuffer(),{executionProviders:['wasm']});
  const input=session.inputNames[0];const tensor=imageTensor(pixels.data,size,size);
  const outputs=await session.run({[input]:new ort.Tensor('float32',tensor.data,tensor.dims)});const output=outputs[session.outputNames[0]];
  result=logitsToMask(output.data,output.dims,+el('segRoadClass').value);
 }
 v11Mask=result;
 const overlay=overlayMask(pixels.data,result.mask);renderSegPreview(overlay,size,size);
 const positives=result.mask.reduce((a,b)=>a+b,0);
 el('segSummary').textContent=`${result.neural?'Inferência ONNX neural':'Limiar de cor NÃO neural'} · ${file.name} · ${size}×${size} px · ${(100*positives/result.mask.length).toFixed(1)}% de pixels marcados. Verifique falsos positivos e alinhamento ao mapa.`;
 status(`Segmentação ${result.neural?'ONNX':'demonstrativa'} executada; exporte máscara para revisão.`);
}
el('segRun').onclick=async()=>{try{el('segSummary').textContent='Processando imagem local…';await inferSegmentation()}catch(e){v11Mask=null;el('segSummary').textContent='Erro: '+e.message;status('Segmentação: '+e.message)}};
el('segExportPNG').onclick=()=>{if(!v11Mask){status('Execute a segmentação primeiro');return}
 const c=document.createElement('canvas');c.width=v11Mask.width;c.height=v11Mask.height;const ctx=c.getContext('2d');const img=ctx.createImageData(c.width,c.height);
 for(let i=0;i<v11Mask.mask.length;i++){const v=v11Mask.mask[i]?255:0;img.data.set([v,v,v,255],4*i)}ctx.putImageData(img,0,0);c.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='roadworks_mascara.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)},'image/png')};
el('segExportGeo').onclick=()=>{try{
 if(!v11Mask)throw Error('Execute a segmentação primeiro');if(!el('segSameViewport').checked)throw Error('Confirme que a imagem corresponde exatamente à janela do mapa na hora da inferência');
 const geo=maskToGeoJSON(v11Mask.mask,v11Mask.width,v11Mask.height,v11BBox,{cell:8});
 geo.metadata={schema:'roadworks-segmentation/1.1',sourceImage:v11Image.name,method:v11Mask.method,warning:'Geolocalização aproximada por extensão da captura; NÃO constitui levantamento ou polígono cadastral',createdAt:new Date().toISOString()};
 download('roadworks_mascara_aproximada.geojson',JSON.stringify(geo),'application/geo+json');
 }catch(e){status('GeoJSON da imagem: '+e.message)}};
el('runMapOCR').onclick=async()=>{try{
 const file=el('ocrImage').files?.[0];if(!file)throw Error('Carregue captura da janela visível do mapa');if(file.size>12_000_000)throw Error('Imagem acima de 12MB');
 el('ocrResults').textContent='Lendo textos da captura…';const bbox=visibleBBox();
 const T=await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
 const worker=await T.createWorker('por+eng');let res;
 try{res=await worker.recognize(file)}finally{await worker.terminate()}
 const bitmap=await decodeLocalImage(file);const width=bitmap.width,height=bitmap.height;bitmap.close();
 const words=res.data.words||[];const hints=ocrWordHints(words,width,height,bbox,{minConfidence:48});
 v11OCRLayer.clearLayers();const list=el('ocrResults');list.replaceChildren();
 for(const hint of hints.slice(0,100)){const b=document.createElement('button');b.className='cad-row';b.textContent=`${hint.text} (${hint.confidence.toFixed(0)}%) · texto OCR`;list.append(b);
 L.circleMarker([hint.lat,hint.lng],{radius:3,color:'#ffe18c',fillOpacity:.8}).bindTooltip(`${hint.text} · OCR não confirmado`).addTo(v11OCRLayer)}
 if(!hints.length)list.textContent='Nenhum rótulo confiável encontrado. A imagem ou seus rótulos podem ser difíceis de ler.';
 status(`OCR: ${hints.length} palavras sugeridas. São rótulos, não ruas reconstruídas nem dados de altitude.`);
 }catch(e){el('ocrResults').textContent='Falha no OCR: '+e.message;status('OCR: '+e.message)}};

// v1.0 experimental geometric digital twin. No real-time sensor synchronization.
function twinSummary(){
 const e=el('twinSummary');if(!e)return;
 if(!twin){e.textContent='Nenhum gêmeo geométrico carregado.';el('twinAssets').replaceChildren();return;}
 const verified=twin.assets.filter(a=>a.review==='verificado').length;
 const total=twin.assets.reduce((v,a)=>v+a.lengthMeters,0);
 e.textContent=`${twin.assets.length} trechos · ${(total/1000).toFixed(2)} km de eixos · ${verified} revisados. Fonte cartográfica: ${[...new Set(twin.assets.map(a=>a.source))].join(', ')}. Sem dados ao vivo.`;
 const list=el('twinAssets');list.replaceChildren();
 for(const asset of twin.assets.slice(0,300)){
  const b=document.createElement('button');b.type='button';b.className='cad-row'+(asset.id===twinSelectedId?' selected':'');
  b.textContent=`${asset.name} · ${asset.classification} · ${(asset.lengthMeters).toFixed(0)}m · ${asset.review}`;
  b.onclick=()=>{
   twinSelectedId=asset.id;twinSummary();const geometry=asset.geometry.coordinates.map(([lng,lat])=>({lng,lat}));
   usePath(geometry,`Gêmeo geométrico: ${asset.name}`);
   const selected=L.latLngBounds(geometry.map(p=>[p.lat,p.lng]));map.fitBounds(selected.pad(.35),{maxZoom:18});
   status(`Ativo ${asset.id}: eixo cartográfico. Largura ${asset.widthMeters.toFixed(2)} m (${asset.widthEvidence}). Desenho NÃO substitui levantamento.`);
  };list.append(b);
 }
}
function renderTwin(){
 twinLayer.clearLayers();if(!twin)return;
 const polygons=[];
 for(const a of twin.assets){
  const ring=a.footprint.coordinates[0].map(([lng,lat])=>[lat,lng]);
  const color=a.review==='verificado'?'#53d5a2':a.review==='revisar'?'#e5a65e':a.review==='interditado'?'#ee6262':'#5ebae5';
  const polygon=L.polygon(ring,{color,weight:1,fillColor:color,fillOpacity:.22,interactive:true});
  polygon.on('click',ev=>{L.DomEvent.stopPropagation(ev);twinSelectedId=a.id;twinSummary();status(`Ativo ${a.name}: ${a.classification}, ${a.lengthMeters.toFixed(0)} m. Use a lista para selecionar o traçado CAD.`)});
  polygon.bindTooltip(`${a.name} | ${a.classification} | largura ~${a.widthMeters.toFixed(1)} m (${a.widthEvidence})`);
  polygon.addTo(twinLayer);polygons.push(polygon);
 }
 twinSummary();
}
function buildTwinFromRoads(roads,source){
 if(!roads.length)throw Error('Nenhuma via reconhecida no conjunto selecionado');
 const override=el('twinWidth').value.trim()===''?null:Number(el('twinWidth').value);
 if(override!==null&&(!Number.isFinite(override)||override<2||override>70))throw Error('Largura manual fora de 2–70 m');
 const stamp=new Date().toISOString();
 twin=buildTwin(roads.slice(0,1200),{overrideWidth:override,createdAt:stamp});
 twinSelectedId=null;renderTwin();
 status(`Gêmeo geométrico ${source}: ${twin.assets.length} trechos; ${twin.issues.length} geometrias descartadas. Bordas estimadas, requer vistoria.`);
}
el('twinFromOSM').onclick=()=>{try{if(!osmRoadData.length)throw Error('Clique em “Vias OSM (mapa visível)” antes de gerar o gêmeo');buildTwinFromRoads(osmRoadData,'OSM')}catch(e){status('Digital Twin: '+e.message)}};
el('twinGeoLoad').onclick=async()=>{try{const file=el('twinGeoFile').files?.[0];if(!file)throw Error('Escolha um GeoJSON de eixos de vias');if(file.size>12e6)throw Error('GeoJSON maior que 12MB; recorte a área');const parsed=normalizeRoadGeoJSON(JSON.parse(await file.text()));buildTwinFromRoads(parsed.roads,'GeoJSON');if(parsed.rejected)status(`GeoJSON: ${twin.assets.length} eixos importados; ${parsed.rejected} feições sem linha ou inválidas.`)}catch(e){status('GeoJSON: '+e.message)}};
el('twinReview').onclick=()=>{try{if(!twinSelectedId)throw Error('Selecione uma via na lista');addInspection(twin,twinSelectedId,{status:el('twinReviewStatus').value,note:el('twinReviewNote').value,author:'revisão manual — interface'});renderTwin();status('Inspeção local registrada com data/hora, sem alteração da fonte OSM.')}catch(e){status('Inspeção: '+e.message)}};
el('twinExportGeo').onclick=()=>{try{if(!twin)throw Error('Crie um gêmeo primeiro');download('roadworks_twin_superficies.geojson',JSON.stringify(twinGeoJSON(twin),null,2),'application/geo+json')}catch(e){status(e.message)}};
el('twinExportJSON').onclick=()=>{try{if(!twin)throw Error('Crie um gêmeo primeiro');download('roadworks_twin_ativos.json',JSON.stringify(twin,null,2),'application/json')}catch(e){status(e.message)}};
el('twinVisible').onchange=e=>{if(e.target.checked)twinLayer.addTo(map);else twinLayer.removeFrom(map)};
twinSummary();

// Optional surveyed, pre-labelled road points. A supervised/validated LiDAR segmentation model is not included.
el('twinPointsLoad').onclick=async()=>{try{
 if(!twinSelectedId||!twin)throw Error('Selecione primeiro um ativo na lista do gêmeo');
 const file=el('twinPointsFile').files?.[0];if(!file)throw Error('Escolha CSV lon,lat,z,class');
 if(file.size>3e6)throw Error('CSV acima de 3MB: recorte ou amostre');
 const parsed=parseClassifiedRoadCSV(await file.text()),asset=twin.assets.find(a=>a.id===twinSelectedId);
 const estimate=measureRoadPointCloud(asset,parsed.points);
 asset.pointCloudEvidence={...estimate,source:file.name,importedAt:new Date().toISOString()};
 el('twinPointSummary').textContent=`Largura indicativa: ${estimate.widthMeters.toFixed(2)} m · ${estimate.pointsUsed} pontos de pavimento · cobertura ${(estimate.coverage*100).toFixed(1)}% do eixo. Não altera automaticamente a pista.`;
 status('Amostras classificadas associadas ao eixo; revise as bordas antes de utilizar no desenho.');
 }catch(e){status('Pontos classificados: '+e.message)}
};
el('twinUseMeasured').onclick=()=>{try{
 const asset=twin?.assets.find(a=>a.id===twinSelectedId),w=asset?.pointCloudEvidence?.widthMeters;
 if(!Number.isFinite(w)||w<2||w>70)throw Error('Não há largura observada válida');
 const road={id:asset.id,name:asset.name,source:asset.source,sourceId:asset.sourceId,tags:{highway:asset.classification},coordinates:asset.geometry.coordinates};
 const rebuilt=buildTwin([road],{overrideWidth:w});if(!rebuilt.assets.length)throw Error('Geometria insuficiente');
 asset.widthMeters=w;asset.widthEvidence='observada-em-pontos-pre-classificados';asset.footprint=rebuilt.assets[0].footprint;
 asset.observations.push({status:'revisar',note:'Largura estimada a partir de pontos pré-classificados; revisão obrigatória',observedAt:new Date().toISOString(),author:'algoritmo experimental'});
 asset.review='revisar';renderTwin();status('Superfície redesenhada segundo estimativa de pontos classificados. Situação: REVISAR; não homologado.');
 }catch(e){status('Atualizar desenho: '+e.message)}
};


// v1.2: Review runs independently of traffic simulation and corridor generation.
reviewLayer=L.layerGroup().addTo(map);
function clearEngineeringReview(){engineeringReview=null;if(reviewLayer)reviewLayer.clearLayers();const summary=el('reviewSummary'),badge=el('reviewBadge');if(summary)summary.textContent='Análise desatualizada. Execute novamente depois de editar o projeto.';if(badge)badge.textContent='Pendente de revisão';const list=el('reviewIssues');if(list)list.replaceChildren();}
function drawReview(){reviewLayer.clearLayers();if(!engineeringReview||!el('reviewDraw').checked||points.length<2)return;
 const {f}=localPath();const geo=p=>{const q=f.toLatLng(p);return [q.lat,q.lng]};
 for(const s of engineeringReview.sight.filter(x=>x.firstBlock).slice(0,80)){
  L.polyline([geo(s.from),geo(s.to)],{color:'#ffc46b',weight:2,dashArray:'5 6',interactive:false}).addTo(reviewLayer);
  L.circleMarker(geo(s.firstBlock),{radius:5,color:'#fff',weight:1,fillColor:'#f3a541',fillOpacity:1,interactive:false}).addTo(reviewLayer);
 }
 for(const c of engineeringReview.conflicts){if(!c.conflict)continue;
  if(c.kind==='point')L.circle(geo(c.center),{radius:c.radius,color:'#fb6b73',weight:2,fillColor:'#f26269',fillOpacity:.18,interactive:false}).addTo(reviewLayer);
  if(c.kind==='polygon')L.polygon(c.polygon.map(geo),{color:'#fb6b73',weight:2,fillColor:'#f26269',fillOpacity:.25,interactive:false}).addTo(reviewLayer);
 }
}
function runEngineeringReview(){const {path}=localPath(),distance=Number(el('reviewDistance').value),step=Number(el('reviewStep').value),eyeHeight=Number(el('reviewEye').value),targetHeight=Number(el('reviewTarget').value);
 if(!(distance>=5&&distance<=600&&step>=.25&&step<=25))throw Error('Alcance ou passo da visada inválido');
 engineeringReview=reviewEngineering({path,profile:profileInputs(),segments:cadSegments,width:currentWidth(),section:currentSection(),maxGradePercent:Number(el('reviewGradeMax').value),minLaneWidth:Number(el('reviewLaneMin').value),obstacles:reviewObstacles,terrain,vehicleResult:sweptResult,speedKmh:Number(el('designSpeed').value),superelevation:Number(el('superelevation').value)/100,friction:Number(el('sideFriction').value),sightDistance:distance,eyeHeight,targetHeight,step,reactionSeconds:Number(el('reviewReaction').value),decelerationMps2:Number(el('reviewBrake').value),interval:Number(el('stationInterval').value)});
 const r=engineeringReview;const headline=`${r.counts.critical} interferência(s) crítica(s) · ${r.counts.warning} advertência(s) · ${r.counts.unknown} dado(s) insuficiente(s) | ${r.summary.sightChecks} visadas avaliadas`;
 el('reviewSummary').textContent=headline+' · Revisão exploratória, sem certificação normativa.';el('reviewBadge').textContent=headline;
 const list=el('reviewIssues');list.replaceChildren();for(const q of r.issues.slice(0,150)){const entry=document.createElement('div');entry.className='review-issue '+q.severity;const strong=document.createElement('b');strong.textContent=`${q.severity.toUpperCase()} · ${q.code}`;const detail=document.createElement('div');detail.textContent=q.message;entry.append(strong,detail);
 if(Number.isFinite(q.station)){const b=document.createElement('button');b.textContent='Ir para estaca '+q.station.toFixed(1)+' m';b.onclick=()=>{setSelectedStation(q.station);el('viewMode').value='map';switchView('map');const {f,path,stations}=profileState(),p=atStation(path,q.station,stations);map.panTo(f.toLatLng(p))};entry.append(b)}list.append(entry)}
 if(r.issues.length>150){const more=document.createElement('p');more.className='caption';more.textContent=`+ ${r.issues.length-150} alertas adicionais disponíveis no JSON/CSV`;list.append(more)}drawReview();status('Revisão preliminar concluída: '+headline);return r;
}
el('reviewRun').onclick=()=>{try{runEngineeringReview()}catch(e){status('Revisão: '+e.message);el('reviewSummary').textContent='Não foi possível executar: '+e.message}};
el('reviewLoad').onclick=async()=>{try{if(points.length<2)throw Error('Finalize um eixo para definir o referencial geográfico');const file=el('reviewObstacles').files?.[0];if(!file)throw Error('Escolha arquivo GeoJSON');if(file.size>5e6)throw Error('Limite de 5 MB para obstáculos');const {f}=localPath();reviewObstacles=importObstaclesGeoJSON(JSON.parse(await file.text()),p=>f.toXY(p));clearEngineeringReview();el('reviewObstacleSummary').textContent=`${reviewObstacles.length} obstáculo(s) georreferenciados carregados de ${file.name}.`;status('Obstáculos importados. Execute a revisão.')}catch(e){status('Obstáculos: '+e.message)}};
el('reviewClear').onclick=()=>{reviewObstacles=[];clearEngineeringReview();el('reviewObstacleSummary').textContent='Nenhum obstáculo cadastrado.'};
el('reviewDraw').onchange=drawReview;
el('reviewJSON').onclick=()=>{if(!engineeringReview){status('Execute a revisão antes de exportar');return}download('roadworks_revisao_v12.json',JSON.stringify(engineeringReview,null,2),'application/json')};
el('reviewCSV').onclick=()=>{if(!engineeringReview){status('Execute a revisão antes de exportar');return}download('roadworks_alertas_v12.csv',reviewCSV(engineeringReview),'text/csv')};
function openSection(section){const left=document.querySelector('#app > aside:not(.right)');if(!left||!section)return;for(const sec of left.querySelectorAll('section'))sec.classList.add('folded');section.classList.remove('folded');section.scrollIntoView({behavior:'smooth',block:'start'});}
el('reviewJump').onclick=()=>openSection(el('reviewPanel'));
const navSections={map:'01 /',cad:'02 /',profile:'05 /', '3d':'06 /',review:'16 /',construction:'17 /',traffic:'18 /',trafficeng:'19 /'};
for(const button of document.querySelectorAll('[data-workflow]'))button.onclick=()=>{const target=navSections[button.dataset.workflow],section=[...document.querySelectorAll('#app > aside:not(.right) section')].find(sec=>sec.querySelector('h3')?.textContent.trim().startsWith(target));openSection(section);if(button.dataset.workflow==='3d'){el('viewMode').value='3d';switchView('3d')}if(button.dataset.workflow==='review'&&points.length<2)status('Desenhe ou selecione uma via primeiro.');};
let focusMode=true;document.getElementById('app').classList.add('focus-panels');
for(const sec of document.querySelectorAll('#app > aside:not(.right) section')){if(sec!==el('reviewPanel')&&!sec.querySelector('h3')?.textContent.startsWith('01 /'))sec.classList.add('folded');const head=sec.querySelector('h3');if(!head)continue;head.tabIndex=0;head.setAttribute('role','button');head.setAttribute('aria-label','Expandir ou recolher '+head.textContent);const toggle=()=>{if(focusMode)sec.classList.toggle('folded')};head.addEventListener('click',toggle);head.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();toggle()}})}
el('focusToggle').onclick=()=>{focusMode=!focusMode;document.getElementById('app').classList.toggle('focus-panels',focusMode);for(const s of document.querySelectorAll('#app > aside:not(.right) section'))s.classList.toggle('folded',false)};


function constructionTotal(){return pathStations(localPath().path).at(-1)}
function constructionForView(){if(!points||points.length<2)return null;try{const path=localPath().path;const result=scheduleAt(constructionStages,constructionDate,{total:pathStations(path).at(-1)});return result.stages.map(s=>({...s,geometry:stageGeometry(path,s,{step:4})}));}catch(e){return null}}
function renderConstructionMap(){if(!constructionLayer)return;constructionLayer.clearLayers();if(!el('cVisible')?.checked||points.length<2||!constructionStages.length)return;
 try{const {f,path}=localPath();const active=scheduleAt(constructionStages,constructionDate,{total:pathStations(path).at(-1)});
 for(const s of active.stages){const vertices=stageGeometry(path,s,{step:6});const color=s.status==='completed'?'#76b5ff':s.status==='planned'?'#9ca3af':s.impact==='total'?'#f05b61':'#4ee0a9';L.polyline(vertices.map(v=>ll(f.toLatLng(v))),{color,weight:s.status==='active'?12:7,opacity:s.status==='planned'?.45:.72,interactive:true,dashArray:s.status==='planned'?'6 8':null}).bindTooltip(`${s.name} · ${s.status} · ${s.start} a ${s.end}`).addTo(constructionLayer);}}
 catch(e){console.warn('4D mapa:',e.message)}}
function stopConstruction(){if(constructionTimer)clearInterval(constructionTimer);constructionTimer=null;el('cPlay').textContent='▶ 4D'}
function constructionSetDate(value){try{scheduleAt(constructionStages,value,{total:points.length>=2?constructionTotal():Infinity});constructionDate=value;el('cDate').value=value;updateConstructionUI();}catch(e){status('Linha do tempo: '+e.message)}}
function constructionMove(days){constructionSetDate(new Date(Date.parse(constructionDate+'T00:00:00Z')+days*DAY_MS).toISOString().slice(0,10))}
function constructionSave(){return {schema:'roadworks-construction4d/1.3',project:projectName,crs:'EPSG:4326',stages:constructionStages,date:constructionDate,source:'Planejamento manual, não extraído do OSM'}}
function updateConstructionUI(){const list=el('cStageList');if(!list)return;list.replaceChildren();const max=points.length>=2?constructionTotal():Infinity;let current=null;
 try{current=scheduleAt(constructionStages,constructionDate,{total:max})}catch(e){el('cWarnings').textContent='Cronograma inválido: '+e.message;renderConstructionMap();return}
 for(const s of current.stages){const b=document.createElement('button');b.type='button';b.className='cad-row';b.textContent=`${s.name} · ${s.from.toFixed(0)}–${s.to.toFixed(0)}m · ${s.start} → ${s.end} · ${s.status} (${Math.round(s.progress*100)}%)`;b.onclick=()=>{for(const [id,v] of Object.entries({cName:s.name,cType:s.type,cImpact:s.impact,cStart:s.start,cEnd:s.end,cFrom:s.from,cTo:s.to,cCost:s.cost}))el(id).value=v;el('cAdd').dataset.edit=s.id;status('Etapa selecionada: altere campos e clique Adicionar etapa para atualizar.');};list.append(b)}
 const bounds=scheduleBounds(constructionStages),warn=scheduleWarnings(constructionStages,max);
 el('cWarnings').textContent=warn.length?`${warn.length} possíveis conflitos: ${warn.map(x=>x.a+' × '+x.b).join(', ')}. Rever interdições e desvios.`:'Sem interdições conflitantes identificadas (pré-análise).';
 if(bounds.start){const m=Math.max(0,Math.round((Date.parse(bounds.end+'T00:00:00Z')-Date.parse(bounds.start+'T00:00:00Z'))/DAY_MS));el('cTimeline').max=m;el('cTimeline').value=Math.max(0,Math.min(m,Math.round((Date.parse(constructionDate+'T00:00:00Z')-Date.parse(bounds.start+'T00:00:00Z'))/DAY_MS)));}
 el('cSummary').textContent=`${constructionDate} · ${current.active.length} em execução · ${current.completed.length} concluídas · ${current.planned.length} futuras · ${current.conflicts.length} alertas de sobreposição · R$ ${current.budget.toLocaleString('pt-BR',{maximumFractionDigits:2})} planejados`;
 renderConstructionMap();refreshVisualization();if(trafficComparison)status('A data 4D mudou: execute Comparar cenários para recalcular o tráfego.');}
el('cAdd').onclick=()=>{try{if(points.length<2)throw Error('Finalize um eixo antes de cadastrar etapas');const total=constructionTotal();const id=el('cAdd').dataset.edit||'etapa_'+(Date.now().toString(36));const v=validateStage({id,name:el('cName').value,type:el('cType').value,start:el('cStart').value,end:el('cEnd').value,from:Number(el('cFrom').value),to:Number(el('cTo').value),impact:el('cImpact').value,cost:Number(el('cCost').value)},total);constructionStages=constructionStages.filter(s=>s.id!==id).concat([v]);delete el('cAdd').dataset.edit;updateConstructionUI();status('Etapa 4D cadastrada.');}catch(e){status('Etapa 4D: '+e.message)}};
el('cDemo').onclick=()=>{try{if(points.length<2)throw Error('Finalize o traçado antes');const n=constructionTotal(),one=n/3;constructionStages=[{id:'dem_levant',name:'Levantamento',type:'survey',start:'2026-12-01',end:'2026-12-03',from:0,to:n,impact:'none',cost:0},{id:'dem_terra',name:'Terraplenagem',type:'earthworks',start:'2026-12-04',end:'2026-12-10',from:0,to:Math.max(.1,one),impact:'one_lane',cost:0},{id:'dem_dreno',name:'Drenagem',type:'drainage',start:'2026-12-08',end:'2026-12-13',from:one,to:2*one,impact:'shoulder',cost:0},{id:'dem_pav',name:'Pavimentação',type:'pavement',start:'2026-12-14',end:'2026-12-20',from:0,to:n,impact:'one_lane',cost:0},{id:'dem_sinal',name:'Sinalização',type:'markings',start:'2026-12-21',end:'2026-12-24',from:0,to:n,impact:'none',cost:0}];constructionDate='2026-12-01';updateConstructionUI();status('Cronograma fictício gerado. Datas e custos não representam obra real.')}catch(e){status('Cronograma exemplo: '+e.message)}};
el('cRemove').onclick=()=>{const id=el('cAdd').dataset.edit;if(!id){status('Selecione uma etapa na lista antes de excluir.');return}constructionStages=constructionStages.filter(s=>s.id!==id);delete el('cAdd').dataset.edit;updateConstructionUI();status('Etapa excluída.')};
el('cClear').onclick=()=>{stopConstruction();constructionStages=[];delete el('cAdd').dataset.edit;updateConstructionUI()};
el('cImport').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>500000)throw Error('Arquivo acima de 500 KB');const doc=JSON.parse(await file.text());if(doc.schema!=='roadworks-construction4d/1.3')throw Error('Formato não suportado');if(points.length<2)throw Error('Finalize um eixo antes de importar cronograma');const imported=validateSchedule(doc.stages||[],constructionTotal());stopConstruction();constructionStages=imported;constructionDate=doc.date||constructionDate;updateConstructionUI();status('Cronograma importado; confira datas, correspondência espacial e fonte.')}catch(err){status('Importação 4D: '+err.message)}};

el('cDate').onchange=e=>constructionSetDate(e.target.value);el('cPrev').onclick=()=>constructionMove(-1);el('cNext').onclick=()=>constructionMove(1);
el('cTimeline').oninput=e=>{const b=scheduleBounds(constructionStages);if(b.start)constructionSetDate(new Date(Date.parse(b.start+'T00:00:00Z')+Number(e.target.value)*DAY_MS).toISOString().slice(0,10))};
el('cPlay').onclick=()=>{if(constructionTimer){stopConstruction();return}if(!constructionStages.length){status('Crie etapas primeiro.');return}const b=scheduleBounds(constructionStages);if(constructionDate>=b.end)constructionSetDate(b.start);el('cPlay').textContent='⏸ Pausar';constructionTimer=setInterval(()=>{if(constructionDate>=b.end){stopConstruction();return}constructionMove(1)},700)};
el('cVisible').onchange=()=>{renderConstructionMap();refreshVisualization()};
el('cExport').onclick=()=>{try{download('roadworks_cronograma_v13.csv','\ufeff'+constructionCSV(constructionStages),'text/csv;charset=utf-8')}catch(e){status(e.message)}};
el('cJSON').onclick=()=>download('roadworks_cronograma_v13.json',JSON.stringify(constructionSave(),null,2),'application/json');
function reviewPreflight(){const problems=[];if(drawMode)problems.push('Traçado ainda em modo desenho: clique em Concluir.');if(points.length<2)problems.push('Falta um eixo com pelo menos dois pontos.');else {try{profileState()}catch(e){problems.push('Greide: '+e.message+' — confira PVI/curvas e comprimento do trecho.')}try{currentSection()}catch(e){problems.push('Seção: '+e.message)}}if(!terrain)problems.push('Sem terreno natural: não será possível avaliar obstruções topográficas.');if(!sim)problems.push('A varredura veicular não foi calculada; essa parte ficará indeterminada.');el('reviewPreflight').textContent=problems.length?problems.map((x,i)=>`${i+1}. ${x}`).join(' | '):'Pré-requisitos básicos prontos. Critérios continuam preliminares.';return problems;}
el('reviewCheck').onclick=()=>{reviewPreflight();openSection(el('reviewPanel'))};
el('reviewFixGrade').onclick=()=>{if(points.length<2){status('Defina primeiro um eixo.');return}try{profileState();status('Greide já é válido; nenhuma alteração realizada.')}catch(e){profilePVIs=[];updatePviList();el('vStartGrade').value='0';if(!Number.isFinite(Number(el('vStartZ').value)))el('vStartZ').value='0';profileChanged();reviewPreflight();status('Greide reiniciado para rampa 0% sem PVIs. Revise a cota antes de usar em projeto real.')}};

updateConstructionUI();

// RoadWorks v1.4: traffic PREVIEW + explicit SUMO results import.
function tConfig(){
 const lengthM=points.length>=2?Math.max(30,Math.min(30000,constructionTotal())):1000;
 return {demandVph:Number(el('tDemand').value),baseLanes:Number(el('tLanes').value),capacityPerLane:Number(el('tCapacity').value),freeSpeedKmh:Number(el('tSpeed').value),lengthM,detourLengthFactor:Number(el('tDetourFactor').value),detourLanes:Number(el('tDetourLanes').value),detourFraction:Number(el('tDetourPct').value)/100,minutes:Number(el('tMinutes').value),stepSeconds:10,vehicleSpaceM:7};
}
function tImpact(){return el('tImpact').value==='schedule'?scheduleImpact(constructionStages,constructionDate,0,tConfig().lengthM).impact:el('tImpact').value}
function trafficChart(base,work){const canvas=el('trafficCanvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0d2029';ctx.fillRect(0,0,w,h);const max=Math.max(1,...base.series.map(x=>x.totalQueue),...work.series.map(x=>x.totalQueue)),length=Math.max(1,base.series.at(-1)?.minute||1);ctx.lineWidth=1;ctx.strokeStyle='#405b64';for(let j=0;j<4;j++){const y=20+j*(h-44)/3;ctx.beginPath();ctx.moveTo(38,y);ctx.lineTo(w-10,y);ctx.stroke()}
 function line(rows,color){ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.beginPath();for(let i=0;i<rows.length;i++){const p=rows[i],x=38+p.minute/length*(w-52),y=20+(1-p.totalQueue/max)*(h-44);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()}
 line(base.series,'#4dd7aa');line(work.series,'#f2a95a');ctx.font='11px Arial';ctx.fillStyle='#bed9dd';ctx.fillText('Fila (veículos)',8,13);ctx.fillStyle='#4dd7aa';ctx.fillText('Sem obra',48,h-8);ctx.fillStyle='#f2a95a';ctx.fillText('Com obra',150,h-8);ctx.fillStyle='#bed9dd';ctx.fillText(`${length} min`,w-60,h-8);ctx.fillText(String(Math.ceil(max)),3,24)
}
function trafficMapNote(impact){trafficLayer.clearLayers();if(points.length<2)return;const p=points[Math.floor(points.length/2)];L.circleMarker([p.lat,p.lng],{radius:10,color:'#f3b76d',fillColor:'#d56d47',fillOpacity:.6}).bindTooltip('Tráfego: '+impact+' (fila agregada; desvio não georreferenciado)').addTo(trafficLayer)}
function runTraffic(){try{const conf=tConfig(),impact=tImpact(),base=trafficPreview(conf),work=trafficPreview(conf,{impact});trafficComparison={base,work,conf,impact,date:constructionDate};trafficSumoReport=null;el('tSumoSummary').textContent='SUMO não executado nesta comparação. Exporte o cenário para simulação microscópica.';
 trafficChart(base,work);trafficMapNote(impact);const fmt=x=>x.toFixed(1).replace('.',',');
 el('tSummary').textContent=`Prévia agregada · ${constructionDate} · ${impact} | Demanda ${conf.demandVph} veíc./h | Fila máxima: base ${fmt(base.maxQueueVehicles)} → obra ${fmt(work.maxQueueVehicles)} veículos | Atraso estimado: base ${fmt(base.meanQueueDelayMinutesPerArrival)} → obra ${fmt(work.meanQueueDelayMinutesPerArrival)} min/veículo | Veículos não atendidos ao final: ${fmt(work.unserved)}. A representação do desvio é ABSTRATA, não uma rua OSM selecionada.`;
 status('Prévia de tráfego calculada. Para microssimulação real, exporte e execute o cenário no SUMO.');}catch(err){status('Tráfego: '+err.message)}}
el('tRun').onclick=runTraffic;
el('tClear').onclick=()=>{trafficComparison=null;trafficSumoReport=null;trafficLayer.clearLayers();el('tSummary').textContent='Análise limpa.';el('tSumoSummary').textContent='SUMO não executado.';const c=el('trafficCanvas');c.getContext('2d').clearRect(0,0,c.width,c.height)};
el('tPreviewCSV').onclick=()=>{if(!trafficComparison){status('Calcule a prévia primeiro.');return}download('roadworks_v14_filas_previa.csv','\ufeff'+previewCSV(trafficComparison.work),'text/csv;charset=utf-8')};
el('tExportScenario').onclick=()=>{try{const cfg=tConfig();const stage=(tImpact()==='none'?'none':tImpact());const scenario=buildTrafficScenario(cfg,[],constructionDate);scenario.scenario.impact=stage;scenario.scenario.stageIds=el('tImpact').value==='schedule'?scheduleImpact(constructionStages,constructionDate,0,cfg.lengthM).active:[];download('roadworks_v14_cenario_sumo.json',JSON.stringify(scenario,null,2),'application/json');status('Cenário SUMO exportado (duas rotas sintéticas; não representa rede real).')}catch(e){status('SUMO: '+e.message)}};
el('tImportSUMO').onchange=async ev=>{try{const file=ev.target.files?.[0];if(!file)return;if(file.size>5000000)throw Error('Resultado acima de 5 MB');const doc=validateSumoReport(JSON.parse(await file.text()));trafficSumoReport=doc;const a=doc.baseline,b=doc.work;el('tSumoSummary').textContent=`SUMO executado · rede ${doc.model} | Veículos chegaram: base ${a.arrived}/${a.offered} vs obra ${b.arrived}/${b.offered} | Tempo médio: ${(a.meanDurationSeconds/60).toFixed(2)} vs ${(b.meanDurationSeconds/60).toFixed(2)} min | Espera média: ${a.meanWaitingSeconds.toFixed(1)} vs ${b.meanWaitingSeconds.toFixed(1)} s | Máx. veículos parados: ${a.maxHaltingVehicles} vs ${b.maxHaltingVehicles}. Atenção: rede e demanda sintéticas, sem calibração.`;status('Resultados da microssimulação SUMO importados.');}catch(err){status('Resultado SUMO: '+err.message)}};

// v1.6 — network triage and comparable experimental strategies.
function engValue(id){return Number(el(id).value)}
function renderTrafficEngineeringHistory(){
 const list=el('teHistory');if(!list)return;list.replaceChildren();
 if(!trafficEngineeringScenarios.length){list.textContent='Nenhum cenário registrado.';return}
 for(const item of trafficEngineeringScenarios.slice(-15).reverse()){
  const b=document.createElement('button');b.className='cad-row';b.textContent=`${item.name}: fila máx. ${item.result.work.maxQueueVehicles.toFixed(1)} veíc.; atraso ${item.result.work.meanQueueDelayMinutesPerArrival.toFixed(2)} min/veíc.`;
  b.onclick=()=>{trafficEngineeringLast=item;el('teSummary').textContent=JSON.stringify(item.result.changes,null,2);status('Cenário selecionado no histórico.');};list.append(b);
 }
}
function analyzeHierarchyUI(){try{
 if(!osmRoadData.length)throw Error('Carregue vias OSM no mapa ou importe dados de rede antes da análise');
 const analysis=analyzeRoadHierarchy(osmRoadData),connections=screenRoadAccesses(osmRoadData.slice(0,600)),fmt=Object.entries(analysis.counts).filter(([,v])=>v).map(([key,v])=>`${HIERARCHY_LABELS[key]} ${v}`).join(' · ');
 const list=el('teRoads');list.replaceChildren();for(const item of analysis.mapped.slice(0,120)){
  const row=document.createElement('div');row.className='cad-row';row.textContent=`${item.name} · ${HIERARCHY_LABELS[item.hierarchy]} · ${item.lanes??'?'} faixa(s) · ${item.maxspeedKmh??'?'} km/h${item.oneway?' · mão única':''}`;list.append(row)
 }
 el('teHierarchy').textContent=`${analysis.mapped.length} segmentos OSM: ${fmt}. ${connections.candidateConnections} pares de extremidades próximos (conexões candidatas). Tipologia OSM é apenas proxy funcional e requer confirmação local.`;
 status('Hierarquia OSM identificada; verifique a classificação no contexto local.');
 }catch(e){el('teHierarchy').textContent=e.message;status('Hierarquia: '+e.message)}
}
function analyzeTrafficEngineering(){try{
 const demand=engValue('teDemand'),capacity=engValue('teCapacity'),up=engValue('teUp'),down=engValue('teDown'),heavy=engValue('teHeavy'),control=el('teControl').value;
 const bottleneck=assessBottleneck({inLanes:up,outLanes:down,demandVph:demand,capacityPerLane:capacity,heavyVehiclesPercent:heavy,greenRatio:1});
 const crossings=intersectionAlternatives({demandVph:demand,lanes:down,capacityPerLane:capacity,control,greenRatio:engValue('teGreen')/100,pedestrianCrossingsPerHour:engValue('tePed')});
 const laneAudit=auditLaneMovements([{id:'Faixa 1',movements:[el('teLane1').value]},{id:'Faixa 2',movements:el('teLane2').value.split(',')}]);
 const multimodal=multimodalDemand({carsVph:Math.max(0,demand-engValue('teBuses')-engValue('teTrucks')),busesVph:engValue('teBuses'),heavyVehiclesVph:engValue('teTrucks'),busOccupancy:engValue('teBusOccupancy')});
 const base=tConfig();const compareConfig={...base,demandVph:Math.min(demand,15000),baseLanes:up,capacityPerLane:capacity};
 const result=compareTrafficStrategies(compareConfig,{impact:el('teImpact').value,detourFraction:engValue('teDetour')/100,capacityFactor:engValue('teCapacityFactor')/100});
 const name=(el('teName').value||'Cenário '+(trafficEngineeringScenarios.length+1)).slice(0,100);
 const scenario={name,createdAt:new Date().toISOString(),bottleneck,crossings,laneAudit,multimodal,result};trafficEngineeringLast=scenario;trafficEngineeringScenarios.push(scenario);if(trafficEngineeringScenarios.length>25)trafficEngineeringScenarios.shift();
 const selected=crossings.alternatives.find(a=>a.id===control);
 el('teSummary').textContent=`${name} · V/C trecho ${bottleneck.vOverC.toFixed(2)} (${bottleneck.level}) · Excesso ${bottleneck.excessVph.toFixed(0)} veíc./h · Controle ${control}: V/C ilustrativo ${selected.vOverC.toFixed(2)} · Transporta ${multimodal.passengersPerHour.toFixed(0)} passageiros/h (ocupação assumida) · Fila máx. prévia: base ${result.baseline.maxQueueVehicles.toFixed(1)} × cenário ${result.work.maxQueueVehicles.toFixed(1)} veículos. As interseções e o desvio NÃO são simulados individualmente. Movimentos por faixa: ${laneAudit.issues.length} alerta(s). Revisão obrigatória.`;
 renderTrafficEngineeringHistory();status('Cenário de triagem v1.6 calculado; use SUMO calibrado para decisões de projeto.');
 }catch(e){el('teSummary').textContent='Não calculado: '+e.message;status('Engenharia de tráfego: '+e.message)}
}
el('teHierarchyRun').onclick=analyzeHierarchyUI;
el('teAnalyze').onclick=analyzeTrafficEngineering;
el('teCSV').onclick=()=>{if(!trafficEngineeringScenarios.length){status('Calcule ao menos um cenário.');return}download('roadworks_v16_comparacoes.csv','\ufeff'+strategiesCSV(trafficEngineeringScenarios),'text/csv;charset=utf-8')};
el('teJSON').onclick=()=>{if(!trafficEngineeringScenarios.length){status('Calcule ao menos um cenário.');return}download('roadworks_v16_cenarios.json',JSON.stringify({schema:'roadworks-traffic-engineering/1.6',scenarios:trafficEngineeringScenarios},null,2),'application/json')};
renderTrafficEngineeringHistory();

// Layer Explorer: render only. Source objects and engineering state are preserved.
const v14Layers={layerOSM:()=>osmRoadLayer,layerTwin:()=>twinLayer,layerConstruction:()=>constructionLayer,layerReview:()=>reviewLayer,layerTraffic:()=>trafficLayer};
for(const [inputId,layerFn] of Object.entries(v14Layers)){el(inputId).onchange=ev=>{const layer=layerFn();if(!layer)return;if(ev.target.checked){if(!map.hasLayer(layer))layer.addTo(map)}else if(map.hasLayer(layer))map.removeLayer(layer);status('Camada '+inputId+': '+(ev.target.checked?'visível':'oculta')+'. A geometria permanece no projeto.')}}


// v1.5 Local SQLite persistence. Same-origin FastAPI serves static frontend and API.
let currentDbProject=null, lastDbFingerprint='',dbSaveBusy=false,dbLoading=false;
const dbStatus=t=>{const x=el('dbStatus');if(x)x.textContent=t};
async function dbRequest(path,options={}){
 const response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 if(!response.ok){let info;try{info=await response.json()}catch{};throw Error((info?.detail||`HTTP ${response.status}`))}
 return response.json();
}
function dbFingerprint(doc){return JSON.stringify(doc)}
function setProjectIdentity(id){currentDbProject=id||null;if(id)localStorage.setItem('rw15_project_id',id);else localStorage.removeItem('rw15_project_id');}
async function dbRefresh(){
 try{const r=await dbRequest('/projects');const list=el('dbProjects'),old=list.value;list.replaceChildren();
 for(const item of r.projects){const option=document.createElement('option');option.value=item.id;option.textContent=`${item.name} · r${item.latest_revision} · ${item.updated_at.slice(0,16)}`;list.append(option)}
 const wanted=currentDbProject||old;if([...list.options].some(o=>o.value===wanted))list.value=wanted;
 dbStatus(`SQLite conectado · ${r.projects.length} projetos. Projeto ativo: ${currentDbProject||'nenhum'}`);
 }catch(e){dbStatus(`API indisponível: ${e.message}. Abra o RoadWorks em http://127.0.0.1:8000 (FastAPI).`)}
}
async function dbSave(reason='manual',fork=false){
 if(dbSaveBusy||dbLoading)return;
 if(points.length<2&&!urban.snapshot().document.edges.length){if(reason==='manual')dbStatus('Crie um traçado ou uma rede urbana antes de salvar.');return}
 let doc;try{doc=report()}catch(e){dbStatus('Não foi possível coletar o projeto: '+e.message);return}
 const fingerprint=dbFingerprint(doc);
 if(reason==='autosave'&&fingerprint===lastDbFingerprint)return;
 dbSaveBusy=true;el('dbSave').disabled=true;
 try{
  const id=fork?null:currentDbProject;
  const result=await dbRequest(id?'/projects/'+encodeURIComponent(id):'/projects',{method:id?'PUT':'POST',body:JSON.stringify({document:doc,reason})});
  setProjectIdentity(result.id);lastDbFingerprint=fingerprint;
  dbStatus(`${result.changed?'Salvo':'Sem alterações'} · revisão ${result.revision} · ${new Date().toLocaleTimeString('pt-BR')}`);
  if(reason!=='autosave')await dbRefresh();
 }catch(e){dbStatus('Falha ao salvar no SQLite: '+e.message)}
 finally{dbSaveBusy=false;el('dbSave').disabled=false}
}
async function dbOpen(revision=null){
 const id=el('dbProjects').value;if(!id){dbStatus('Selecione um projeto.');return}
 if(dbSaveBusy)return;
 dbLoading=true;
 try{const record=await dbRequest('/projects/'+encodeURIComponent(id)+(revision?'?revision='+revision:''));
  await applyProjectData(record.document);setProjectIdentity(id);
  lastDbFingerprint=dbFingerprint(report());
  dbStatus(`Carregado ${id} · revisão ${record.revision}; nenhuma alteração feita na revisão histórica.`);
  await dbLoadVersions();
 }catch(e){dbStatus('Falha ao abrir: '+e.message)}finally{dbLoading=false}
}
async function dbLoadVersions(){
 const id=el('dbProjects').value;if(!id)return;
 try{const data=await dbRequest('/projects/'+encodeURIComponent(id)+'/revisions');
 const list=el('dbRevisions');list.replaceChildren();
 for(const r of data.revisions){const opt=document.createElement('option');opt.value=r.revision;opt.textContent=`r${r.revision} · ${r.reason} · ${r.created_at.slice(0,19)}`;list.append(opt)}
 }catch(e){dbStatus('Histórico: '+e.message)}
}
el('dbRefresh').onclick=dbRefresh;
el('dbSave').onclick=()=>dbSave('manual');
el('dbFork').onclick=()=>dbSave('copia',true);
el('dbOpen').onclick=()=>dbOpen();
el('dbLoadRevision').onclick=()=>{const v=Number(el('dbRevisions').value);if(v)dbOpen(v)};
el('dbProjects').onchange=dbLoadVersions;

async function dbSaveResults(){
 if(!currentDbProject){dbStatus('Salve o projeto no SQLite antes de arquivar análises.');return}
 const candidates=[];
 if(urban.latest()){const run=urban.latest();candidates.push({kind:'urban_traffic',summary:{...run,input:undefined,referenceInput:undefined},provenance:'modelo mesoscópico urbano v1.7; não calibrado; entrada completa no snapshot do projeto'})}
 if(trafficSumoReport)candidates.push({kind:'sumo',summary:trafficSumoReport,provenance:'resultado SUMO importado pelo usuário; conferir rede e calibração'});
 if(trafficEngineeringLast)candidates.push({kind:'traffic_engineering',summary:trafficEngineeringLast,provenance:'triagem agregada v1.6; fatores hipotéticos, não calibração'});
 if(trafficComparison)candidates.push({kind:'traffic_preview',summary:{date:trafficComparison.date,impact:trafficComparison.impact,parameters:trafficComparison.conf,previewOnly:true},provenance:'simulação agregada, não microscópica'});
 if(engineeringReview)candidates.push({kind:'engineering_review',summary:report().engineeringReview,provenance:'checagens experimentais RoadWorks'});
 if(earthworks)candidates.push({kind:'earthworks',summary:report().earthworksSummary,provenance:'volumes preliminares requerem verificação topográfica'});
 if(!candidates.length){dbStatus('Não há análises calculadas nesta sessão para arquivar.');return}
 try{for(const item of candidates)await dbRequest('/projects/'+encodeURIComponent(currentDbProject)+'/runs',{method:'POST',body:JSON.stringify(item)});
 dbStatus(`${candidates.length} análises arquivadas com a procedência correspondente.`)
 }catch(e){dbStatus('Erro ao arquivar análises: '+e.message)}
}
el('dbArchiveRuns').onclick=dbSaveResults;

el('dbNew').onclick=()=>{setProjectIdentity(null);lastDbFingerprint='';dbStatus('Novo projeto lógico: o conteúdo atual será salvo com outro ID.');};
// Automatic snapshot every 20 seconds if state has changed. No background work once tab is closed.
setInterval(()=>{if(el('dbAutosave').checked)dbSave('autosave')},20000);
// Do not silently restore data in a new tab; offer explicit recovery of the last project.
(async()=>{try{await dbRequest('/health');const last=localStorage.getItem('rw15_project_id');if(last)currentDbProject=last;await dbRefresh();await dbLoadVersions();if(last)dbStatus('Projeto anterior encontrado. Clique Abrir para recuperá-lo.')}catch(e){dbStatus('SQLite indisponível. Inicie FastAPI na porta 8000. Exportação JSON continua disponível.')}})();

const urban=mountUrban({map,L,download,status,getOSM:()=>urbanOSM,getStages:()=>({stages:constructionStages,date:constructionDate}),openAxis:(axis,name)=>usePath(axis,name),onSceneChange:()=>cityView?.refresh()});

cityView=mountUrbanScene({getState:()=>urban.sceneState(),selectEdge:id=>urban.selectEdge(id),applyStudy:study=>urban.applySceneStudy(study),getLegacyTerrain:()=>terrain&&points.length>=2?{terrain,origin:{lat:points[0].lat,lon:points[0].lng}}:null,activate:()=>{el('viewMode').value='urban3d';switchView('urban3d')},download,status});
