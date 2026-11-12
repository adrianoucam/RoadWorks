# Mobilidade urbana v1.7

## O que está disponível

O painel **20 / Mobilidade urbana**, acessível por **9 · Mobilidade urbana**, acrescenta estudos por cidade ao aplicativo existente. Niterói é a configuração inicial; nome e centro do mapa são editáveis. Use projetos SQLite separados para cidades ou áreas de estudo diferentes.

| Recurso | Implementação e limite |
|---|---|
| Rede direcionada | Nós e trechos com sentidos, faixas, velocidades, capacidade, armazenamento, modos e movimentos permitidos |
| Edição visual | Clique no trecho para editar propriedades; arraste nós para mudar geometria e recalcular comprimento; exporte GeoJSON; abra um trecho no editor geométrico legado |
| Dados OSM | Botão de vias captura nós, vias e relações; conversão por IDs compartilhados, sem unir cruzamentos pela proximidade 2D; preserva tags e IDs |
| Restrições | Relações `no_*` e `only_*` com nó via; exceções, condicionais e via-way geram avisos e exigem revisão |
| Demanda | OD por classe e intervalo; entrada manual, CSV e JSON; ocupação dos veículos e passageiros concluídos |
| Percentuais | Global e por OD/período; formulário pode aplicar ajuste às OD da origem selecionada; sobreposições na mesma OD são rejeitadas |
| Acidentes e obras | Trecho, início/fim, faixas fechadas e fator de capacidade; eventos simultâneos usam máximo de faixas fechadas e mínimo fator, sem somar fechamentos sem identidade de faixa |
| Obras 4D | Importa etapas ativas na data selecionada para um trecho explicitamente escolhido; registra ID e data da etapa; afeta esse trecho durante o período simulado |
| Semáforos manuais | Ciclo, defasagem e intervalo verde por trecho de entrada; referência fixa permite comparar planos diferentes |
| Ônibus e caminhões | Classes próprias, equivalência fixa de 2 automóveis no modelo mesoscópico e contagem de passageiros segundo ocupação informada |
| Pedestres | Classe permitida em rede explicitamente configurada para pedestres; configure velocidade e capacidade específicas; sem interação entre travessias e veículos |
| Comparação | Base sem eventos e sem variação global, ou estudo de referência fixado antes de modificar rede, demanda, eventos ou sinais |
| Saturação | Até 12 níveis percentuais, filas e fração concluída contra limites configuráveis; não determina um teto universal da cidade |
| Inventário | Importação de pontos GeoJSON WGS84, com categoria e nome; exibição no mapa; sem extração automática |
| Evidência | Pares observado/simulado, unidade, finalidade da amostra, MAE e RMSE; calibração é manual, sem ajuste automático |
| Resultados | Gráfico de filas, fila máxima por trecho no mapa, classes, passageiros, tempos das viagens concluídas e viagens pendentes |
| Persistência | Estudo, até 8 execuções conforme limite de tamanho, referência, resultado SUMO importado e observações entram no JSON/SQLite; funciona sem eixo CAD |
| Exportações | Estudo JSON, rede GeoJSON, comparação CSV, relatório HTML com entrada da execução e preparação de SUMO |

Sensores, otimização automática de semáforos e extração automática de imagens/LiDAR não foram acrescentados. Funcionalidades antigas foram preservadas.

## Executar no Windows

Na pasta `roadworks_swept_path`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn tools.api:app --host 127.0.0.1 --port 8000
```

Abra `http://127.0.0.1:8000`. A API usa o SQLite existente, sem remover projetos ou revisões. O banco permanece fora da raiz pública, em `../roadworks_data/roadworks.db`, salvo configuração de `ROADWORKS_DB`.

## Primeiro estudo

1. Abra Mobilidade urbana e execute o exemplo inicial **FICTÍCIO** para conhecer os controles. Ele tem coordenadas próximas de Niterói, mas suas vias e volumes não são levantamentos reais.
2. Para começar com um recorte real sem consulta externa, use **Abrir recorte OSM de Niterói**: são 133 nós e 170 trechos, sem demanda. Fonte e licença em `samples/NITEROI_OSM_FONTE.md`. Para outra área, aproxime o mapa, carregue **Vias OSM (mapa visível)** e clique **Usar OSM carregado**. A demanda fica vazia; cadastre OD e controles revisados. Também é possível importar um arquivo Overpass JSON com nós, vias e relações.
3. Escolha origem e destino, modo, oferta/hora, intervalo e ocupação. Adicione as OD. O CSV de exemplo `samples/demanda_OD_FICTICIA.csv` serve para o exemplo fictício, com nós A e C; outros mapas exigem seus IDs.
4. Configure duração, inclusive tempo suficiente após o fim da demanda para escoamento. Uma fração baixa de viagens concluídas pode decorrer do horizonte curto; não interprete automaticamente como colapso.
5. Para testar alteração geométrica ou semafórica, **Fixar estudo atual como referência** antes de editar. Sem referência fixa, base e alternativa usam a mesma rede e os mesmos semáforos; diferem em eventos e variação global.
6. Acrescente acidentes, obras e planos manuais. Início é inclusivo e fim é exclusivo, em segundos relativos ao começo da simulação.
7. Compare ou avalie saturação. Salve uma revisão no SQLite. Edições invalidam o resultado atual; execuções antigas permanecem no histórico enquanto couberem no limite.

CSV OD: `id;from;to;mode;rateVph;begin;end;occupancy`. Modos: `car`, `bus`, `truck`, `pedestrian`. Delimitadores vírgula e ponto e vírgula são aceitos; decimais com vírgula precisam de aspas quando esse for o delimitador. Importação substitui OD e limpa os ajustes anteriores.

O editor JSON permite incluir/remover nós e trechos, definir permissões por modo, inventário e ajustes finos. `allowedNext` ausente permite todas as saídas conectadas; `[]` proíbe todas. A conversão não gera conexões individuais por faixa a partir de `turn:lanes`.

## Modelo mesoscópico e interpretação

O motor usa passos de um segundo, chegadas determinísticas com resíduo fracionário, filas FIFO por trecho, tempo de percurso livre e capacidade de saída. Veículos só atravessam um trecho após seu tempo livre; transferências são aplicadas após avaliar todas as saídas do passo. Armazenamento finito, em equivalentes de automóvel, pode reter veículos nos trechos anteriores e fora da rede. Armazenamento físico não é reduzido durante o fechamento de faixas.

As rotas minimizam o tempo livre, respeitando permissões e fechamentos totais na partida. Não reagem a congestionamento ou redução parcial de capacidade e não são recalculadas após a entrada na rede. Quando não há rota, as viagens aguardam fora da rede e podem entrar após reabertura. Não há modelo de conflito entre movimentos, mudança de faixa, velocidade individual, embarque/desembarque ou interação pedestre-veículo. Não é substituto de uma microssimulação calibrada.

Os tempos médios consideram apenas viagens concluídas. Consulte sempre pendentes, filas, viagens fora da rede e período de escoamento. A soma ofertadas = concluídas + pendentes é preservada. Ocupações e equivalências são hipóteses configuradas ou declaradas, não medições de passageiros.

Limites: 2.000 nós, 4.000 trechos, 300 OD, 300 eventos, 30.000 viagens e 14.400 segundos, sujeito a limite adicional de trechos × duração. Documento urbano de até 2 MB, projeto completo de até 8 MB. Cálculos rodam em Worker e podem ser cancelados. Áreas grandes devem ser divididas; não se promete simulação municipal completa no navegador.

## SUMO georreferenciado

O pipeline novo usa a rede do estudo, não o corredor sintético legado. Gere o JSON no painel e instale os binários opcionais:

```powershell
.\.venv\Scripts\python.exe -m pip install eclipse-sumo
$env:PATH=(Join-Path $PWD '.venv\Scripts')+';'+$env:PATH
sumo --version
netconvert --version
.\.venv\Scripts\python.exe tools/urban_sumo.py samples/estudo_urbano_FICTICIO.json --output ../urban_run_01 --run
```

Use uma pasta vazia por execução. Para apenas preparar XML, use `--prepare-only` em vez de `--run`. Essa opção **não** produz métricas de simulação. `run.sumocfg` de cada caso pode ser aberto no SUMO-GUI depois que `netconvert` gerar a rede. A exportação é baseada em PlainXML com lon/lat WGS84, projeção UTM pelo netconvert, trechos e conexões explícitos. IDs do estudo são mantidos; `edge_mapping.json` vincula IDs OSM, edges e lanes efetivamente gerados.

Uma execução completa gera `baseline/`, `alternative/`, `input.json`, `edge_mapping.json` e `result.json`. Importe este último no painel urbano. Referências fixas do navegador não são incluídas na exportação SUMO: o CLI compara o estudo exportado sem eventos/variação global com sua alternativa. Para comparar redes distintas no SUMO, exporte e execute separadamente.

Limites específicos:

- O CLI inclui carros, ônibus e caminhões; rejeita OD de pedestres, pois a geração de infraestrutura pedestre dedicada ainda não está integrada ao pipeline SUMO.
- Aplica interdições temporárias, inclusive sobrepostas, em um único rerouter. Rotas impossíveis na partida ficam contabilizadas como não roteadas, sem fabricar chegada; diferentemente do motor do navegador, não são reinseridas após a reabertura.
- O fator abstrato `capacityFactor`, capacidade/faixa e armazenamento do motor mesoscópico não são convertidos em equivalentes artificiais do SUMO. O relatório explicita essa diferença.
- Conexões por faixa são derivadas proporcionalmente e exigem revisão no netedit. Não são uma interpretação completa de sinalização por faixa.
- Planos semafóricos são permissivos, sem transições amarelas ou verificação de conflitos. Entradas do mesmo cruzamento precisam do mesmo ciclo. Não usar como plano operacional de controlador físico.
- Execuções têm limites de tempo e não são servidas como jobs remotos pela API; a execução é local por CLI. SUMO não recebe comandos de sensores ou de controladores reais.

Referências verificadas durante o desenvolvimento: [PlainXML](https://sumo.dlr.de/docs/Networks/PlainXML.html), [netconvert](https://sumo.dlr.de/docs/netconvert.html), [interdições e rerouter](https://sumo.dlr.de/docs/Simulation/Rerouter.html), [instalação](https://sumo.dlr.de/docs/Downloads.php).

## Compatibilidade e validação

| Contrato | Tratamento |
|---|---|
| Projeto `roadworks-swept-path/1.6` | Preservado, com extensão opcional `urbanV17`; novas funcionalidades não renomeiam campos legados |
| Estudo urbano isolado | Novo schema `roadworks-urban/1.7` |
| SQLite | Mesmas tabelas, revisões e endpoints; novo tipo de análise `urban_traffic`; aceita projeto sem eixo quando há estudo urbano válido |
| Importações antigas | Ausência de `urbanV17` inicia exemplo urbano separado; não converte dados legados em dados observados |
| SUMO legado | `sumo_compare.py` e schemas v1.4 preservados |

Comandos de verificação:

```powershell
node --test tests/*.test.mjs
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tools -p "test_*.py" -v
```

`tools/browser_urban.cjs` faz teste E2E opcional com Playwright e Edge/Chromium. Inicie a API com `ROADWORKS_DB` apontando para um banco de teste fora da raiz pública e defina `ROADWORKS_URL`. O teste cria revisões; não o execute contra banco de produção. Defina `PLAYWRIGHT_MODULE` se Playwright estiver instalado em outro diretório.

Dados de Niterói necessários para validação operacional: contagens por período/classe, origens e destinos, tempos de viagem, faixas e movimentos revisados, planos semafóricos e observações de filas. Nenhum resultado deste pacote é uma estimativa validada da capacidade real da cidade.
