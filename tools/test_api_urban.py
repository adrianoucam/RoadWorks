"""Optional integration checks; install requirements-dev.txt to run these."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
AVAILABLE=bool(importlib.util.find_spec('fastapi') and importlib.util.find_spec('httpx'))

@unittest.skipUnless(AVAILABLE,'FastAPI/httpx não instalados neste Python')
class UrbanAPI(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from tools import api
        self.api=api;self.old=api.DB_PATH;self.temp=tempfile.TemporaryDirectory();api.DB_PATH=Path(self.temp.name)/'test.db'
        self.client=TestClient(api.app);self.client.__enter__()
        study=json.loads((Path(__file__).resolve().parents[1]/'samples'/'estudo_urbano_FICTICIO.json').read_text(encoding='utf-8'))
        self.doc={'schema':'roadworks-swept-path/1.6','name':'API urban test','points':[],'urbanV17':{'document':study,'runs':[],'lastIndex':-1}}
    def tearDown(self):
        self.client.__exit__(None,None,None);self.api.DB_PATH=self.old;self.temp.cleanup()
    def test_project_revision_run_and_restore(self):
        r=self.client.post('/api/projects',json={'document':self.doc});self.assertEqual(r.status_code,200,r.text);pid=r.json()['id']
        self.assertEqual(self.client.get('/api/projects/'+pid).json()['document'],self.doc)
        self.doc['urbanV17']['document']['settings']['demandPercent']=25
        r=self.client.put('/api/projects/'+pid,json={'document':self.doc});self.assertEqual(r.json()['revision'],2)
        old=self.client.get('/api/projects/'+pid+'?revision=1').json()['document'];self.assertEqual(old['urbanV17']['document']['settings']['demandPercent'],0)
        r=self.client.post('/api/projects/'+pid+'/runs',json={'kind':'urban_traffic','summary':{'completed':12},'provenance':'synthetic'});self.assertEqual(r.status_code,200)
        self.assertEqual(self.client.get('/api/projects/'+pid+'/runs').json()['runs'][0]['summary']['completed'],12)
    def test_invalid_network_rejected_by_server(self):
        self.doc['urbanV17']['document']['edges'][0]['to']='missing'
        self.assertEqual(self.client.post('/api/projects',json={'document':self.doc}).status_code,422)

    def test_required_street_persists_and_invalid_references_are_rejected(self):
        od=self.doc['urbanV17']['document']['od'][0]
        edge=self.doc['urbanV17']['document']['edges'][0]['id']
        od.update(viaEdges=[edge],viaBegin=0,viaEnd=100)
        self.doc['detourAssistantV21']={'schema':'roadworks-detour-assistant/2.1','config':None,
            'base':self.doc['urbanV17']['document'],'draft':{'dVia':'Revisar contorno'},'location':None}
        saved=self.client.post('/api/projects',json={'document':self.doc})
        self.assertEqual(saved.status_code,200,saved.text)
        reopened=self.client.get('/api/projects/'+saved.json()['id']).json()['document']
        self.assertEqual(reopened['urbanV17']['document']['od'][0]['viaEdges'],[edge])
        self.assertEqual(reopened['detourAssistantV21'],self.doc['detourAssistantV21'])
        od['viaEdges']=['missing']
        self.assertEqual(self.client.post('/api/projects',json={'document':self.doc}).status_code,422)

    def test_required_street_not_silently_dropped_by_sumo(self):
        from tools.urban_sumo import validate
        study=self.doc['urbanV17']['document']
        study['od'][0]['viaEdges']=[study['edges'][0]['id']]
        self.assertIs(validate(study,sumo_export=False),study)
        with self.assertRaisesRegex(ValueError,'viaEdges'):
            validate(study,sumo_export=True)
    def test_static_root_cannot_serve_database(self):
        self.assertEqual(self.client.get('/api/health').status_code,200)
        self.assertEqual(self.client.get('/%2e%2e/roadworks_data/roadworks.db').status_code,404)

    def test_flattened_frontend_and_private_paths(self):
        page=self.client.get('/')
        self.assertEqual(page.status_code,200)
        self.assertIn('src/app.mjs',page.text)
        self.assertEqual(self.client.get('/src/study-worker.mjs').status_code,200)
        for path in ['/roadworks_data/roadworks.db','/.codex-attachments/example.pdf',
                     '/roadworks_swept_path/.venv/pyvenv.cfg','/roadworks_qa/qa_v20.db','/.git/config','/ROADWORKS_DATA/ROADWORKS.DB']:
            self.assertEqual(self.client.get(path).status_code,404,path)

    def test_study_workspace_survives_sqlite_roundtrip(self):
        self.doc['studyWorkbenchV20']={'schema':'roadworks-study-workspace/2.0','name':'QA',
            'base':self.doc['urbanV17']['document'],'cases':[{'id':'ref','name':'Referência',
            'demandPercent':0,'capacityScale':1,'eventMode':'none'}],
            'options':{'arrivalMode':'poisson','stepSeconds':.5,'seed':42,'replicates':2,'probeIds':[]},
            'criteria':{'minCompletionPercent':95,'maxQueue':100,'maxTravelP95Seconds':600,'maxOutsidePercent':10}}
        response=self.client.post('/api/projects',json={'document':self.doc})
        self.assertEqual(response.status_code,200,response.text)
        saved=self.client.get('/api/projects/'+response.json()['id']).json()['document']
        self.assertEqual(saved['studyWorkbenchV20'],self.doc['studyWorkbenchV20'])

if __name__=='__main__':unittest.main()
