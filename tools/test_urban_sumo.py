import json
import shutil
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch
try:
    from tools.urban_sumo import validate,prepare,route,event_intervals,apply_signals
    from tools.persistence import connect,init,save,read,register_run,runs
except ModuleNotFoundError:
    from urban_sumo import validate,prepare,route,event_intervals,apply_signals
    from persistence import connect,init,save,read,register_run,runs

def sample():return json.loads((Path(__file__).resolve().parents[1]/'samples'/'estudo_urbano_FICTICIO.json').read_text(encoding='utf-8'))

class UrbanTests(unittest.TestCase):
    def test_prepare_only_does_not_claim_executed_or_fabricate_metrics(self):
        with tempfile.TemporaryDirectory() as temp:
            report=prepare(sample(),Path(temp)/'run')
            self.assertFalse(report['executed']);self.assertNotIn('arrived',report['baseline'])
            self.assertEqual(report['baseline']['offered'],810)
            self.assertTrue((Path(temp)/'run'/'baseline'/'connections.con.xml').exists())
            mapping=ET.parse(Path(temp)/'run'/'baseline'/'edges.edg.xml').getroot()
            self.assertEqual(mapping[0].attrib['from'],'A')
    def test_routes_and_temporary_closures(self):
        d=sample();d['events'][0].update(closedLanes=2,capacityFactor=1)
        self.assertEqual(route(d,'A','C','car',0,True),['AB','BC'])
        self.assertEqual(route(d,'A','C','car',400,True),['AB','BD','DC'])
        self.assertEqual(route(d,'A','C','car',1200,True),['AB','BC'])
        self.assertIsNone(route(d,'C','A','car'))
    def test_turn_restriction_applied_to_routes_and_xml(self):
        d=sample();d['edges'][0]['allowedNext']=['BD']
        self.assertEqual(route(d,'A','C','car'),['AB','BD','DC'])
        with tempfile.TemporaryDirectory() as temp:
            prepare(d,Path(temp)/'run')
            connections=ET.parse(Path(temp)/'run'/'baseline'/'connections.con.xml').getroot()
            self.assertFalse(any(x.attrib['from']=='AB' and x.attrib['to']=='BC' for x in connections))
    def test_overlapping_events_use_single_interval_and_max_closure(self):
        d=sample();a=d['events'][0];d['events'].append({**a,'id':'other','begin':600,'end':1500})
        intervals=list(event_intervals(d));self.assertEqual(len(intervals),3)
        self.assertEqual(intervals[1],(600,1200,{'BC':1}))
    def test_invalid_endpoints_and_adjustments_rejected(self):
        d=sample();d['edges'][0]['to']='unknown'
        with self.assertRaises(ValueError):validate(d)
        d=sample();d['demandAdjustments']=[{'od':'autos','begin':0,'end':10,'percent':20},{'od':'autos','begin':5,'end':15,'percent':30}]
        with self.assertRaises(ValueError):validate(d)
    def test_signal_phases_follow_incoming_edge_and_offset(self):
        d=sample();d['signals']=[{'edge':'AB','cycle':10,'greenStart':0,'greenEnd':5,'offset':0}]
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'net.xml';p.write_text('<net><tlLogic id="B"/><connection from="AB" to="BC" tl="B" linkIndex="0"/><connection from="AB" to="BD" tl="B" linkIndex="1"/></net>',encoding='utf-8')
            apply_signals(d,p);phases=ET.parse(p).getroot().findall('tlLogic/phase')
            self.assertEqual([(p.attrib['duration'],p.attrib['state']) for p in phases],[('5','gg'),('5','rr')])
    def test_no_overwrite_and_missing_binary_not_reported_as_run(self):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'run';prepare(sample(),p)
            with self.assertRaises(ValueError):prepare(sample(),p)
            with patch('shutil.which',return_value=None):
                with self.assertRaisesRegex(RuntimeError,'netconvert'):prepare(sample(),Path(temp)/'missing',True)
            self.assertFalse((Path(temp)/'missing').exists())
    def test_urban_only_snapshot_and_analysis_roundtrip(self):
        with tempfile.TemporaryDirectory() as temp:
            db=connect(Path(temp)/'test.db');init(db)
            try:
                doc={'schema':'roadworks-swept-path/1.6','points':[],'name':'Urban study','urbanV17':{'document':sample(),'runs':[],'lastIndex':-1}}
                record=save(db,doc);restored=read(db,record['id'])['document']
                self.assertEqual(restored,doc)
                register_run(db,record['id'],'urban_traffic',{'completed':10},'synthetic')
                self.assertEqual(runs(db,record['id'])[0]['summary']['completed'],10)
                doc['urbanV17']['document']['edges']=[]
                with self.assertRaises(ValueError):save(db,doc)
            finally:db.close()

@unittest.skipUnless(shutil.which('sumo') and shutil.which('netconvert'),'Binários SUMO não encontrados no PATH')
class UrbanSUMOIntegration(unittest.TestCase):
    def test_real_execution_with_manual_signals_and_total_closure(self):
        d=sample();d['events'][0].update(closedLanes=2,capacityFactor=1);d['signals']=[{'edge':'AB','cycle':60,'greenStart':0,'greenEnd':30,'offset':5}]
        with tempfile.TemporaryDirectory() as temp:
            report=prepare(d,Path(temp)/'run',True)
            self.assertTrue(report['executed']);self.assertGreater(report['baseline']['arrived'],0)
            for key in ['baseline','alternative']:
                x=report[key];self.assertEqual(x['offered'],x['arrived']+x['pendingIncludingUnrouted'])
            mapping=json.loads((Path(temp)/'run'/'edge_mapping.json').read_text(encoding='utf-8'))
            self.assertEqual(len(mapping),4);self.assertTrue(all(e['sumoLanes'] for e in mapping))
    def test_niteroi_geographic_network_with_explicit_synthetic_test_demand(self):
        d=json.loads((Path(__file__).resolve().parents[1]/'samples'/'niteroi_rede_OSM_sem_demanda.json').read_text(encoding='utf-8'));e=d['edges'][0]
        d['settings']['durationSeconds']=300;d['source']='mixed';d['od']=[{'id':'TEST_SYNTHETIC','from':e['from'],'to':e['to'],'mode':'car','rateVph':120,'begin':0,'end':60,'occupancy':1.4}]
        with tempfile.TemporaryDirectory() as temp:
            report=prepare(d,Path(temp)/'run',True)
            self.assertEqual(report['baseline']['offered'],2);self.assertEqual(report['baseline']['arrived'],2)
            mapping=json.loads((Path(temp)/'run'/'edge_mapping.json').read_text(encoding='utf-8'))
            self.assertEqual(len(mapping),170);self.assertTrue(all(e['sumoEdge'] for e in mapping))

if __name__=='__main__':unittest.main()
