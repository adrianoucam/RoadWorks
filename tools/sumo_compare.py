#!/usr/bin/env python3
"""RoadWorks v1.4: actual microscopic SUMO simulation of a SYNTHETIC two-route corridor.
Requires SUMO 'netconvert' and 'sumo' on PATH. No fabricated simulation metrics.
Run: python tools/sumo_compare.py scenario.json --output result.json
"""
import argparse
import json
import math
import shutil
import statistics
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


def require_binary(name):
    path = shutil.which(name)
    if path is None:
        raise RuntimeError(f"{name} não encontrado no PATH. Instale SUMO e inclua seu diretório bin no PATH.")
    return path


def xml_save(root, path):
    ET.ElementTree(root).write(path, encoding="unicode", xml_declaration=True)


def generate_network(directory, conf, work, netconvert):
    distance = float(conf['lengthM'])
    split = max(80, distance * .2)
    middle = max(100, distance * .6)
    leg = max(80, distance * .2)
    extra = (float(conf['detourLengthFactor']) - 1) * middle
    # Detour is a real alternative branch; stretch path by 2*sqrt((middle/2)^2+h^2)
    h = math.sqrt(max(0, ((middle + extra) / 2) ** 2 - (middle / 2) ** 2))
    nodes = ET.Element('nodes')
    for key, x, y in [('A',0,0),('B',split,0),('C',split+middle/2,0),('D',split+middle,0),('E',split+middle+leg,0),('F',split+middle/2,max(h,30))]:
        ET.SubElement(nodes, 'node', id=key, x=f'{x:.3f}',y=f'{y:.3f}',type='priority')
    xml_save(nodes,directory/'nodes.nod.xml')
    edges = ET.Element('edges')
    main_lanes=int(conf['baseLanes'])-int(work and conf['impact']=='one_lane')
    main_lanes=0 if work and conf['impact']=='total' else main_lanes
    main_lanes=max(1,main_lanes) # omit closed edges through assigning no traffic; departure routing is forced to detour
    alternate_lanes=int(conf['detourLanes'])
    for key, start, end, lanes, speed in [('approach','A','B',int(conf['baseLanes']),float(conf['freeSpeedKmh'])),('m1','B','C',main_lanes,float(conf['freeSpeedKmh'])),('m2','C','D',main_lanes,float(conf['freeSpeedKmh'])),('d1','B','F',alternate_lanes,float(conf['freeSpeedKmh'])*.8),('d2','F','D',alternate_lanes,float(conf['freeSpeedKmh'])*.8),('exit','D','E',int(conf['baseLanes']),float(conf['freeSpeedKmh']))]:
        ET.SubElement(edges,'edge',{'id':key,'from':start,'to':end,'numLanes':str(lanes),'speed':f'{speed/3.6:.3f}'})
    xml_save(edges,directory/'edges.edg.xml')
    process = subprocess.run([netconvert,'--node-files',str(directory/'nodes.nod.xml'),'--edge-files',str(directory/'edges.edg.xml'),'--output-file',str(directory/'network.net.xml'),'--no-turnarounds','true'],capture_output=True,text=True,timeout=120)
    if process.returncode:
        raise RuntimeError('Falha netconvert: '+process.stderr[-1400:])


def make_routes(directory, conf, work):
    root=ET.Element('routes')
    ET.SubElement(root,'vType',id='car',accel='2.0',decel='4.5',sigma='0.5',length='5',minGap='2.5',maxSpeed=f"{float(conf['freeSpeedKmh'])/3.6:.3f}")
    ET.SubElement(root,'route',id='main',edges='approach m1 m2 exit')
    ET.SubElement(root,'route',id='detour',edges='approach d1 d2 exit')
    frac=0 if not work else 1 if conf['impact']=='total' or (conf['impact']=='one_lane' and int(conf['baseLanes'])==1) else float(conf['detourFraction'])
    total_s=float(conf['minutes'])*60
    demand=float(conf['demandVph'])/3600
    # deterministic regular departures; fixed pseudo-random map of vehicles to detour; same demand in both scenarios
    num=int(total_s*demand)
    for i in range(num):
        depart=(i+.5)/demand if demand else 0
        # reproducible proportional assignment without random and without inventing a traffic pattern
        route='detour' if ((i*0.61803398875)%1)<frac else 'main'
        ET.SubElement(root,'vehicle',id=f'v{i:06}',type='car',route=route,depart=f'{depart:.3f}',departLane='best',departSpeed='max')
    xml_save(root,directory/'demand.rou.xml')
    return num


def run_case(directory, conf, work, sumo_bin, netconvert):
    directory.mkdir(parents=True, exist_ok=True)
    generate_network(directory,conf,work,netconvert)
    offered=make_routes(directory,conf,work)
    # Extend the time beyond demand horizon to discharge tail queues; cap to avoid indefinite runs.
    horizon=min(int(conf['minutes'])*60+3600, 25200)
    command=[sumo_bin,'--net-file',str(directory/'network.net.xml'),'--route-files',str(directory/'demand.rou.xml'),'--tripinfo-output',str(directory/'tripinfo.xml'),'--summary-output',str(directory/'summary.xml'),'--begin','0','--end',str(horizon),'--step-length','1','--no-step-log','true','--time-to-teleport','-1','--seed','42']
    proc=subprocess.run(command,capture_output=True,text=True,timeout=300)
    if proc.returncode:
        raise RuntimeError('Falha SUMO: '+proc.stderr[-2000:])
    trips=ET.parse(directory/'tripinfo.xml').getroot().findall('tripinfo')
    durations=[float(t.attrib['duration']) for t in trips]
    waits=[float(t.attrib['waitingTime']) for t in trips]
    summary=ET.parse(directory/'summary.xml').getroot().findall('step')
    series=[{'minute':round(float(s.attrib.get('time',0))/60,2),'halting':int(s.attrib.get('halting',0)),'running':int(s.attrib.get('running',0)),'ended':int(s.attrib.get('ended',0))} for i,s in enumerate(summary) if i%60==0 or i==len(summary)-1]
    # The SUMO 'halting' summary is global stopping vehicles; not equal to queue length on a specific edge.
    return {'arrived':len(trips),'offered':offered,'notArrived':offered-len(trips),'meanDurationSeconds':statistics.fmean(durations) if durations else 0,'meanWaitingSeconds':statistics.fmean(waits) if waits else 0,'maxHaltingVehicles':max((int(s.attrib.get('halting',0)) for s in summary),default=0),'series':series,'simulationSeconds':float(summary[-1].attrib['time']) if summary else 0}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('scenario',type=Path)
    ap.add_argument('--output',type=Path,default=Path('roadworks_sumo_result.json'))
    args=ap.parse_args()
    data=json.loads(args.scenario.read_text(encoding='utf-8'))
    if data.get('schema')!='roadworks-traffic-sumo/1.4':
        ap.error('Cenário inválido, esperado roadworks-traffic-sumo/1.4')
    c=data['scenario']
    for key in ('lengthM','demandVph','baseLanes','detourLanes','freeSpeedKmh','minutes','detourFraction','detourLengthFactor','impact'):
        if key not in c: ap.error('Campo ausente: '+key)
    if c['impact'] not in ('none','shoulder','one_lane','total'): ap.error('Interdição inválida')
    sumo= require_binary('sumo');netconvert=require_binary('netconvert')
    with tempfile.TemporaryDirectory(prefix='roadworks_sumo_') as folder:
        d=Path(folder)
        baseline=run_case(d/'baseline',c,False,sumo,netconvert)
        work=run_case(d/'work',c,True,sumo,netconvert)
    result={'schema':'roadworks-traffic-sumo-result/1.4','engine':'Eclipse SUMO','model':'synthetic_parallel_routes','input':c,'baseline':baseline,'work':work,'limitations':'Rede abstrata com rota principal e desvio sintético. Não usa geometria real de OSM, semáforos calibrados, matriz OD, contagens reais ou comportamento aferido.'}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print('Salvo:',args.output.resolve())
    print('Chegaram (base/obra):',baseline['arrived'],work['arrived'])
    print('Espera média s (base/obra):',round(baseline['meanWaitingSeconds'],1),round(work['meanWaitingSeconds'],1))

if __name__=='__main__':
    try:main()
    except (RuntimeError,ValueError,KeyError) as exc:
        raise SystemExit('Erro: '+str(exc))
