# SKILLS.md — Competências e procedimentos do Codex no RoadWorks

Este arquivo é o **índice humano** de habilidades necessárias para manter o RoadWorks Digital Twin. O arquivo executável/descobrível por convenção de agentes é `.agents/skills/roadworks-development/SKILL.md` (singular). Leia `AGENTS.md` para regras de atuação e `README.md` para funções existentes.

## Competências

| Domínio | Conhecimentos | Módulos | Critérios mínimos |
|---|---|---|---|
| Geometria CAD | retas, arcos, clotóides, continuidade, offsets | `geometry.mjs`, `cad.mjs`, `procedural.mjs` | unidades em metros, casos degenerados, testes numéricos |
| Rodovias | greide, superelevação, largura, estacas, seções | `vertical.mjs`, `roadmodel.mjs`, `corridor.mjs` | parâmetros explícitos, aviso de falta de dados, regressão |
| Geotecnia/MDT | grid, TIN, GeoTIFF, volumes aproximados | `terrain.mjs`, `earthworks.mjs` | CRS, NoData, bordas da amostra, integração de volumes |
| GIS/OSM | GeoJSON, Overpass, topologia, tags OSM | `map-recognition.mjs`, `topology.mjs`, `digital-twin.mjs` | limites da janela, atribuição, sentidos, pontes e túneis |
| Engenharia de tráfego | V/C, filas, movimentos, OD, hierarquia viária | `traffic.mjs`, `traffic-engineering.mjs` | distinguir proxies, hipóteses e observações |
| SUMO | `netconvert`, edges, lanes, turn restrictions, TraCI | `tools/sumo_compare.py` | cenários reproduzíveis, comparação base/obra, teste se SUMO disponível |
| Planejamento 4D | datas, estacas, interdições, custos, cronogramas | `construction4d.mjs` | sobreposição de obras, fusos/datas, versões |
| Banco/API | FastAPI, SQLite, migrações, transações, snapshots | `tools/api.py`, `tools/persistence.py` | deduplicação, integridade, backup, validação |
| UI/UX | Leaflet, Three.js, HTML, interação CAD, desempenho | `app.mjs`, `visualizer.mjs`, `index.html` | feedback de erro, camadas, acessibilidade, sem IDs duplicados |
| IA/geovisão | OCR, segmentação, nuvens de pontos, avaliação | `image-segmentation.mjs`, `pointcloud-road.mjs` | separar heurística de rede treinada, métricas com ground truth |

## Rotina de implementação

### A. Antes de começar

1. Ler a tarefa, `AGENTS.md`, as seções relevantes do README, os arquivos e testes associados.
2. Identificar riscos de compatibilidade: schemas JSON, contratos de módulos, `id` dos controles, chaves SQLite, nomes de arquivos e formatos de exportação.
3. Definir entrada/saída do novo algoritmo e exemplos sintéticos determinísticos.
4. Marcar explicitamente o que é **desenho conceitual**, **análise técnica aproximada**, **medição** ou **simulação calibrada**.

### B. Implementar

1. Desenvolver função pura em `src/<tema>.mjs`, com validação de unidades e tipos.
2. Acrescentar testes `tests/<tema>.test.mjs`, cobrindo valores extremos, coerência e regressões.
3. Integrar à UI usando controles identificáveis, processamento assíncrono e mensagens claras.
4. Persistir campos compatíveis com os snapshots existentes e migrações quando necessário.
5. Se envolver Python/API, adicionar testes no diretório `tools`.
6. Incluir exemplos e instruções para Windows; evitar dependências pesadas sem justificativa.

### C. Validar

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tools -p "test_*.py" -v
python -m uvicorn tools.api:app --host 127.0.0.1 --port 8000
```

Testar no navegador: fluxo de cadastro/abertura, desenhar eixo, vista 3D, salvar e recuperar projeto, mudar data 4D, análise de tráfego, exportação. Quando o SUMO estiver instalado: verificar `sumo --version`, `netconvert --version` e executar caso pequeno. Nunca considerar uma API externa acessível apenas porque um teste estático passou.

### D. Entregar

1. Atualizar README e um resumo de mudanças (o que foi implementado, testes e limites).
2. Criar ZIP completo sem DBs de produção, chaves, `.venv`, `__pycache__` e artefatos pesados.
3. Verificar arquivo e integridade antes de informar link.
4. Explicar as etapas de execução e as verificações que não puderam ser realizadas.

## Instruções de evolução por prioridade

**Evolução imediata (v1.7 sugerida):** integrar a **rede OSM real ao SUMO**, em etapa isolada: exportação dos trechos visíveis, `netconvert`, conversões, identificação de `edges`, restrições de sentido e fechamento temporário ligado às datas 4D. Implementar **mapeamento explícito dos IDs OSM para edges SUMO** e testes sobre uma rede fictícia de pequeno porte, com viaduto e via de mão única. Não declarar calibração real.

**Segunda entrega:** editor visual para selecionar cruzamentos/lanes, alterar fase semafórica e comparar métricas antes/depois; destacar filas na interface.

**Terceira entrega:** importar contagens/OD reais, veículos de serviço e pedestres, calibrar por período, registrar métricas e evidências no SQLite, exportar relatório de revisão.

**Quarta entrega:** importar inventários topográficos e LiDAR/ortofotos para aprofundar o gêmeo geométrico com redes neurais treinadas e revisão humana.

## Prompts de execução para o Codex

> **Implementação incremental:** "Leia AGENTS.md, SKILLS.md, README.md e a skill roadworks-development. Implemente apenas a tarefa solicitada sobre a v1.6 existente, preservando todos os módulos e formatos. Crie testes, execute suites Node/Python, atualize README e entregue ZIP completo. Explique claramente recursos ainda experimentais."

> **Rede SUMO real:** "Proponha e implemente importação OSM→SUMO com conversões e restrições verificáveis, incluindo testes de vias sobrepostas em alturas diferentes, mão única, corredor com obras 4D, mapeamento de IDs e comparação base/obra. Não use valores fictícios como resultado real."

> **Usabilidade:** "Implemente seleção por clique, inspector de propriedades, prévia da geometria e ferramentas de camada sem eliminar controles existentes; adicione testes de UI e um teste manual documentado no Windows."

## Definição de pronto (DoD)

- Funcionalidade invocável pela interface ou API e demonstrável por exemplo.
- Testes novos passando, testes legados sem regressão.
- Persistência e compatibilidade verificadas quando aplicável.
- Origem, referência, unidades e limitações explicitadas nos dados e na interface.
- Sem promessa de precisão normativa, geográfica ou de tráfego não verificada.
- README atualizado e pacote verificável entregue.


## Extensão implementada v1.7 — mobilidade urbana

A extensão aditiva `urbanV17` preserva o schema do projeto v1.6. Módulos: `src/urban-traffic.mjs` (validação, roteamento, filas, saturação), `src/urban-worker.mjs` (processamento), `src/urban-ui.mjs` (interface, camadas e estado), `tools/urban_sumo.py` (rede georreferenciada e execução local). Consulte `docs/URBAN_V17.md`. O tipo SQLite `urban_traffic` é aceito, incluindo estudo válido sem eixo CAD. Não confundir o novo modelo mesoscópico com microssimulação calibrada. Referência fixa permite comparar mudanças de rede/semáforos no navegador; exportação SUMO usa o cenário isolado. O roadmap anterior continua aplicável às lacunas explicitadas na documentação. Testes E2E opcionais: `tools/browser_urban.cjs`; testes API opcionais requerem `requirements-dev.txt`.


## Extensão v1.8 — matemática e ML local

`src/urban-analysis.mjs`: ridge com Householder QR, teste cronológico de demanda, sensibilidade, calibração limitada, ajuste OD projetado e PCA. `src/analysis-ui.mjs` e `src/analysis-worker.mjs`: interface e execução cancelável. Snapshot aditivo `urbanV17.analysisV18`, sem renomear schemas/tabelas anteriores. `tools/launch.py`/`Iniciar_RoadWorks.cmd`: inicialização local com reconhecimento desta instalação e seleção de porta. Não usar gradientes diretamente sobre decisões discretas do simulador. Não otimizar semáforos, não acrescentar sensores nem extração de imagens/LiDAR. Guia: `docs/ANALISE_LOCAL_V18.md`.


## Extensão v1.9 — cidade e terreno 3D

Módulos `urban-scene.mjs` (geometria pura/terrain mesh/OBJ), `urban-renderer.mjs` (Three.js isolado) e `urban-scene-ui.mjs` (cena, seleção e importação). Modo `urban3d` separado de `3d` do corredor. Extensão opcional do snapshot `urbanSceneV19` guarda prévia limitada de terreno e origem; não usar essa prévia para volumes. `layer` não é altura; pontes/túneis sem cota permanecem esquemáticos. `sectionAtStation` aceita a borda direita com sinal usado pelo roadmodel. Guia `docs/CIDADE_3D_V19.md`; teste de navegador `tools/browser_scene.cjs`.
