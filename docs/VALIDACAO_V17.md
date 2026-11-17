# Verificação da entrega v1.7

Data: 11/11/2026. Ambiente de execução: Windows, Node.js 24 e Python 3.12 no ambiente virtual local. SUMO e netconvert 1.28.0 instalados no ambiente virtual, sem alterar instalação global.

## Resultados executados

- `node --test tests/*.test.mjs`: **247 testes passaram**, zero falhas e zero ignorados.
- Com `.venv/Scripts` no PATH: `.\.venv\Scripts\python.exe -m unittest discover -s tools -p "test_*.py" -v`: **21 testes passaram**, zero falhas. Inclui testes API/SQLite e execução dos binários SUMO/netconvert, não apenas inspeção de XML.
- `node --check` em `src/app.mjs`, `src/urban-ui.mjs` e `src/urban-worker.mjs`: sem erros de sintaxe.
- `tools/browser_urban.cjs`, Playwright com Edge headless, API local na porta 8765 e SQLite de QA fora da raiz pública: **passou**. Comparação, referência fixa, edição de trecho, invalidação, saturação, relatório, CSV OD, resultado SUMO importado, recorte OSM local, recusa de simulação sem OD, salvamento/restauração sem eixo CAD e texto potencialmente HTML tratados sem erro JavaScript.
- Captura de tela do fluxo urbano inspecionada visualmente. Camadas e gráficos renderizaram; tiles externos podem carregar de forma assíncrona.
- Exemplo fictício: execução real SUMO base/alternativa concluída, com 810 viagens ofertadas em cada caso. Esses números descrevem exclusivamente o teste sintético.
- Recorte OSM real: importação de 133 nós/170 trechos; netconvert e SUMO executados com **duas viagens de teste FICTÍCIAS**. Mapeamento dos 170 trechos confirmado sem IDs ausentes. Isso não valida tempos de viagem ou volumes reais da região.
- Caso SUMO com semáforo manual e fechamento total temporário executado em teste de integração, com conservação das contagens de viagens.

Sem SUMO no PATH, dois testes de integração são explicitamente ignorados. Sem FastAPI/httpx, três testes API são explicitamente ignorados. O comando acima foi executado com essas dependências presentes.

## Limites da verificação

Não foram realizados contagens de campo, validação/calibração do trânsito real de Niterói, homologação normativa, teste de carga de cidade inteira ou ensaios de segurança de planos semafóricos. A captura OSM ao vivo via Overpass não pôde ser confirmada: dois servidores não responderam à consulta dentro do prazo. O recorte distribuído foi obtido pela API oficial OSM, convertido e validado localmente. A interface continua permitindo arquivos OSM locais e consultas Overpass quando o serviço estiver disponível.

Os recursos excluídos pelo usuário não foram implementados: sensores, otimização automática de semáforos e extração automática de imagens/LiDAR. Recursos legados dessas áreas, quando presentes na base anterior, foram preservados.

Veja `URBAN_V17.md` para limites dos dois motores, interpretação de filas e tempos, compatibilidade e instruções de execução.
