"""Runs real checks with an isolated API/SQLite; does not connect tests to user projects.

python tools/test_execution.py [--skip-browser]
Returns nonzero on failure and records commands, logs and outcomes in roadworks_qa.
"""
from __future__ import annotations
import argparse,json,os,re,shutil,socket,subprocess,sys,tempfile,time,urllib.request
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-browser',action='store_true',help='Explicitly skip browser checks; recorded as skipped')
    args=parser.parse_args()
    out=ROOT/'roadworks_qa'/('automatico_'+datetime.now().strftime('%Y%m%d_%H%M%S')+'_'+str(os.getpid()))
    out.mkdir(parents=True,exist_ok=False)
    env=os.environ.copy();env.pop('ROADWORKS_URL',None);env['PYTHONUTF8']='1'
    scripts=Path(sys.executable).parent
    env['PATH']=str(scripts)+os.pathsep+env.get('PATH','')
    if not env.get('PLAYWRIGHT_MODULE'):
        bundled=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
        if bundled.is_dir():env['PLAYWRIGHT_MODULE']=str(bundled)
    report={'schema':'roadworks-execution-check/2.1','startedAt':datetime.now(timezone.utc).isoformat(),'isolatedDatabase':True,'checks':[],'limitations':['Browser geocoder and road-provider responses are mocked; live availability is not certified.','Passing tests does not validate real traffic demand or engineering compliance.']}
    node=shutil.which('node')
    def record(name,command,timeout=240):
        print('Executando: '+name,flush=True)
        started=time.monotonic();log=out/(name+'.log')
        try:
            with log.open('w',encoding='utf-8') as stream:
                result=subprocess.run(command,cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,timeout=timeout)
            status='passed' if result.returncode==0 else 'failed';code=result.returncode
        except (OSError,subprocess.TimeoutExpired) as exc:
            with log.open('a',encoding='utf-8') as stream:stream.write('\n'+str(exc))
            status='failed';code=None
        text=log.read_text(encoding='utf-8',errors='replace')
        skipped=re.search(r'(?:#|ℹ)\s*skipped\s+(\d+)|OK \(skipped=(\d+)\)',text)
        skipped_count=int(next((x for x in skipped.groups() if x is not None),'0')) if skipped else 0
        if status=='passed' and skipped_count:status='passed_with_skips'
        count=re.search(r'(?:#|ℹ)\s*tests\s+(\d+)|Ran (\d+) tests',text)
        test_count=int(next(x for x in count.groups() if x is not None)) if count else None
        report['checks'].append({'name':name,'command':command,'tests':test_count,'skipped':skipped_count,'status':status,'returncode':code,'seconds':round(time.monotonic()-started,2),'log':str(log.relative_to(ROOT))})
        print(name+': '+status,flush=True)
    if node:record('javascript',[node,'--test',*[str(p.relative_to(ROOT)) for p in sorted((ROOT/'tests').glob('*.test.mjs'))]])
    else:report['checks'].append({'name':'javascript','status':'failed','reason':'Node.js não encontrado no PATH'})
    record('python',[sys.executable,'-m','unittest','discover','-s','tools','-p','test_*.py','-v'])
    process=None
    with tempfile.TemporaryDirectory(prefix='roadworks-qa-') as temporary:
        env['ROADWORKS_DB']=str(Path(temporary)/'qa.db')
        if args.skip_browser:
            report['checks'].append({'name':'browser','status':'skipped','reason':'--skip-browser solicitado'})
        elif not node:
            report['checks'].append({'name':'browser','status':'failed','reason':'Node.js ausente'})
        else:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
            env['ROADWORKS_URL']=f'http://127.0.0.1:{port}'
            try:
                with (out/'server.log').open('w',encoding='utf-8') as stream:
                    flags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name=='nt' else 0
                    process=subprocess.Popen([sys.executable,'-m','uvicorn','tools.api:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,creationflags=flags)
                    deadline=time.monotonic()+30;ready=False
                    while time.monotonic()<deadline and process.poll() is None:
                        try:
                            with urllib.request.urlopen(env['ROADWORKS_URL']+'/api/health',timeout=.5) as response:
                                if json.load(response).get('application')=='roadworks':ready=True;break
                        except (OSError,ValueError):pass
                        time.sleep(.2)
                    if not ready:raise RuntimeError('A API isolada não iniciou; confira server.log')
                    for script in ['usability','detour','urban','analysis','scene','study']:
                        env['ROADWORKS_SCREENSHOT']=str(out/(script+'.png'))
                        record('browser_'+script,[node,'tools/browser_'+script+'.cjs'],timeout=240)
            except (OSError,RuntimeError) as exc:
                report['checks'].append({'name':'browser_server','status':'failed','reason':str(exc)})
            finally:
                if process and process.poll() is None:
                    # Only the process tree launched above is terminated, never an existing service.
                    if os.name=='nt':subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                    else:process.terminate()
                    try:process.wait(timeout=15)
                    except subprocess.TimeoutExpired:process.kill();process.wait()
    report['finishedAt']=datetime.now(timezone.utc).isoformat()
    report['status']='failed' if any(x['status']=='failed' for x in report['checks']) else 'passed_with_skips' if any(x['status'] in ('skipped','passed_with_skips') for x in report['checks']) else 'passed'
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Resultado: '+report['status']+'\nRelatório: '+str(out/'report.json'),flush=True)
    return 1 if report['status']=='failed' else 0

if __name__=='__main__':raise SystemExit(main())
