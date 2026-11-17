"""Local launcher: reuses this installation or selects a free loopback port."""
import argparse
import hashlib
import json
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VERSION='2.2'

def installation_id(root=ROOT):return hashlib.sha256(str(root.resolve()).casefold().encode()).hexdigest()[:16]

def probe(port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health',timeout=.5) as response:return json.load(response)
    except (OSError,ValueError):return None

def choose_port(start=8000,span=20):
    for port in range(start,min(65536,start+span)):
        # Binding is checked before HTTP probing so free ports do not incur timeouts.
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as sock:
            if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):sock.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
            try:sock.bind(('127.0.0.1',port));return port,False
            except OSError:pass
        info=probe(port)
        if info and info.get('application')=='roadworks' and info.get('version')==VERSION and info.get('installationId')==installation_id():return port,True
    raise RuntimeError('Não há porta livre no intervalo; informe --port com outro número')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--port',type=int,default=8000);parser.add_argument('--no-browser',action='store_true');parser.add_argument('--probe-only',action='store_true');args=parser.parse_args()
    if not 1024<=args.port<=65535:parser.error('Porta deve estar entre 1024 e 65535')
    try:
        port,reused=choose_port(args.port);url=f'http://127.0.0.1:{port}'
        print(('Instância existente: ' if reused else 'Servidor local: ')+url,flush=True)
        if args.probe_only:return
        if reused:
            if not args.no_browser:webbrowser.open(url)
            return
        try:import uvicorn
        except ImportError:raise RuntimeError('Instale dependências: python -m pip install -r requirements.txt')
        sys.path.insert(0,str(ROOT))
        if not args.no_browser:
            def open_ready():
                for _ in range(100):
                    info=probe(port)
                    if info and info.get('installationId')==installation_id():webbrowser.open(url);return
                    time.sleep(.1)
            threading.Thread(target=open_ready,daemon=True).start()
        uvicorn.run('tools.api:app',host='127.0.0.1',port=port,use_colors=False)
    except RuntimeError as exc:parser.exit(1,str(exc)+'\n')

if __name__=='__main__':main()
