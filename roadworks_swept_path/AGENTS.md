# AGENTS.md — RoadWorks Digital Twin

> Instruções operacionais para Codex e agentes de desenvolvimento. Escopo: este repositório e subpastas. Idioma de comunicação: português do Brasil; código e identificadores podem permanecer em inglês. Leia `README.md` e `SKILLS.md` antes de alterar o projeto. Para a execução técnica detalhada, consulte `.agents/skills/roadworks-development/SKILL.md`.

## 1. Missão e regras inegociáveis

Evoluir incrementalmente o **RoadWorks Digital Twin** (base verificada: **v1.6**) como ferramenta experimental para projeto geométrico rodoviário, modelagem de corredores, gêmeos geométricos, programação de obras 4D e análise de tráfego. **Preserve recursos antigos e contratos de arquivo**. Não substitua o aplicativo por um protótipo isolado, não elimine funcionalidades para simplificar uma tarefa e não renomeie schemas, campos ou elementos HTML sem migração e testes.

- **Não afirme homologação de engenharia**: classificação funcional via `highway=*` do OSM é apenas um proxy; não certifica normas DNIT, AASHTO, HCM ou diretrizes municipais.
- **Não anuncie modelo sintético como real**: análise `traffic.mjs` é agregada, SUMO existente usa rede sintética; dados de tráfego real exigem rede topológica, matriz OD, controle semafórico e calibração.
- **Não invente** levantamento, cota, datum, número de faixas, velocidade, nome de rua, situação do pavimento, resultados de IA ou resultados de teste. Marque inferências, ausências e incerteza.
- Respeite licenças OSM/ODbL, atribuição, políticas de tiles/Overpass/Nominatim e termos de provedores. Não faça scraping de visualizações, nem downloads massivos de tiles.
- Arquivos de usuários/DB devem estar fora da raiz publicada, sem segredos em Git; não coloque API keys, dados pessoais nem datasets licenciados no ZIP.
- Todo recurso novo deve ter testes, documentação, exemplos reproduzíveis quando pertinente, indicação de limitações e validação de regressão.

## 2. Arquitetura real da v1.6

```text
roadworks_swept_path/
├── index.html, style.css          # interface única; painéis e IDs existentes
├── src/app.mjs                    # orquestração UI, mapa, desenho, persistência
├── src/geometry.mjs              # base geométrica horizontal
├── src/cad.mjs, procedural.mjs    # elementos/receitas CAD
├── src/roadmodel.mjs              # pistas e seção transversal
├── src/vertical.mjs               # greide, estacas, curvas verticais
├── src/corridor.mjs               # corredor 3D e exportações
├── src/terrain.mjs                # grid, TIN, DEM/GeoTIFF
├── src/earthworks.mjs             # corte/aterro e taludes
├── src/swept.mjs                  # varredura veicular
├── src/intersections.mjs, intersection-design.mjs
├── src/digital-twin.mjs, pointcloud-road.mjs
├── src/image-segmentation.mjs, map-recognition.mjs
├── src/engineering-review.mjs     # verificações preliminares
├── src/construction4d.mjs         # etapas e interdições por data/estaca
├── src/traffic.mjs               # filas/capacidade agregadas
├── src/traffic-engineering.mjs   # hierarquia, gargalos, cruzamentos
├── src/visualizer.mjs            # planta técnica e Three.js
├── tools/api.py                  # API FastAPI + aplicação estática
├── tools/persistence.py          # SQLite: projetos/revisões/ativos/runs
├── tools/sumo_compare.py         # simulador SUMO com rede demonstrativa
├── tools/test_*.py, tests/*.test.mjs
├── samples/                       # entradas SINTÉTICAS identificadas
├── requirements.txt, README.md
├── SKILLS.md                      # roteiro de desenvolvimento
└── .agents/skills/roadworks-development/SKILL.md
```

Frontend: JavaScript ES modules, HTML/CSS, Leaflet/OSM, Three.js, GeoTIFF.js e Proj4 via CDN conforme HTML. Sem build npm obrigatório. Backend: Python/FastAPI e SQLite; o `tools/api.py` serve a mesma origem da UI. `tools/persistence.py` usa SQLite WAL, foreign keys, snapshot JSON limitado a 8 MB, SHA-256, deduplicação e revisões. Banco padrão: **`../roadworks_data/roadworks.db`**, fora da raiz estática; variável `ROADWORKS_DB` permite substituição. Arquivos raster/LiDAR/OBJ grandes não são embutidos automaticamente no snapshot: registrar procedência e integridade, reimportar quando necessário.

Endpoints existentes (não quebrar): `GET /api/health`, `GET/POST /api/projects`, `PUT/GET /api/projects/{id}`, `GET /api/projects/{id}/revisions`, `GET/POST /api/projects/{id}/assets`, `GET/POST /api/projects/{id}/runs`. Confirme a assinatura no código antes de consumir ou alterar.

## 3. Procedimento obrigatório por tarefa

1. Leia os arquivos diretamente afetados e o README; identifique os contratos públicos, schemas, IDs de HTML e testes existentes.
2. Escreva um plano curto e critérios de aceite; considere migração de projetos JSON v0.x–v1.6 e compatibilidade de banco.
3. Projete o **núcleo matemático em módulos puros e testáveis**; integração DOM/Leaflet/Three.js no `src/app.mjs` e `src/visualizer.mjs`. API e persistência ficam em `tools/`.
4. Use limites para tamanho de dados, tempo, consumo de memória e bounding boxes. Não faça operações de raster/LiDAR de grande volume na thread principal sem tratamento.
5. Acrescente testes de caminho feliz, limites, casos degenerados, CRS, valores faltantes, exceções, persistência e regressão. Evite testes que apenas buscam strings se o comportamento puder ser verificado.
6. Execute todos os testes e inspeções estáticas. Registre número real de testes e falhas; não declare que SUMO, GPU, Chrome, rede real ou integração externa foram exercitados sem executá-los.
7. Atualize `README.md`, exemplos, limitações, versão/schema quando relevante, changelog, instruções Windows e interfaces/exportações.
8. Se entregar release, crie ZIP com **todo** o repositório (exclua `.venv`, banco real, caches, `node_modules` e dados sensíveis); confira integridade e existência dos arquivos.

### Comandos de referência (PowerShell, raiz do projeto)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
node --test tests/*.test.mjs
python -m unittest discover -s tools -p "test_*.py" -v
python -m uvicorn tools.api:app --host 127.0.0.1 --port 8000
```

Abrir `http://127.0.0.1:8000`. **Não use apenas `python -m http.server` para validar SQLite**. O SUMO requer `sumo` e `netconvert` externos no PATH; `tools/sumo_compare.py` não prova integração OSM real.

## 4. Requisitos de qualidade e engenharia

- Unidades explícitas: metros, m², m³, km/h, veículos/h, segundos; validar `NaN`, números negativos, coordenadas inválidas e limites.
- Separar **WGS84 (lat/lon)** de **XY local em metros** e do CRS de origem (por exemplo SIRGAS 2000/UTM); não converter offsets geográficos diretamente em metros sem a transformação correta. Registrar CRS, origem, unidades, datum vertical, fonte, época, resolução e incerteza.
- OSM não garante geometria em nível de faixa, largura de pista, sentido real sem cadastro correto ou separação de viadutos e túneis. Não converter proximidade 2D em interseção acessível sem verificar `bridge`, `tunnel`, `layer` e conectividade.
- Para segurança operacional, preservar restrições de conversão, sentidos, travessias de pedestres e transporte coletivo; produzir alertas, não alterações automáticas perigosas.
- Evidência e rastreabilidade: saída de cada análise deve identificar versão do algoritmo, parâmetros, dados de entrada, fonte (medido/OSM/inferido/sintético), data e `reviewRequired` ou status equivalente.
- Normas: aplicar tabelas configuradas, identificadas com referência, versão e contexto; manter o estado **indeterminado** quando não há informações suficientes. Nunca tratar ausência de alerta como conformidade.
- Interface: progressivo *Mapear → Desenhar → Greide → Modelar 3D → Revisar → Planejar 4D → Tráfego*. Permitir seleção e edição de propriedades, mensagens com ação corretiva, camadas visíveis/ocultas, carregamento sob demanda e undo/redo quando implementado.
- Segurança: API local em `127.0.0.1`, sem CORS curinga; validar payloads e caminhos, evitar path traversal, XSS e SQL dinâmico concatenado. Não exibir dados sensíveis em logs. SQLite deve suportar backups consistentes.

## 5. Próximo roadmap — manter na ordem de dependências

**P0: Fundação:** adicionar testes end-to-end de navegador, projeto exemplo autocontido, observabilidade e migrações SQLite versionadas, backups e recuperação; corrigir divergência entre docs e versão atual. Garantir carregamento completo do estado exportável no projeto.

**P1: Rede viária real para SUMO:** importar dados OSM da área visível ou PBF aprovado, preservar IDs OSM, `highway`, `oneway`, `lanes`, `maxspeed`, `turn:lanes`, `restriction`, `bridge/tunnel/layer`; transformação CRS e topologia, interseções em níveis diferentes, conversões permitidas. Exportar arquivo `.osm`/rede para `netconvert`, mapear `osm_way_id → SUMO edge/lane`, vincular interdições 4D e cenários. Validar deslocamentos com exemplos pequenos.

**P2: Demanda e calibração:** OD, fluxos por faixa/horário, veículos pesados, ônibus, pedestres, semáforos, planos de desvio; calibrar/validar com observações e distinguir simulação exploratória de previsão calibrada.

**P3: Editor e visualização:** edição direta de faixas, permissões e prioridades, prévia de geometria com raio/largura, camada de congestionamento no mapa e na cena 3D, indicadores comparativos antes/depois, exportações auditáveis e variantes de projeto.

**P4: Gêmeo digital evolutivo:** ingestão de GeoPackage, LiDAR LAS/LAZ e ortofotos, segmentação neural com pesos compatíveis e métricas reais, cadastro de ativos/inspeções, atualização temporal e evidência de campo; não chamar de DT bidirecional antes de existir sincronização real.

## 6. Critérios de entrega e comunicação ao usuário

Relate: (a) arquivos alterados, (b) funcionalidades terminadas, (c) comandos/saída dos testes, (d) limitações e partes não validadas, (e) instruções Windows, (f) caminho efetivo do ZIP. Nunca cite métricas fictícias como avaliação, não diga que a simulação foi executada se só testou XML, não diga que realizou revisão normativa conclusiva. Se houver impedimento, entregue o máximo possível com identificação precisa do que ficou pendente.

## 7. Referências principais

`README.md`; manuais DNIT/DNER, AASHTO, Civil 3D, InfraWorks e OpenRoads fornecidos ao longo do projeto; documentos oficiais OSM e SUMO. Consulte fontes originais e edições vigentes para critérios técnicos. Não copie código, exemplos ou recursos proprietários de softwares comerciais.


## Extensão implementada v1.7 — mobilidade urbana

A extensão aditiva `urbanV17` preserva o schema do projeto v1.6. Módulos: `src/urban-traffic.mjs` (validação, roteamento, filas, saturação), `src/urban-worker.mjs` (processamento), `src/urban-ui.mjs` (interface, camadas e estado), `tools/urban_sumo.py` (rede georreferenciada e execução local). Consulte `docs/URBAN_V17.md`. O tipo SQLite `urban_traffic` é aceito, incluindo estudo válido sem eixo CAD. Não confundir o novo modelo mesoscópico com microssimulação calibrada. Referência fixa permite comparar mudanças de rede/semáforos no navegador; exportação SUMO usa o cenário isolado. O roadmap anterior continua aplicável às lacunas explicitadas na documentação. Testes E2E opcionais: `tools/browser_urban.cjs`; testes API opcionais requerem `requirements-dev.txt`.


## Extensão v1.8 — matemática e ML local

`src/urban-analysis.mjs`: ridge com Householder QR, teste cronológico de demanda, sensibilidade, calibração limitada, ajuste OD projetado e PCA. `src/analysis-ui.mjs` e `src/analysis-worker.mjs`: interface e execução cancelável. Snapshot aditivo `urbanV17.analysisV18`, sem renomear schemas/tabelas anteriores. `tools/launch.py`/`Iniciar_RoadWorks.cmd`: inicialização local com reconhecimento desta instalação e seleção de porta. Não usar gradientes diretamente sobre decisões discretas do simulador. Não otimizar semáforos, não acrescentar sensores nem extração de imagens/LiDAR. Guia: `docs/ANALISE_LOCAL_V18.md`.


## Extensão v1.9 — cidade e terreno 3D

Módulos `urban-scene.mjs` (geometria pura/terrain mesh/OBJ), `urban-renderer.mjs` (Three.js isolado) e `urban-scene-ui.mjs` (cena, seleção e importação). Modo `urban3d` separado de `3d` do corredor. Extensão opcional do snapshot `urbanSceneV19` guarda prévia limitada de terreno e origem; não usar essa prévia para volumes. `layer` não é altura; pontes/túneis sem cota permanecem esquemáticos. `sectionAtStation` aceita a borda direita com sinal usado pelo roadmodel. Guia `docs/CIDADE_3D_V19.md`; teste de navegador `tools/browser_scene.cjs`.
