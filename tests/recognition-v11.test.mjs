import test from 'node:test';import assert from 'node:assert/strict';
import {visibleRoads,dedupeStreetNames,ocrWordHints} from '../src/map-recognition.mjs';
const bounds={west:-43.2,east:-43.1,south:-23,north:-22.9};
test('Somente os eixos que cruzam a janela visível são encontrados',()=>{const roads=[{id:1,name:'A',coordinates:[[-43.15,-22.96],[-43.14,-22.96]]},{id:2,name:'B',coordinates:[[-44,-24],[-44.1,-24.1]]}];assert.equal(visibleRoads(roads,bounds).length,1)});
test('Nomes OSM repetidos agregados sem acentos',()=>{const n=dedupeStreetNames([{name:'Rua São Bento',class:'residential'},{name:'Rua Sao Bento',class:'residential'}]);assert.equal(n.length,1);assert.equal(n[0].segments,2)});
test('OCR localiza centro do texto no viewport aproximado',()=>{const w=ocrWordHints([{text:'Rua',confidence:90,bbox:{x0:40,x1:60,y0:40,y1:60}}],100,100,bounds);assert.equal(w.length,1);assert.ok(Math.abs(w[0].lng+43.15)<1e-9);assert.equal(w[0].verified,false);assert.ok(w[0].lat>-23&&w[0].lat< -22.9)});
test('OCR rejeita texto de baixa confiança e boxes inválidas',()=>{const w=ocrWordHints([{text:'R',confidence:100,bbox:{x0:1,x1:2,y0:1,y1:2}},{text:'Rua',confidence:12,bbox:{x0:1,x1:2,y0:1,y1:2}}],100,100,bounds);assert.equal(w.length,0)});

test('Via cruza a janela embora vértices estejam fora dela',()=>{const r=[{id:'cross',name:'Eixo',coordinates:[[-43.4,-22.95],[-42.9,-22.95]]}];assert.equal(visibleRoads(r,bounds).length,1)});
