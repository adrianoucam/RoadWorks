import tempfile, unittest
from pathlib import Path
try:
 from tools.persistence import connect,init,save,read,projects,revisions,register_asset,assets,register_run,runs
except ModuleNotFoundError:
 from persistence import connect,init,save,read,projects,revisions,register_asset,assets,register_run,runs

class DatabaseTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=connect(Path(self.tmp.name)/'roadworks.db');init(self.db)
  self.doc={'schema':'roadworks-swept-path/1.5','name':'Estrada A','points':[{'lat':-22.9,'lng':-43.1},{'lat':-22.91,'lng':-43.11}],'construction4D':{'stages':[]}}
 def tearDown(self):
  self.db.close();self.tmp.cleanup()
 def test_versioning_deduplication_and_restore(self):
  a=save(self.db,self.doc);self.assertEqual(a['revision'],1)
  b=save(self.db,self.doc,a['id'],'autosave');self.assertFalse(b['changed']);self.assertEqual(b['revision'],1)
  self.doc['name']='Estrada B';c=save(self.db,self.doc,a['id']);self.assertEqual(c['revision'],2)
  self.assertEqual(read(self.db,a['id'],1)['document']['name'],'Estrada A')
  self.assertEqual(read(self.db,a['id'])['document']['name'],'Estrada B')
  self.assertEqual(len(revisions(self.db,a['id'])),2)
  self.assertEqual(len(projects(self.db)),1)
 def test_invalid_doc_rejected(self):
  self.doc['points']=[{'lat':100,'lng':0},{'lat':2,'lng':2}]
  with self.assertRaises(ValueError):save(self.db,self.doc)
 def test_project_must_exist(self):
  with self.assertRaises(KeyError):read(self.db,'missing')
 def test_assets_and_runs(self):
  id=save(self.db,self.doc)['id']
  register_asset(self.db,id,{'kind':'geotiff','path':'C:/terrain/dem.tif','sha256':'a'*64,'crs':'EPSG:31983'})
  register_run(self.db,id,'sumo',{'arrived':20},'synthetic')
  self.assertEqual(len(assets(self.db,id)),1)
  self.assertEqual(runs(self.db,id)[0]['summary']['arrived'],20)
 def test_durable_reopen(self):
  id=save(self.db,self.doc)['id'];self.db.close();self.db=connect(Path(self.tmp.name)/'roadworks.db');init(self.db)
  self.assertEqual(read(self.db,id)['document']['name'],'Estrada A')

if __name__=='__main__':unittest.main()
