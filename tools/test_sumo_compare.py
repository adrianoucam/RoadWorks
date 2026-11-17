import importlib.util
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('sumo_compare',HERE/'sumo_compare.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
CFG={'lengthM':1000,'baseLanes':2,'freeSpeedKmh':60,'detourLengthFactor':1.5,'detourLanes':1,'detourFraction':0.35,'demandVph':360,'minutes':10,'impact':'one_lane'}
class SumoInputTests(unittest.TestCase):
 def test_network_xml_edges_use_correct_from_attribute(self):
  with tempfile.TemporaryDirectory() as td:
   d=Path(td)
   fake=lambda *a,**kw:type('P',(),{'returncode':0,'stderr':''})()
   with patch.object(m.subprocess,'run',side_effect=fake): m.generate_network(d,CFG,True,'netconvert')
   edges=ET.parse(d/'edges.edg.xml').getroot()
   self.assertEqual(edges.find("edge[@id='m1']").get('from'),'B')
   self.assertEqual(edges.find("edge[@id='m1']").get('numLanes'),'1')
   self.assertEqual(edges.find("edge[@id='d1']").get('to'),'F')
 def test_routes_vehicle_counts_and_paths(self):
  with tempfile.TemporaryDirectory() as td:
   d=Path(td)
   self.assertEqual(m.make_routes(d,CFG,True),60)
   root=ET.parse(d/'demand.rou.xml').getroot()
   self.assertEqual(len(root.findall('vehicle')),60)
   self.assertEqual(root.find("route[@id='detour']").get('edges'),'approach d1 d2 exit')
 def test_total_closure_forces_detour(self):
  with tempfile.TemporaryDirectory() as td:
   d=Path(td)
   m.make_routes(d,{**CFG,'impact':'total'},True)
   self.assertTrue(all(x.get('route')=='detour' for x in ET.parse(d/'demand.rou.xml').getroot().findall('vehicle')))
if __name__=='__main__':unittest.main()
