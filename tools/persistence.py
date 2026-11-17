"""SQLite persistence for RoadWorks v1.5; no external dependency in this module."""
from __future__ import annotations
import hashlib, json, sqlite3, uuid
from datetime import datetime, timezone
from pathlib import Path

MAX_SNAPSHOT_BYTES = 8_000_000

def utcnow(): return datetime.now(timezone.utc).isoformat(timespec='seconds')

def connect(path):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(str(path),timeout=15,check_same_thread=False)
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA busy_timeout=10000')
    return db

def init(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS projects(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, latest_revision INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS revisions(
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL, created_at TEXT NOT NULL, sha256 TEXT NOT NULL,
      reason TEXT NOT NULL, snapshot TEXT NOT NULL,
      PRIMARY KEY(project_id,revision)
    );
    CREATE INDEX IF NOT EXISTS ix_projects_updated ON projects(updated_at DESC);
    CREATE TABLE IF NOT EXISTS assets(
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL,
      size_bytes INTEGER, crs TEXT, description TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs(
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, created_at TEXT NOT NULL, summary_json TEXT NOT NULL,
      provenance TEXT NOT NULL
    );
    ''')
    db.commit()

def validate_snapshot(doc):
    if not isinstance(doc,dict): raise ValueError('Snapshot deve ser objeto JSON')
    schema=doc.get('schema','')
    if not isinstance(schema,str) or not schema.startswith('roadworks-swept-path/'):
        raise ValueError('Schema RoadWorks inválido')
    points=doc.get('points')
    urban=doc.get('urbanV17',{}).get('document',{}) if isinstance(doc.get('urbanV17',{}),dict) else {}
    if urban:
        try:
            from .urban_sumo import validate as validate_urban
        except ImportError:
            from urban_sumo import validate as validate_urban
        try:validate_urban(urban,sumo_export=False)
        except (KeyError,TypeError,AttributeError) as exc:raise ValueError('Estudo urbano incompleto ou inválido') from exc
    urban_only=urban.get('schema')=='roadworks-urban/1.7' and isinstance(urban.get('edges'),list) and 0<len(urban['edges'])<=4000
    if not isinstance(points,list) or (len(points)<2 and not (len(points)==0 and urban_only)) or len(points)>20000:
        raise ValueError('Traçado deve conter entre 2 e 20000 pontos')
    for p in points:
        if not isinstance(p,dict) or not isinstance(p.get('lat'),(int,float)) or not isinstance(p.get('lng'),(int,float)) or not -90<=p['lat']<=90 or not -180<=p['lng']<=180: raise ValueError('Coordenadas inválidas')
    payload=json.dumps(doc,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
    if len(payload.encode())>MAX_SNAPSHOT_BYTES: raise ValueError('Snapshot acima do limite de 8 MB')
    return payload

def save(db,doc,project_id=None,reason='manual'):
    payload=validate_snapshot(doc)
    reason=str(reason)[:80] or 'manual'
    name=str(doc.get('name') or 'Projeto sem nome').strip()[:180]
    if not name:name='Projeto sem nome'
    now=utcnow(); digest=hashlib.sha256(payload.encode('utf-8')).hexdigest()
    with db:
        if project_id is None:
            project_id=str(uuid.uuid4()); db.execute('INSERT INTO projects(id,name,created_at,updated_at) VALUES(?,?,?,?)',(project_id,name,now,now))
        else:
            if not db.execute('SELECT 1 FROM projects WHERE id=?',(project_id,)).fetchone():raise KeyError('Projeto não encontrado')
        row=db.execute('SELECT latest_revision FROM projects WHERE id=?',(project_id,)).fetchone()
        last=int(row['latest_revision'])
        if last:
            old=db.execute('SELECT sha256 FROM revisions WHERE project_id=? AND revision=?',(project_id,last)).fetchone()
            if old and old['sha256']==digest:
                db.execute('UPDATE projects SET updated_at=?,name=? WHERE id=?',(now,name,project_id))
                return {'id':project_id,'revision':last,'changed':False,'sha256':digest}
        revision=last+1
        db.execute('INSERT INTO revisions(project_id,revision,created_at,sha256,reason,snapshot) VALUES(?,?,?,?,?,?)',(project_id,revision,now,digest,reason,payload))
        db.execute('UPDATE projects SET name=?,updated_at=?,latest_revision=? WHERE id=?',(name,now,revision,project_id))
    return {'id':project_id,'revision':revision,'changed':True,'sha256':digest}

def projects(db):
    return [dict(row) for row in db.execute('SELECT id,name,created_at,updated_at,latest_revision FROM projects ORDER BY updated_at DESC LIMIT 200')]

def revisions(db,project_id):
    if not db.execute('SELECT 1 FROM projects WHERE id=?',(project_id,)).fetchone():raise KeyError('Projeto não encontrado')
    return [dict(r) for r in db.execute('SELECT revision,created_at,sha256,reason FROM revisions WHERE project_id=? ORDER BY revision DESC LIMIT 200',(project_id,))]

def read(db,project_id,revision=None):
    row=db.execute('SELECT latest_revision FROM projects WHERE id=?',(project_id,)).fetchone()
    if not row:raise KeyError('Projeto não encontrado')
    version=revision if revision is not None else row['latest_revision']
    record=db.execute('SELECT revision,created_at,sha256,snapshot FROM revisions WHERE project_id=? AND revision=?',(project_id,version)).fetchone()
    if not record:raise KeyError('Revisão não encontrada')
    return {'id':project_id,'revision':record['revision'],'created_at':record['created_at'],'sha256':record['sha256'],'document':json.loads(record['snapshot'])}

def register_asset(db,project_id,asset):
    if not db.execute('SELECT 1 FROM projects WHERE id=?',(project_id,)).fetchone(): raise KeyError('Projeto não encontrado')
    kind=str(asset.get('kind',''))[:40]; path=str(asset.get('path',''))[:2048]; sha=str(asset.get('sha256','')).lower()
    if kind not in ('geotiff','lidar','mesh','geojson','other') or not path or len(sha)!=64 or any(x not in '0123456789abcdef' for x in sha): raise ValueError('Metadados de ativo inválidos')
    asset_id=str(uuid.uuid4())
    with db:db.execute('INSERT INTO assets(id,project_id,kind,path,sha256,size_bytes,crs,description,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(asset_id,project_id,kind,path,sha,asset.get('size_bytes'),str(asset.get('crs') or '')[:80],str(asset.get('description') or '')[:500],utcnow()))
    return {'id':asset_id}

def assets(db,project_id):
    return [dict(r) for r in db.execute('SELECT * FROM assets WHERE project_id=? ORDER BY created_at DESC',(project_id,))]

def register_run(db,project_id,kind,summary,provenance):
    if not db.execute('SELECT 1 FROM projects WHERE id=?',(project_id,)).fetchone():raise KeyError('Projeto não encontrado')
    if kind not in ('sumo','traffic_preview','traffic_engineering','engineering_review','earthworks','urban_traffic'):raise ValueError('Tipo inválido')
    payload=json.dumps(summary,allow_nan=False,ensure_ascii=False)
    if len(payload)>500000:raise ValueError('Métricas grandes demais')
    run_id=str(uuid.uuid4())
    with db:db.execute('INSERT INTO runs VALUES(?,?,?,?,?,?)',(run_id,project_id,kind,utcnow(),payload,str(provenance)[:250]))
    return {'id':run_id}

def runs(db,project_id):
    return [{**dict(r),'summary':json.loads(r['summary_json'])} for r in db.execute('SELECT * FROM runs WHERE project_id=? ORDER BY created_at DESC LIMIT 100',(project_id,))]
