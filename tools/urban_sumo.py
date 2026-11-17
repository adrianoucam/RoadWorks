"""RoadWorks urban 1.7: explicit geographic network and reproducible SUMO inputs.

python tools/urban_sumo.py study.json --output ../urban_run --prepare-only
python tools/urban_sumo.py study.json --output ../urban_run --run
Only --run produces simulation metrics. No commercial software is required.
"""
from __future__ import annotations
import argparse
import hashlib
import heapq
import json
import math
import shutil
import statistics
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

MODES={'car':'passenger','bus':'bus','truck':'truck','pedestrian':'pedestrian'}

def number(v, minimum, maximum, integer=False):
    if isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v) or not minimum<=v<=maximum or (integer and int(v)!=v):
        raise ValueError('Número inválido no estudo urbano')
    return v

def validate(doc, sumo_export=True):
    if not isinstance(doc,dict) or doc.get('schema')!='roadworks-urban/1.7':raise ValueError('Schema urbano inválido')
    city=doc.get('city',{})
    if not isinstance(city.get('name'),str) or not city['name'].strip() or len(city['name'])>150:raise ValueError('Nome da cidade inválido')
    number(city['lat'],-85,85);number(city['lon'],-180,180)
    if doc.get('source') not in ('synthetic','observed','mixed','osm'):raise ValueError('Origem de dados inválida')
    if len(json.dumps(doc,allow_nan=False))>3_000_000:raise ValueError('Estudo grande demais')
    for key,limit in [('nodes',2000),('edges',4000),('od',300),('events',300),('signals',500),('demandAdjustments',300)]:
        if not isinstance(doc.get(key),list) or len(doc[key])>limit:raise ValueError('Lista inválida: '+key)
    nodes={n['id']:n for n in doc['nodes']};edges={e['id']:e for e in doc['edges']}
    if not edges or len(nodes)!=len(doc['nodes']) or len(edges)!=len(doc['edges']):raise ValueError('IDs repetidos ou rede vazia')
    import re
    for key in [*nodes,*edges]:
        if not isinstance(key,str) or not re.fullmatch(r'[\w.:-]{1,100}',key,flags=re.ASCII):raise ValueError('ID inválido')
    for n in nodes.values():number(n['lat'],-85,85);number(n['lon'],-180,180)
    for e in edges.values():
        if e['from'] not in nodes or e['to'] not in nodes or e['from']==e['to']:raise ValueError('Extremos inválidos')
        number(e['lanes'],1,12,True);number(e['lengthM'],1,100000);number(e['speedKmh'],1,150)
        number(e['capacityVphLane'],1,3000);number(e['storagePerLane'],1,20000,True)
        modes=e.get('modes',['car','bus','truck'])
        if not isinstance(modes,list) or not modes or any(m not in MODES for m in modes):raise ValueError('Modos inválidos')
        for nxt in e.get('allowedNext',[]):
            if nxt not in edges or edges[nxt]['from']!=e['to']:raise ValueError('Conversão desconectada')
    for o in doc['od']:
        if o['from'] not in nodes or o['to'] not in nodes or o['from']==o['to'] or o['mode'] not in MODES:raise ValueError('OD inválida')
        if sumo_export and o['mode']=='pedestrian':raise ValueError('Exportação SUMO de pedestres ainda indisponível; use a rede pedestre no modelo mesoscópico')
        if 'viaEdges' in o:
            via=o['viaEdges']
            if not isinstance(via,list) or not via or len(via)>1000 or any(not isinstance(k,str) or k not in edges for k in via) or len(set(via))!=len(via):raise ValueError('Passagem obrigatória inválida')
            number(o.get('viaBegin',0),0,14399);number(o.get('viaEnd',doc['settings']['durationSeconds']),1,14400)
            if o.get('viaEnd',doc['settings']['durationSeconds'])<=o.get('viaBegin',0):raise ValueError('Período de passagem invertido')
            if sumo_export:raise ValueError('Passagem obrigatória viaEdges ainda não é exportada ao SUMO; use o assistente mesoscópico')
        number(o['rateVph'],0,30000);number(o['begin'],0,14399);number(o['end'],1,14400)
        number(o['occupancy'],1,8 if o['mode']=='car' else 150)
        if o['end']<=o['begin']:raise ValueError('Período OD inválido')
    if len({o['id'] for o in doc['od']})!=len(doc['od']):raise ValueError('OD duplicada')
    for e in doc['events']:
        if e['edge'] not in edges:raise ValueError('Evento sem trecho')
        number(e['closedLanes'],0,edges[e['edge']]['lanes'],True);number(e['begin'],0,14399);number(e['end'],1,14400);number(e['capacityFactor'],0,1)
        if e['end']<=e['begin']:raise ValueError('Período do evento inválido')
    for a in doc['demandAdjustments']:
        if a['od'] not in {o['id'] for o in doc['od']}:raise ValueError('Ajuste OD inválido')
        number(a['percent'],-100,300);number(a['begin'],0,14399);number(a['end'],1,14400)
        if a['end']<=a['begin']:raise ValueError('Período de ajuste inválido')
    for i,a in enumerate(doc['demandAdjustments']):
        for b in doc['demandAdjustments'][:i]:
            if a['od']==b['od'] and a['begin']<b['end'] and b['begin']<a['end']:raise ValueError('Ajustes sobrepostos')
    seen=set();cycles={}
    for s in doc['signals']:
        if s['edge'] not in edges or s['edge'] in seen:raise ValueError('Semáforo inválido ou duplicado')
        seen.add(s['edge']);number(s['cycle'],2,600,True);number(s['greenStart'],0,s['cycle']-1,True);number(s['greenEnd'],1,s['cycle'],True);number(s['offset'],0,600,True)
        if s['greenEnd']<=s['greenStart']:raise ValueError('Verde inválido')
        junction=edges[s['edge']]['to']
        if sumo_export and junction in cycles and cycles[junction]!=s['cycle']:raise ValueError('SUMO requer o mesmo ciclo para entradas do mesmo cruzamento')
        cycles[junction]=s['cycle']
    number(doc['settings']['durationSeconds'],60,14400,True);number(doc['settings']['demandPercent'],-100,300)
    number(doc['settings']['queueThreshold'],0,30000);number(doc['settings']['completionThreshold'],0,1)
    return doc

def save_xml(root,path):ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)

def route(doc,origin,destination,mode,t=0,work=False):
    edges={e['id']:e for e in doc['edges']};outgoing={}
    for e in edges.values():outgoing.setdefault(e['from'],[]).append(e)
    def accessible(e):
        if mode not in e.get('modes',['car','bus','truck']):return False
        active=[x for x in doc['events'] if work and x['edge']==e['id'] and x['begin']<=t<x['end']]
        return max([0]+[x['closedLanes'] for x in active])<e['lanes']
    heap=[];best={}
    for e in outgoing.get(origin,[]):
        if accessible(e):heapq.heappush(heap,(e['lengthM']/e['speedKmh'],e['id'],(e['id'],)))
    while heap:
        cost,key,path=heapq.heappop(heap)
        if cost>=best.get(key,float('inf')):continue
        best[key]=cost;e=edges[key]
        if e['to']==destination:return list(path)
        for nxt in outgoing.get(e['to'],[]):
            if accessible(nxt) and ('allowedNext' not in e or nxt['id'] in e['allowedNext']):heapq.heappush(heap,(cost+nxt['lengthM']/nxt['speedKmh'],nxt['id'],(*path,nxt['id'])))
    return None

def event_intervals(doc):
    cuts=sorted({x[k] for x in doc['events'] for k in ['begin','end']})
    for begin,end in zip(cuts,cuts[1:]):
        active=[x for x in doc['events'] if x['begin']<=begin<x['end']];closures={}
        for e in active:closures[e['edge']]=max(closures.get(e['edge'],0),e['closedLanes'])
        if closures:yield begin,end,closures

def write_case(doc,directory,work):
    directory.mkdir(parents=True)
    nodes=ET.Element('nodes');controlled={next(e['to'] for e in doc['edges'] if e['id']==s['edge']) for s in doc['signals']}
    for n in doc['nodes']:ET.SubElement(nodes,'node',id=n['id'],x=str(n['lon']),y=str(n['lat']),type='traffic_light' if n['id'] in controlled else 'priority')
    save_xml(nodes,directory/'nodes.nod.xml');edges=ET.Element('edges');connections=ET.Element('connections')
    for e in doc['edges']:
        ET.SubElement(edges,'edge',{'id':e['id'],'from':e['from'],'to':e['to'],'numLanes':str(e['lanes']),'speed':str(e['speedKmh']/3.6),'length':str(e['lengthM']),'allow':' '.join(MODES[m] for m in e.get('modes',['car','bus','truck']))})
        for nxt in doc['edges']:
            if nxt['from']==e['to'] and ('allowedNext' not in e or nxt['id'] in e['allowedNext']):
                # Proportional lane assignment is explicit, but must be reviewed in netedit.
                for lane in range(e['lanes']):ET.SubElement(connections,'connection',{'from':e['id'],'to':nxt['id'],'fromLane':str(lane),'toLane':str(min(nxt['lanes']-1,lane*nxt['lanes']//e['lanes']))})
    save_xml(edges,directory/'edges.edg.xml');save_xml(connections,directory/'connections.con.xml')
    routes=ET.Element('routes')
    for key,cls in MODES.items():
        if key!='pedestrian':ET.SubElement(routes,'vType',id=key,vClass=cls,length='5' if key=='car' else '12',minGap='2.5',accel='2.0',decel='4.5',sigma='0.5')
    departures=[];offered=0;unrouted=0
    for o in doc['od']:
        carry=0
        for t in range(math.ceil(o['begin']),min(math.ceil(o['end']),doc['settings']['durationSeconds'])):
            adjustment=next((a['percent'] for a in doc['demandAdjustments'] if a['od']==o['id'] and a['begin']<=t<a['end']),0)
            carry+=o['rateVph']/3600*(1+(doc['settings']['demandPercent'] if work else 0)/100)*(1+adjustment/100)
            n=math.floor(carry+1e-9);carry-=n
            if n:
                path=route(doc,o['from'],o['to'],o['mode'],t,work)
                for _ in range(n):
                    offered+=1
                    if offered>30000:raise ValueError('Mais de 30000 viagens')
                    if path is None:unrouted+=1
                    else:departures.append((t,offered,o['mode'],path))
    for t,key,mode,path in sorted(departures):
        v=ET.SubElement(routes,'vehicle',id=f'v{key}',type=mode,depart=str(t),departLane='best');ET.SubElement(v,'route',edges=' '.join(path))
    save_xml(routes,directory/'routes.rou.xml')
    additional=ET.Element('additional')
    if work and doc['events']:
        rerouter=ET.SubElement(additional,'rerouter',id='events',edges=' '.join(e['id'] for e in doc['edges']))
        edge_map={e['id']:e for e in doc['edges']}
        for begin,end,closures in event_intervals(doc):
            interval=ET.SubElement(rerouter,'interval',begin=str(begin),end=str(end))
            for key,n in closures.items():
                if n>=edge_map[key]['lanes']:ET.SubElement(interval,'closingReroute',id=key,disallow='all')
                else:
                    for lane in range(n):ET.SubElement(interval,'closingLaneReroute',id=f'{key}_{lane}',disallow='all')
    save_xml(additional,directory/'events.add.xml')
    config=ET.Element('configuration');inp=ET.SubElement(config,'input');ET.SubElement(inp,'net-file',value='network.net.xml');ET.SubElement(inp,'route-files',value='routes.rou.xml');ET.SubElement(inp,'additional-files',value='events.add.xml');timing=ET.SubElement(config,'time');ET.SubElement(timing,'end',value=str(doc['settings']['durationSeconds']));save_xml(config,directory/'run.sumocfg')
    return {'offered':offered,'unroutedAtDeparture':unrouted,'insertable':len(departures)}

def apply_signals(doc,network):
    tree=ET.parse(network);root=tree.getroot();signals={s['edge']:s for s in doc['signals']};groups={}
    for c in root.findall('connection'):
        if 'tl' in c.attrib:groups.setdefault(c.attrib['tl'],[]).append(c)
    for tls,connections in groups.items():
        relevant=[signals[c.attrib['from']] for c in connections if c.attrib['from'] in signals]
        if not relevant:continue
        cycle=relevant[0]['cycle'];n=max(int(c.attrib['linkIndex']) for c in connections)+1
        for old in list(root.findall('tlLogic')):
            if old.attrib['id']==tls:root.remove(old)
        logic=ET.Element('tlLogic',id=tls,type='static',programID='roadworks-manual',offset='0')
        # SUMO reads network elements sequentially: define TLS before junctions/connections.
        position=next((i for i,child in enumerate(root) if child.tag in ('junction','connection')),len(root));root.insert(position,logic);states=[]
        for t in range(cycle):
            chars=['r']*n
            for c in connections:
                s=signals.get(c.attrib['from']);green=s is None or s['greenStart']<=(t+s['offset'])%cycle<s['greenEnd'];chars[int(c.attrib['linkIndex'])]='g' if green else 'r'
            state=''.join(chars)
            if states and states[-1][1]==state:states[-1]=(states[-1][0]+1,state)
            else:states.append((1,state))
        for duration,state in states:ET.SubElement(logic,'phase',duration=str(duration),state=state)
    tree.write(network,encoding='utf-8',xml_declaration=True)

def execute(command,directory,timeout=300):
    result=subprocess.run(command,cwd=directory,capture_output=True,text=True,timeout=timeout)
    if result.returncode:raise RuntimeError(result.stderr[-3000:])
    return result

def run_case(doc,directory,counts,binaries):
    execute([binaries['netconvert'],'--node-files','nodes.nod.xml','--edge-files','edges.edg.xml','--connection-files','connections.con.xml','--proj.utm','true','--output-file','network.net.xml','--no-turnarounds','true'],directory,120)
    apply_signals(doc,directory/'network.net.xml')
    execute([binaries['sumo'],'-c','run.sumocfg','--seed','42','--tripinfo-output','tripinfo.xml','--summary-output','summary.xml','--no-step-log','true','--time-to-teleport','-1','--device.rerouting.mode','8'],directory)
    trips=ET.parse(directory/'tripinfo.xml').getroot().findall('tripinfo');steps=ET.parse(directory/'summary.xml').getroot().findall('step')
    arrived=len(trips)
    return {**counts,'arrived':arrived,'pendingIncludingUnrouted':counts['offered']-arrived,'meanDurationSeconds':statistics.mean(float(t.attrib['duration']) for t in trips) if trips else None,'meanWaitingSeconds':statistics.mean(float(t.attrib['waitingTime']) for t in trips) if trips else None,'maxHaltingVehicles':max((int(s.attrib.get('halting',0)) for s in steps),default=0)}

def prepare(doc,output,run=False):
    doc=validate(doc);output=Path(output).resolve()
    if output.exists() and any(output.iterdir()):raise ValueError('Use uma pasta de saída vazia para preservar execuções anteriores')
    binaries={}
    if run:
        for name in ['netconvert','sumo']:
            binaries[name]=shutil.which(name)
            if not binaries[name]:raise RuntimeError(name+' não encontrado no PATH; use --prepare-only ou instale Eclipse SUMO')
    output.mkdir(parents=True,exist_ok=True)
    warnings=['Rede georreferenciada com faixas e conexões derivadas; revisar no netedit. Não calibrada.','Semáforos manuais permissivos, sem fases de amarelo ou verificação de conflitos.','Capacidade por faixa e armazenamento do modelo mesoscópico não são parâmetros equivalentes do SUMO.']
    if any(e['capacityFactor']!=1 for e in doc['events']):warnings.append('capacityFactor não é aplicado no SUMO; somente fechamento de faixas. Resultados não equivalem ao cenário mesoscópico.')
    report={'schema':'roadworks-urban-sumo-result/1.7','executed':run,'calibrated':False,'reviewRequired':True,'inputSHA256':hashlib.sha256(json.dumps(doc,sort_keys=True).encode()).hexdigest(),'warnings':warnings}
    (output/'input.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2),encoding='utf-8')
    for key,work in [('baseline',False),('alternative',True)]:
        directory=output/key;counts=write_case(doc,directory,work);report[key]=run_case(doc,directory,counts,binaries) if run else counts
    if run:
        net=ET.parse(output/'baseline'/'network.net.xml').getroot();actual={e.attrib['id']:[l.attrib['id'] for l in e.findall('lane')] for e in net.findall('edge') if e.attrib.get('function')!='internal'}
        mapping=[{'urbanEdge':e['id'],'osmWay':e.get('osmWay'),'sumoEdge':e['id'] if e['id'] in actual else None,'sumoLanes':actual.get(e['id'],[])} for e in doc['edges']]
        (output/'edge_mapping.json').write_text(json.dumps(mapping,indent=2),encoding='utf-8')
    (output/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('study',type=Path);parser.add_argument('--output',type=Path,required=True);group=parser.add_mutually_exclusive_group(required=True);group.add_argument('--run',action='store_true');group.add_argument('--prepare-only',action='store_true');args=parser.parse_args()
    if args.study.stat().st_size>3_000_000:parser.error('Entrada acima de 3 MB')
    try:
        report=prepare(json.loads(args.study.read_text(encoding='utf-8-sig')),args.output,args.run);print(json.dumps(report,ensure_ascii=True,indent=2))
    except (ValueError,KeyError,TypeError,RuntimeError,subprocess.TimeoutExpired) as e:parser.exit(1,str(e)+'\n')

if __name__=='__main__':main()
