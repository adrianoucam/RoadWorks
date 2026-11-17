"""Run from project root: python -m uvicorn tools.api:app --host 127.0.0.1 --port 8000"""
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .launch import installation_id
from .persistence import connect, init, save, read, projects, revisions, assets, register_asset, runs, register_run

ROOT=Path(__file__).resolve().parents[1]
DB_PATH=Path(os.environ.get('ROADWORKS_DB',str(ROOT.parent/'roadworks_data'/'roadworks.db')))
if 'ROADWORKS_DB' not in os.environ and (ROOT/'roadworks_swept_path'/'index.html').exists():
    DB_PATH=ROOT/'roadworks_data'/'roadworks.db'

@asynccontextmanager
async def lifespan(app):
    db=connect(DB_PATH); init(db); db.close()
    yield

app=FastAPI(title='RoadWorks v2.2 local API',version='2.2',lifespan=lifespan)
# Do not enable wildcard CORS; same-origin web app is served by this process.

def use_db(action,*args,**kwargs):
    db=connect(DB_PATH)
    try:return action(db,*args,**kwargs)
    except KeyError as exc:raise HTTPException(404,str(exc))
    except (ValueError,TypeError) as exc:raise HTTPException(422,str(exc))
    finally:db.close()

@app.get('/api/health')
def health():return {'ok':True,'database':'sqlite','version':'2.2','application':'roadworks','installationId':installation_id()}

@app.get('/api/projects')
def list_projects():return {'projects':use_db(projects)}

@app.post('/api/projects')
def new_project(payload:dict=Body(...)):
    doc=payload.get('document'); reason=payload.get('reason','manual')
    return use_db(save,doc,None,reason)

@app.put('/api/projects/{project_id}')
def update_project(project_id:str,payload:dict=Body(...)):
    return use_db(save,payload.get('document'),project_id,payload.get('reason','manual'))

@app.get('/api/projects/{project_id}')
def get_project(project_id:str,revision:int|None=Query(None,ge=1)):
    return use_db(read,project_id,revision)

@app.get('/api/projects/{project_id}/revisions')
def project_versions(project_id:str):return {'revisions':use_db(revisions,project_id)}

@app.get('/api/projects/{project_id}/assets')
def project_assets(project_id:str):return {'assets':use_db(assets,project_id)}

@app.post('/api/projects/{project_id}/assets')
def create_asset(project_id:str,payload:dict=Body(...)):
    return use_db(register_asset,project_id,payload)

@app.get('/api/projects/{project_id}/runs')
def project_runs(project_id:str):return {'runs':use_db(runs,project_id)}

@app.post('/api/projects/{project_id}/runs')
def create_run(project_id:str,payload:dict=Body(...)):
    return use_db(register_run,project_id,payload.get('kind'),payload.get('summary'),payload.get('provenance',''))

# The flattened workspace contains private data next to public assets.
class PublicFiles(StaticFiles):
    async def get_response(self,path,scope):
        normalized=path.casefold()
        parts=Path(normalized).parts
        if any(p.startswith('.') or p in ('roadworks_data','roadworks_qa','roadworks_swept_path') for p in parts) or normalized.endswith(('.db','.db-wal','.db-shm','.sqlite','.sqlite3')):
            raise HTTPException(404,'Not found')
        return await super().get_response(path,scope)

app.mount('/',PublicFiles(directory=str(ROOT),html=True),name='frontend')
