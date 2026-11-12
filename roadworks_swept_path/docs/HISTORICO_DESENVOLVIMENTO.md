# Histórico de desenvolvimento até a versão 1.9

Registro histórico preservado. Para a apresentação e as instruções atuais, consulte o [README principal](../README.md). Descrições antigas podem se referir somente à versão indicada em cada seção.

# RoadWorks v1.9 — Rede urbana e terreno em 3D

Abra **Iniciar_RoadWorks.cmd**, carregue a rede em **9 · Mobilidade urbana** e clique **11 · Cidade 3D**. A nova vista inclui superfícies das vias, seleção por clique, MDT GeoTIFF/XYZ, camadas, nomes, eventos, filas máximas e exportação OBJ. O erro de seção transversal que causava o falso “Greide inválido” foi corrigido.

[Guia da cidade 3D, terreno e limites](CIDADE_3D_V19.md). Sem MDT, a rede usa plano de referência; o terreno de demonstração é FICTÍCIO, não relevo real de Niterói. Recursos legados e as exclusões do usuário foram preservados.

[Verificação v1.9: 277 testes JavaScript, 24 testes Python e três fluxos no navegador](VALIDACAO_V19.md).

## Versão anterior

# RoadWorks v1.8 — Análise matemática e ML local

Inicie com **Iniciar_RoadWorks.cmd** e abra **10 · Matemática e ML**. Novidades: sensibilidade, calibração assistida com validação separada, regressão ridge temporal, ajuste OD não negativo e PCA de cenários. O lançador reaproveita esta instalação ou escolhe outra porta, sem encerrar outros programas.

[Guia completo de uso local, formatos e limites](ANALISE_LOCAL_V18.md). Os módulos numéricos rodam no navegador e não exigem GPU. A cobertura do InfraWorks é parcial; não há promessa de equivalência ou homologação de projeto executivo. Recursos anteriores e as três exclusões do usuário foram preservados.

[Verificação v1.8: 265 testes JavaScript, 24 testes Python e dois fluxos no navegador](VALIDACAO_V18.md).

## Versão anterior

# RoadWorks v1.7 — Mobilidade urbana e cenários por cidade

Nova área de estudos urbanos com rede direcionada, OD, acidentes, obras, semáforos manuais, percentuais de demanda, comparação, saturação e pipeline georreferenciado SUMO. Recursos anteriores preservados.

Leia [Mobilidade urbana v1.7](URBAN_V17.md) para uso, contratos, limites, exemplos e testes. O exemplo inicial é fictício; não é previsão de tráfego de Niterói. Sensores, otimização automática de semáforos e extração automática de imagens/LiDAR não foram acrescentados.

Validação da entrega: [247 testes Node, 21 testes Python e fluxo de navegador](VALIDACAO_V17.md). Inclui recorte OSM real de Niterói sem demanda observada e execução SUMO de testes identificados como fictícios.

## Histórico e recursos anteriores

# RoadWorks Digital Twin v1.4 — Tráfego, desvios e usabilidade (11/11/2026)

> **Duas modalidades:** a prévia no browser é um modelo agregado de filas, não uma microssimulação real; a simulação de veículos individuais é realizada pelo **Eclipse SUMO**, executado separadamente no computador do usuário. A rede SUMO deste pacote é uma rede sintética de corredor e desvio. Para usar a malha real de vias OSM, são necessários importação, limpeza topológica e calibração adicionais. Nenhum resultado sintético deve ser anunciado como previsão do tráfego real de Niterói ou de outra cidade.

## Novos recursos

- **7 · Tráfego** (seção **18**) acessível pelo fluxo guiado: demanda veicular por hora, faixas por sentido modelado, velocidade livre, capacidade, percentual de desvio, faixas do desvio e duração. A condição de interdição pode ser definida manualmente ou derivada da **data 4D selecionada**. Uma interdição de 1 faixa é aplicada ao conjunto do trecho nesta aproximação, mesmo quando a obra afeta somente algumas estacas.
- **Gráfico comparativo** de fila sem obra e com obra, relatório de fila máxima, veículos não atendidos ao final e estimativa de atraso. O modelo simplificado conserva a quantidade de veículos que entra, é atendida ou fica em fila. Não representa dinâmica microscópica, faixa de armazenamento, semáforos, filas bloqueando interseções, mudança de faixa ou modelos calibrados.
- **Exportação de cenário SUMO (.json)** e **importação dos resultados SUMO (.json)**. Os resultados importados exibem veículos que chegaram, tempo médio de viagem, espera e máximo de veículos parados. Não há números SUMO gerados artificialmente no aplicativo.
- **Explorador de camadas cartográficas:** mostrar/ocultar eixos OSM, inventário do Digital Twin, cronograma 4D, avisos de revisão e marcador de tráfego, sem remover os objetos. Inspirado no fluxo *Layer Properties / Model Explorer* do InfraWorks apresentado nas transcrições.
- Preservados todos os recursos CAD, MDT/TIN, corredor, análise 2D/3D, obras 4D e exportações v1.3; o projeto salva um resumo opcional da prévia no campo `trafficV14` sem alterar o schema antigo.

## Rodar no Windows — prévia do navegador

```powershell
cd E:\bc_niteroi_rj\infraworks\roadworks_swept_path
node --test tests/*.test.mjs
python -m http.server 8080
```

Abra `http://localhost:8080`. Carregue uma via, crie etapas em **6 · Planejar 4D**, selecione a data e depois **7 · Tráfego**. Selecione **Etapa 4D ativa** e clique **Comparar cenários**. A ausência de fase ativa é tratada como sem interdição. O botão **Exportar cenário SUMO** cria `roadworks_v14_cenario_sumo.json`.

## Executar a microssimulação real do Eclipse SUMO

1. Instale o Eclipse SUMO no Windows: https://sumo.dlr.de/docs/Installing/index.html . Confira `sumo --version` e `netconvert --version` no PowerShell.
2. Use o cenário exportado pelo RoadWorks, ou o exemplo `samples/cenario_trafego_FICTICIO_sumo.json`.
3. Execute (caminho do exemplo):

```powershell
python tools\sumo_compare.py samples\cenario_trafego_FICTICIO_sumo.json --output roadworks_resultado_sumo.json
```

4. No painel **7 · Tráfego**, escolha o arquivo em **Importar resultado real do SUMO**.

O script `tools/sumo_compare.py` usa *netconvert* para gerar automaticamente uma rede com uma rota principal e um desvio alternativo, cria veículos individuais com partidas determinísticas, executa **dois cenários** (base e obra) via SUMO e extrai métricas de `tripinfo.xml` e `summary.xml`. A rede e a distribuição de viagens são sintéticas. O script exige executáveis externos e não foi rodado com o SUMO neste ambiente; sua geração de arquivos XML foi verificada por testes Python. O script usa arquivos temporários, não edita OSM e não envia nada à Internet.

Se aparecer erro `sumo não encontrado no PATH`, reinstale/adicione o diretório `bin` do SUMO à variável PATH. Não basta executar `python -m http.server` para rodar SUMO.

## Usabilidade: análise das quatro transcrições

| Transcrição | Recurso demonstrado | Decisão no RoadWorks |
|---|---|---|
| `transcricao_video1.txt` | Polígonos de faixas de pedestres importados Civil 3D → InfraWorks; categoria e elevação ajustadas | Fluxo de camadas e futuro catálogo de faixas de pedestres com drape sobre superfície |
| `video2.txt` | Layer Properties / Model Explorer para ocultar vegetação e construções e ganhar desempenho | **Gerenciador de camadas implementado** |
| `video3.txt` | Direção de faixas, conexão de ruas, curvas e faixas adicionais | Reutilizar editor e regras de sentido já existentes; edição contextual avançada permanece pendente |
| `video4.txt` | Dados GeoSampa de semáforos/postes, posicionamento linear de postes a cada 25 m | Evolução prevista: importação de inventário com CRS explícito e distribuição procedural por estaca |

## Limites de segurança e validade

- A demanda de 1.800 veículos/h é **fictícia**. Para estimativas reais são necessários contagens classificadas por intervalo, matriz origem-destino, composição veicular, velocidades observadas, tempos semafóricos, rotas alternativas e calibração/validação independente.
- O simulador embutido assume fluxo homogêneo, taxas de chegada constantes e saídas limitadas pela capacidade informada. A fila é idealizada como reservatório, sem efeitos de armazenamento viário ou propagação a montante.
- Mesmo os resultados SUMO são relativos a uma malha **sintética**, não às ruas exibidas no OpenStreetMap. Para microssimular as ruas reais, é necessário exportar a rede OSM, tratar conectividade, restrições de giro, semáforos e OD e inserir os bloqueios nos edges corretos.
- As datas de obra são planejadas, não sincronizadas com telemetria. A ausência de advertências não representa aprovação de DNIT/AASHTO ou de segurança viária.

**Referências:** https://sumo.dlr.de/docs/TraCI/Interfacing_TraCI_from_Python.html e https://sumo.dlr.de/docs/Simulation/Routing.html

---

# RoadWorks Digital Twin v1.3 — Planejamento de obras em 4D

> Esta versão é um protótipo experimental de engenharia, **não homologado**. Integra o motor de trajetória, CAD, MDT, terraplenagem e revisão da v1.2. A dimensão **4D** aqui corresponde a **geometria 3D + datas planejadas**, não à execução física sincronizada com sensores.

## Novidade v1.3: cronograma georreferenciado por estacas

- Nova seção **17 / ETAPAS CONSTRUTIVAS** e atalho **6 · Planejar 4D**.
- Adição, edição, exclusão e importação/exportação de etapas; nome, categoria, início/fim, estaca inicial/final, tipo de interdição, custo **planejado** opcional.
- **Linha do tempo** com seletor de data, botões ±1 dia e reprodução automática (700 ms por dia simulado).
- Representação por cores na **janela do mapa**, na planta técnica **2D** e na cena **3D**; a faixa de trabalho é representada por um envelope de largura aproximada da plataforma, não por limites topográficos nem dispositivos de segurança dimensionados.
- Diagnóstico de **interdições simultâneas sobrepostas** em intervalos espaciais e temporais. Não significa que a obra seja insegura; o alerta demanda análise de tráfego e do plano de desvios.
- Persistência das etapas no **Projeto JSON v1.3**, com abertura de versões anteriores; cronograma individual em **CSV/JSON**.
- Cronograma de demonstração **fictício** gerado para o comprimento real do eixo selecionado.

### Uso no Windows

```powershell
cd E:\bc_niteroi_rj\infraworks\roadworks_swept_path
node --test tests/*.test.mjs
python -m http.server 8080
```

Abra http://localhost:8080. Selecione um exemplo de trecho ou importe uma via OSM, finalize o eixo, abra **6 · Planejar 4D**, clique em **Exemplo de cronograma** e experimente **▶ 4D**. A opção Visualização permite alternar entre mapa OSM, planta técnica e 3D. Para um projeto real, substitua as datas, custos e comprimentos fictícios pelos dados do planejamento validado.

### Limitações v1.3

1. As interdições são **metadados de planejamento**, não uma simulação microscópica de filas ou congestionamentos. SUMO/TraCI é uma possível integração futura.
2. Os trechos da obra são projeções geométricas do eixo CAD/OSM selecionado; podem não coincidir com margens e faixas reais. OSM não substitui projeto topográfico.
3. Não há vínculos de precedência do CPM, produtividade de equipes, medições realizadas nem dados ao vivo; os percentuais são **progresso previsto pela data**, e não progresso físico constatado.
4. A vista 3D utiliza o modelo já disponível no navegador e depende do Three.js por CDN. A validação automatizada **não** equivale a ensaio integral em navegador.
5. A exportação JSON não incorpora o MDT raster; conforme os avisos preexistentes, é necessário reimportá-lo para cálculos de engenharia.

### Fontes cartográficas: documentação revisada

| Serviço | Uso correto no RoadWorks | Observação |
|---|---|---|
| OpenStreetMap, dados ODbL | Eixos e atributos viários (`highway`, `name`, `ref`, `lanes`, `oneway`, `surface` quando presentes) | Dados podem estar incompletos. `name`, `alt_name`, `old_name` e `noname` não devem ser inferidos automaticamente. |
| Overpass API | Consultar trechos vetoriais sob demanda da área visível | Instância comunitária, capacidade e limites variáveis; evitar buscas contínuas e em massa. |
| Nominatim | Geocodificar o local solicitado explicitamente | Serviço público exige máximo absoluto de 1 req/s por aplicação, identificação e atribuição. |
| OSM raster tiles | Exibição interativa da janela visível | Atribuição obrigatória; sem pré-baixar regiões para modo offline. |
| OpenCycleMap | Estilo voltado a ciclismo com dados OSM | **Não** é fonte separada de dados CAD/3D; licenças, termos e acesso aos tiles dependem do provedor (Thunderforest). |

Referências oficiais (consultadas em novembro de 2026):
- https://wiki.openstreetmap.org/wiki/Using_OpenStreetMap
- https://wiki.openstreetmap.org/wiki/Applications_of_OpenStreetMap
- https://wiki.openstreetmap.org/wiki/List_of_OSM-based_services
- https://wiki.openstreetmap.org/wiki/Names
- https://wiki.openstreetmap.org/wiki/Overpass_API
- https://operations.osmfoundation.org/policies/tiles/
- https://operations.osmfoundation.org/policies/nominatim/
- https://www.opencyclemap.org/docs/

---

# RoadWorks Swept Path v0.9 — MDT/TIN + corredor 3D + terraplenagem

Software experimental web de concepção viária, CAD 2D/3D, simulação de veículos, estaqueamento e geração de corredor, ampliado com **v0.8 — terreno natural** e **v0.9 — corte, aterro, taludes e quantitativos**.

**Não homologado.** A malha, as coordenadas locais aproximadas, os dados OSM e os volumes estimados não substituem topografia de precisão, geotecnia, drenagem, projetos executivos, estudos de estabilidade e verificação DNIT/AASHTO. Sempre revise CRS horizontal, datum vertical, unidades, resolução do MDT e origem local antes de fazer qualquer interpretação de volume.

## Executar no Windows

```powershell
cd E:\bc_niteroi_rj\infraworks\roadworks_swept_path
node --test tests/*.test.mjs
python -m http.server 8080
```

Abra `http://localhost:8080`. Interface HTML/JavaScript sem compilação npm. Requer Internet para Leaflet, OpenStreetMap, Three.js e, na importação TIFF, **GeoTIFF.js** e **Proj4** carregados por CDN. Testes matemáticos Node não precisam de Internet.

## Guia de teste v0.8 — terrenos reais

1. Defina o traçado: escolha **Trecho reto (laboratório)**, desenhe uma via, importe uma linha OSM ou utilize CAD. O primeiro ponto do eixo define a **origem local aproximada (0,0)**.
2. Abra **07 / Terreno real — MDT, GeoTIFF ou XYZ/TIN**. Selecione `*.tif`, `*.tiff`, `*.xyz`, `*.csv` ou `*.txt`.
3. Para CSV/XYZ: selecione **X(m),Y(m),Z(m) local** (referenciado à origem do eixo) ou **longitude, latitude, cota** (graus decimais EPSG:4326, nesta ordem). Utilize pontos reais já expressos no sistema adequado; **não passe UTM Easting/Northing como coordenadas locais** sem transformá-los previamente.
4. O TIN é triangulado por Delaunay (algoritmo Bowyer–Watson), limitado por padrão a **2.000 pontos** e por um comprimento máximo de aresta configurável. Não interpola fora dos triângulos válidos.
5. GeoTIFF: o leitor processa 1 banda de elevação, limita-se a **4 milhões de pixels**, requer código EPSG, TiePoint e PixelScale, e raster `north-up` sem transformação de rotação própria. EPSG:4326, EPSG:31983, EPSG:32723 e os códigos disponíveis no Proj4 pré-carregado são suportados; transforme previamente outros CRS usando GDAL/QGIS. A conversão para metros locais utiliza aproximação plana; não é geodésia de precisão. **Não confunda ortofoto RGB com MDT.**
6. Marque **Visualizar terreno no 3D**, selecione Vista 3D e clique **Gerar corredor 3D**, se ainda não tiver gerado.

Para demonstração offline, clique **Terreno fictício**; essa superfície não é georreferenciada e **não representa a região escolhida**. O arquivo `samples/terreno_FICTICIO_local_xyz.csv` fornece cotas sintéticas para testar a importação. As cotas do projeto precisam estar no mesmo datum das cotas do terreno, mesmo quando ambos usam números aparentemente compatíveis.

## Guia v0.9 — corte, aterro, taludes e volumes

1. Com terreno carregado e corredor válido, abra **08 / Terraplenagem e taludes**.
2. Configure os parâmetros *H:V* para os taludes de corte e aterro (por exemplo, 1,5:1 e 2:1). **São apenas valores de laboratório**, não recomendações geotécnicas.
3. Defina alcance máximo e passo transversal. Clique **Calcular corte / aterro**.
4. O algoritmo calcula a diferença **cota projetada – cota natural**, encontra o ponto em que cada talude intercepta o terreno (daylight), integra áreas positivas e negativas separadamente e calcula volumes pela **média das áreas de seções consecutivas**, ponderadas pela distância longitudinal entre estações.
5. Resultados em m³, relatórios **Volumes CSV**, **Áreas CSV** e **Taludes OBJ**. No modo 3D, os taludes são desenhados sobre a superfície natural e o corredor.
6. Quando o MDT não cobre toda a seção ou o encontro de talude está além da região coberta, o algoritmo **interrompe a operação** e informa a estaca, evitando resultados de volume incompletos.

### Matemática e incertezas

Na seção transversal, `d(u) = Z_projeto(u) − Z_terreno(u)`. A área `d(u)>0` é **aterro** e `d(u)<0` é **corte**. Integração numérica por trapézios com divisão exata da mudança de sinal, utilizando passo lateral configurável. Os taludes são retas 2D com inclinação 1/H em cada lado da plataforma, com encontro calculado por bisseção. O volume do segmento longitudinal é `V ≈ (A_i + A_{i+1}) · Δs / 2` para corte e aterro separadamente.

Não há modelagem de solo vegetal, rocha, dispositivos hidráulicos, camadas do pavimento, drenagem, bermas, escavações especiais, expansão de material, perdas, compactação, fatores de transporte, empréstimos/bota-fora ou cálculo de diagrama de massas. A superfície TIN é apenas um interpolador linear; a acurácia e densidade dos pontos determinam a validade da representação. A malha raster é interpolada bilinearmente e rejeita células sem dados.

Limitações: cálculo em seções horizontais perpendiculares ao eixo, separação em estacas uniformemente amostradas, não calcula interseções de corredores de múltiplas vias, não identifica sobreposições de taludes, sem otimização geotécnica ou conformidade normativa automática. O desenho do eixo OSM é aproximado. Para áreas extensas, reprojete e prepare o MDT fora da aplicação.

## Persistência e compatibilidade

O JSON exportado usa `roadworks-swept-path/0.9`, incluindo parâmetros v0.1–v0.7, metadados da fonte do terreno e resumo dos volumes. **O MDT completo NÃO é embutido no projeto JSON** devido à dimensão e origem dos dados: **importe novamente o arquivo do terreno ao reabrir** e recalcule os volumes. A importação aceita esquemas anteriores desde v0.1. Os `*.obj` usam coordenadas locais X/Y/Z em metros, diferentemente da disposição dos eixos na renderização Three.js (X, Z, -Y).

## Estrutura nova

- `src/terrain.mjs`: grade raster bilinear, importação GeoTIFF com adaptador de CRS, TIN Delaunay, interpolação baricêntrica e conversão XYZ.
- `src/earthworks.mjs`: encontro de taludes com terreno, áreas de corte/aterro, volume por áreas médias, CSV e OBJ.
- `src/visualizer.mjs`: superfície 3D natural e taludes com o corredor 3D.
- `tests/terrain.test.mjs`, `tests/earthworks.test.mjs`, `tests/interface-v09.test.mjs`: testes de dados, casos analíticos, restrições e integração estática.
- `samples/terreno_FICTICIO_local_xyz.csv`: exemplo **sintético** para fins de testes, nunca um MDT real.

## Materiais utilizados como referências de funcionalidades

- Esri, *ArcGIS CityEngine 2022.1 Online Help* (2022): terrain layers, georeferencing, street graph, procedural rules, terrain/shape alignment.
- Bentley, *OpenRoads Designer CONNECT Edition Product Data Sheet* (2017): template/corridor, dynamic cross-sections, earthwork quantities.
- Autodesk, *Civil 3D 2023 Country Kit Brasil*: perfis, seções, volumes e configuração de projeto.
- DNER/DNIT IPR 706; DNIT IPR 740; AASHTO Green Book 7ª edição: referências para **futura verificação normativa**, não regras homologadas implementadas nesta versão.

Não são copiadas regras nem bibliotecas proprietárias desses fornecedores.

---

# RoadWorks v1.0 — Gêmeo geométrico preliminar (OSM/GeoJSON + evidências de levantamento)

Este incremento experimental **não implementa ainda um gêmeo digital bidirecional em tempo real**, tampouco uma rede treinada para segmentar nuvens LiDAR. Ele implementa a **camada geométrica e documental inicial**, equivalente a um *Digital Model* com histórico local de inspeções. Não confunda largura derivada da classe viária com largura levantada em campo.

## Identificar e desenhar vias de uma região

1. Inicie o servidor web e escolha a região na caixa `Buscar cidade / endereço`.
2. Aproxime o mapa até um trecho de aproximadamente 3 km e clique em **Vias OSM (mapa visível)**. O navegador consulta Overpass; isso requer Internet e está sujeito à disponibilidade/limites do serviço público.
3. Abra **09 / Gêmeo digital geométrico**, clique **Identificar e desenhar vias do OSM carregado**. Os polígonos coloridos são **envelopes aproximados** calculados a partir dos eixos e de larguras declaradas ou estimadas; a aplicação preserva referência `way/id`, categoria e data de importação.
4. Selecione um ativo na lista para abrir seu eixo no editor CAD anterior. Isso permite continuar com simulação veicular, greide, seções, terreno e corredor 3D. **O modelo de plataforma utilizado pelas análises anteriores permanece independente do envelope cartográfico até a definição manual dos parâmetros da seção**.
5. Como alternativa, importe um GeoJSON com `LineString` ou `MultiLineString` e atributos opcionais `highway`, `name`, `lanes`, `width`. O arquivo `samples/twin_eixos_FICTICIOS.geojson` serve somente para teste.
6. Registre o estado `pendente`, `verificado`, `revisar` ou `interditado`, acompanhado de uma observação de vistoria. A validação é uma declaração **manual** do operador, não uma homologação automática.
7. Exporte **GeoJSON 2D** para superfícies e eixos, ou **Inventário JSON** com atributos, proveniência e histórico local das revisões. O `Projeto JSON` do RoadWorks v1.0 incorpora esse inventário. Não contém fotografias nem arquivos LiDAR completos.

### Pontos de pavimento previamente classificados (opcional)

Com um ativo selecionado, carregue CSV com colunas `longitude,latitude,z,class`, sendo `class` um dos valores `road`, `pavement`, `asphalt`, `pista`, `pavimento`, `faixa`. São pontos **já classificados**, com coordenadas geográficas EPSG:4326 (longitude e latitude em graus decimais), cotas em metros e rótulos produzidos externamente. O programa NÃO executa PointNet++/RANSAC nem reconhece sozinho o pavimento em uma nuvem não classificada.

O algoritmo associa as amostras ao trecho de eixo mais próximo, mede os afastamentos transversais em coordenadas locais, utiliza quantis P10/P90 para reduzir o efeito de extremos e rejeita casos com menos de 20 amostras, sem pontos dos dois lados, ou menos de 35% de cobertura longitudinal. A largura calculada é um **indicador exploratório**. Ao clicar *Redesenhar largura medida*, a superfície aproximada é recalculada e o ativo recebe o estado **revisar**. Para uso de engenharia, compare o resultado com levantamento e inspeção humana, especialmente em curvas, interseções e trechos com canteiro central.

CSV de teste: `samples/twin_pontos_FICTICIOS.csv`, gerado sinteticamente; não representa estrada real.

### Referências científicas fornecidas pelo usuário

- Davletshina, D.; Reja, V. K.; Brilakis, I. (2024). *Automating construction of road digital twin geometry using context and location aware segmentation*. Automation in Construction 168, 105795. DOI: `10.1016/j.autcon.2024.105795`. Inspira o pipeline proposto de aquisição, pré-processamento, segmentação por contexto/localização e reconstrução; **os modelos neurais e meshing semântico descritos nesse artigo não estão implementados aqui**.
- Vona, F. et al. (2025). *User-Centric Evaluation Methods for Digital Twin Applications in Extended Reality*. arXiv:2502.17346v1. Inspira a criação de inventário revisável, inspeções humanas e futura avaliação de interface; **AR/VR não estão implementados**.
- Iranshahi, K. et al. (2025). *Digital twins: Recent advances and future directions in engineering fields*. Intelligent Systems with Applications 26, 200516. DOI: `10.1016/j.iswa.2025.200516`. A distinção entre Digital Model, Digital Shadow e Digital Twin justifica rotular esta entrega como **gêmeo geométrico preliminar / modelo digital**, sem alegar sincronização automática.

### Limitações e próximos módulos

- OSM e eixos GeoJSON não especificam com precisão os bordos de pavimento, o posicionamento de meio-fios, as marcas rodoviárias, os parâmetros normativos, o relevo ou o número real de faixas. Não há cadastro completo de placas, barreiras e drenagem.
- Ainda faltam importação de nuvem LiDAR `LAS/LAZ/PLY`, segmentação semântica treinada e validada em dados brasileiros, extração automática de bordos de pista de ortofotos, reconstrução 3D de mobiliário rodoviário, sensor/IoT, atualização temporal externa, comparação entre inspeções e governança de usuários.
- A identificação atual prioriza **eixos viários existentes nos dados** em vez de descoberta independente de estradas inteiramente ausentes no OSM. Não inferir resultados de digital twin em tempo real a partir de cartografia estática.
- Para uso profissional: empregar pontos topográficos verificados, datum e CRS corretos, metadados da coleta, revisão humana e regras DNIT/AASHTO implementadas e auditadas.

## Testes

`node --test tests/*.test.mjs` executa os testes anteriores e os novos testes para importação de eixos, geometria de envelopes, rastreabilidade, histórico de inspeções, associação de nuvens pré-classificadas, falhas de cobertura e integração estática da interface.

---

## RoadWorks v1.1 — OCR assistivo, componentes procedurais e início da segmentação neural

### Recursos adicionados

1. **Identificar ruas da janela atual (OSM):** na seção 10, primeiro carregue `Vias OSM (mapa visível)`; depois use `Identificar ruas da janela atual (OSM)`. O código consulta os segmentos vetoriais já carregados, testa interseção com o retângulo visível e deduplica nomes. OSM é a referência primária; nomes, faixas, curvas e posições **não são reconhecidos por OCR** nesta operação. Clique num nome para carregar o eixo e editá-lo em 2D/3D com o corredor das versões anteriores. O desenho da plataforma é uma estimativa, **não** uma geometria real extraída da imagem.
2. **OCR auxiliar de captura PNG/JPG:** faça uma captura do **mapa visível** (Windows: `Win + Shift + S`), sem redimensionar, arrastar o mapa ou trocar o zoom depois; carregue o arquivo na seção 10 e clique em OCR. O Tesseract.js (`por+eng`, carregado via CDN) sugere palavras e posições aproximadas. **Não reconstrói ruas 3D, não mede alturas, não diferencia linhas de pista ou calçadas, e não substitui OSM ou levantamento.** OCR com baixo contraste e rótulos inclinados pode falhar. OCR não envia uma captura para APIs proprietárias neste código, mas a biblioteca/idiomas precisam ser carregados da Internet.
3. **Biblioteca procedural de componentes:** seção 11, escolha entre `Reta`, `Curva com transições`, `Curvas reversas` e `Acesso com transição`. Escolha comprimento, raio, comprimento de transição e sentido. Clique em `Âncora CAD`, posicione-a no mapa, e use `Adicionar ao CAD`. A saída são segmentos paramétricos nativos editáveis. `Exportar receita JSON` registra os parâmetros. Não são perfis normativos certificados e não realizam solução de restrições globais entre interseções ou terreno.
4. **Segmentação de imagens:** seção 12, carregue PNG/JPG da ortofoto ou uma captura. O `Baseline por cor` destaca regiões acinzentadas e **não usa rede neural**. É um verificador da interface, com muitos falsos positivos esperados. Uma imagem sintética em `samples/imagem_aerea_FICTICIA_demo.png` permite testar a interface sem nenhuma imagem real.
5. **Segmentação ONNX (neural de verdade, com modelo próprio):** selecione `Rede neural ONNX`, forneça um **arquivo .onnx já treinado** para identificação pixel a pixel da classe de pavimento, selecione o índice dessa classe e a resolução 256/512 e execute. O adaptador usa ONNX Runtime Web (CDN), espera um tensor de entrada `float32 [1,3,H,W]` e um mapa de logits `float32 [1,C,H,W]`, com normalização RGB média `[.485,.456,.406]` e desvio `[.229,.224,.225]`. Os **pesos de rede neural não acompanham a entrega** e a exatidão dependerá de treino e alinhamento do pré-processamento. Arquiteturas que usam outros tensores, normalização ou pós-processamento exigem adaptar o módulo `src/image-segmentation.mjs`.
6. **Exportar máscara PNG e GeoJSON:** PNG é uma máscara raster em pixels; GeoJSON corresponde a células aproximadas somente se o usuário declarar que a imagem corresponde exatamente à janela do mapa **no instante da inferência**. Reprojeção e ortorretificação verdadeira de imagens aéreas externas exigem os respectivos metadados, como GeoTIFF e GCPs. A exportação não insere automaticamente os polígonos no projeto CAD, pois eles devem ser revisados.

### Arquitetura

- `src/procedural.mjs`: biblioteca e geração de alinhamentos CAD determinísticos.
- `src/map-recognition.mjs`: identificação vetorial no retângulo visível, nomes de ruas e associação aproximada de rótulos OCR.
- `src/image-segmentation.mjs`: baseline não neural, normalização tensorial, pós-processamento ONNX para classe de interesse, máscaras e GeoJSON.
- `src/app.mjs`: conexão de controles com os módulos, importação de imagens, exportação e interface.
- `tests/procedural-v11.test.mjs`, `tests/recognition-v11.test.mjs`, `tests/segmentation-v11.test.mjs`: novos testes de regressão.

### Verificação

```powershell
cd E:\bc_niteroi_rj\infraworks\roadworks_swept_path
node --test tests/*.test.mjs
python -m http.server 8080
```

Total verificado neste pacote: **147 testes aprovados** (128 anteriores, 19 novos). Sintaxe `.mjs`, IDs referenciados e estrutura ZIP verificados. A interface completa no Chromium não foi validada neste ambiente, que bloqueou `127.0.0.1`; repetir o teste no Windows com acesso às CDNs de Leaflet, Tesseract e ONNX Runtime.

### Restrições e próximo trabalho científico

Nenhuma segmentação automática treinada com dados brasileiros foi incluída. Para obter um modelo plug-and-play, será preciso treinar/validar um SegFormer ou U-Net em ortofotos licenciadas, exportar para ONNX com a mesma normalização e criar validação de IoU por classe. Para LiDAR, LAS/LAZ, PointNet++ e reconstrução 3D semântica são **módulos futuros**. O artigo de Davletshina, Reja e Brilakis (2024), *Automation in Construction*, DOI: 10.1016/j.autcon.2024.105795, embasa a direção de segmentação contextual e por localização; suas métricas **não** devem ser atribuídas ao RoadWorks.

**Classificação:** o RoadWorks v1.1 contém modelo geográfico e simulação, ainda não um Digital Twin operacional com sensores sincronizados em tempo real. Toda geometria automaticamente inferida precisa de vistoria e validação de engenharia antes de aplicação executiva.

---

## v1.2 — Usabilidade, visibilidade e revisão preliminar de engenharia

### Organização da interface

A navegação agora apresenta um fluxo guiado na parte superior do editor: **Mapear → Desenhar → Greide → Modelar 3D → Revisar**. Os painéis de configuração podem ser recolhidos para reduzir a rolagem. A seção **16 / Revisão de Engenharia** reúne os pré-requisitos, os parâmetros, o resultado, os alertas por criticidade e as exportações. A aba de resultados à direita também fornece um atalho direto para a revisão.

**Greide inválido:** clique em **Diagnosticar pré-requisitos**. Se houver PVIs incompatíveis com a extensão do traçado, o botão **Reiniciar greide inválido** permite remover os PVIs e definir a rampa inicial como 0%; isto altera o projeto e exige conferência da cota.

### Motor v1.2 (src/engineering-review.mjs)

1. **Visibilidade longitudinal:** calcula uma reta entre observador no greide e alvo, com alturas, alcance e passo informados pelo usuário; amostra o greide e, quando disponível, o MDT. Obstruções são alertadas e marcadas na planta. A verificação não contempla geometria ocular lateral, veículos em movimento, obstruções 3D de edificações, defensas nem o efeito da curvatura horizontal na visibilidade lateral.
2. **Distância de parada teórica:** usa `v*t + v²/(2*a)` para `v` em m/s, tempo de reação `t` e desaceleração `a` configuráveis. É uma aproximação em pista plana, NÃO um critério normativo extraído automaticamente das tabelas DNIT/AASHTO. Quando o alcance escolhido é menor que a distância teórica, o resultado é **dado insuficiente**, não aprovação.
3. **Interferências:** importa pontos GeoJSON com `radius_m` ou `raio_m` e polígonos, compara a projeção horizontal desses objetos com o corredor geométrico e mostra alertas críticos. Trata-se de **colisão 2D em planta**, que não comprova interferência volumétrica em túneis, viadutos ou pontes. Alturas importadas são preservadas como atributos, não utilizadas na colisão espacial desta versão.
4. **Raios e curvatura:** reutiliza `alignmentRules` do CAD, incluindo comparação com raio teórico em função da velocidade, superelevação e atrito fornecidos. Só se aplica a segmentos CAD paramétricos. Vias OSM/manual recebem estado indeterminado.
5. **Envelope veicular:** incorpora o resultado da simulação anterior, se existente. Não executar a simulação gera alerta de dados ausentes.
6. **Exportação:** `roadworks_revisao_v12.json` inclui parâmetros, alertas, fontes e amostras; `roadworks_alertas_v12.csv` contém severidade, código, estaca, descrição e fonte. Os projetos passam a salvar com o schema `roadworks-swept-path/1.2`, aceitando a importação dos schemas anteriores.

### Procedimento de teste

```powershell
cd E:\bc_niteroi_rj\infraworks\roadworks_swept_path
node --test tests/*.test.mjs
python -m http.server 8080
```

Acesse `http://localhost:8080`. Carregue **Trecho reto (laboratório)**; clique em **5 · Revisar**, configure alcance 60 m e **Analisar visibilidade e conflitos**. Confira os alertas de ausência de MDT e de simulação, sem presumir conformidade. Depois carregue **Terreno fictício** (módulo 07) ou um MDT real, recalcule e compare. Para obstáculos, importe um GeoJSON em EPSG:4326 com pontos/polígonos; selecione um novo eixo antes de importar os obstáculos para manter o referencial.

### Limites e base bibliográfica

A revisão NÃO constitui certificação de conformidade DNIT ou AASHTO. O raio mínimo, a visibilidade e o afastamento são estimativas feitas com valores escolhidos pelo usuário. Para projetos reais, confirme edições vigentes dos manuais, classe da via, projeto geométrico, greide, precisão dos pontos, datum horizontal/vertical, requisitos de segurança, resultados de campo e responsabilização técnica.

**Documentos utilizados como referências conceituais e de escopo, sem copiar código nem templates proprietários:**
- *OpenRoads Designer* (Bentley), folheto técnico, pp. 1–3: `Design Intent`, vistas dinâmicas, análise visual de visibilidade, interferências e relatórios.
- *Autodesk Civil 3D 2023 — Country Kit Brasil*, documentação dos critérios de projeto e de componentes de corredor: parametrização e rastreabilidade de configurações.
- *Manual de Projeto Geométrico de Rodovias Rurais*, DNER 706 (1999): referências para revisar critérios geométricos e visibilidade.
- *Manual de Projeto Geométrico de Travessias Urbanas*, DNIT IPR 740 (2010): veículo de projeto, raios, superelevação e condições urbanas.
- *A Policy on Geometric Design of Highways and Streets*, AASHTO Green Book (2018): critérios complementares de visibilidade e projeto.

**Atenção:** a vista 3D utiliza geometria de projeto e MDT quando importado. Isso não representa automaticamente um gêmeo digital bidirecional ou reconstrução `as-built`.

### Revisão adicional de rampa e largura de faixa (v1.2)

O projetista pode indicar uma **rampa máxima admissível** e uma **largura mínima por faixa** para gerar advertências preliminares. Esses limites são informados pelo usuário, pois valores DNIT/AASHTO dependem da classe de via, velocidade, relevo, edição do manual e condições de projeto. A implementação não declara conformidade normativa automática.

---

## RoadWorks v1.5: SQLite e gerenciador de projetos

A v1.5 adiciona persistência local por SQLite através de uma API FastAPI no mesmo domínio da interface. A aplicação antiga executada em `python -m http.server 8080` **não salva no banco**: execute a API.

### Instalação no Windows (PowerShell)

```powershell
cd E:\bc_niteroi_rj\infraworks\roadworks_swept_path
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn tools.api:app --host 127.0.0.1 --port 8000
```

Acesse **http://127.0.0.1:8000**. O arquivo SQLite será criado em `../roadworks_data/roadworks.db` (pasta irmã do projeto) no primeiro acesso; backups devem copiar o banco (preferencialmente usando o recurso de backup SQLite enquanto estiver aberto). A pasta `roadworks_data/` fica **fora da raiz servida por HTTP** e não deve ser versionada no Git.

No painel **16 / Projetos · SQLite**, clique **Salvar revisão** após desenhar/importar uma via. O salvamento automático (ativado por padrão) compara o estado a cada 20 segundos e cria uma revisão somente quando há alterações; somente funciona com a página aberta. Utilize **Atualizar lista**, **Abrir**, **Histórico** ou **Salvar como cópia**. **Arquivar análises** registra resumo de engenharia, preview de tráfego, resultados SUMO importados e volumes preliminares, quando presentes.

O navegador usa `localStorage` apenas para lembrar o identificador do último projeto; o snapshot completo permanece no SQLite. O SQLite utiliza transações, WAL e hash SHA-256 por revisão, e rejeita projetos inválidos ou com mais de 8 MB. Restaurar um histórico não apaga revisões; salvar cria outra revisão.

**Importante:** GeoTIFF, LiDAR e malhas 3D não ficam embutidos no snapshot do projeto. Reimporte-os quando restaurar. A API também expõe `/api/projects/{id}/assets` para registrar metadados e hashes dos arquivos externos, e `/api/projects/{id}/runs` para resultados de análises. Isso não faz upload automático dos arquivos. Os resultados de análises só são arquivados quando o usuário clica no comando correspondente.

### Testes

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tools -p "test_*.py" -v
```

### Comparação de interface com Cities: Skylines

O manual de Cities: Skylines descreve criação de ruas por clique no ponto inicial, prévia do segmento enquanto se arrasta o cursor e confirmação do traçado. É um bom padrão de usabilidade (feedback visual imediato, ferramentas acessíveis e seleção contextual), mas **não substitui critérios técnicos de CAD rodoviário**. A v1.5 priorizou salvar projetos e versões antes de introduzir esse modo de desenho em tempo real; não representa uma implementação do motor de construção do jogo. O vídeo indicado pelo usuário não pôde ser verificado diretamente, portanto não atribuí a ele operações específicas.

---

## RoadWorks v1.6 — Engenharia de tráfego, hierarquia de vias e comparação de cenários

Esta atualização **preserva** os módulos 0.1–1.5, a API FastAPI e o SQLite, e acrescenta o painel **19 / Engenharia de tráfego** e o atalho **8 · Engenharia de tráfego** na navegação.

### O que foi acrescentado

1. **Triagem da rede OSM carregada**: classifica `highway=*` em proxies de via expressa, rodovia, arterial, coletora ou local; lê `lanes`, `oneway` e `maxspeed` se estiverem declarados; conta extremos de polilinhas próximos como *candidatos* a conexão. **Nunca** considera uma tipologia OSM automaticamente igual à classificação funcional formal do DNIT, DNER ou do município. Viadutos, túneis e passagens em diferentes níveis não são resolvidos por proximidade espacial.
2. **Redução de faixas e volume/capacidade**: compara quantidade de faixas de entrada e saída, demanda por hora, capacidade por faixa, proporção de pesados e tempo verde efetivo; informa excesso de demanda e relação volume/capacidade. É triagem uniforme, não procedimento HCM certificado.
3. **Cenários de controle de cruzamentos**: calcula capacidades aproximadas com fatores ajustáveis para semáforo, PARE, preferência e rotatória, incorporando uma penalidade teórica por travessias de pedestres. Os fatores são *hipóteses* da simulação, não avaliações automáticas de segurança. Não recomenda remover semáforos sem estudo.
4. **Movimentos permitidos por faixa**: inclui duas faixas demonstrativas com manobras configuráveis. Marca condições em que a mesma faixa combina conversão e fluxo reto e exige revisão. Não representa ainda um conector 3D individual nem as fases semafóricas.
5. **Transporte coletivo e pesados**: contabiliza veículos, passageiros transportados por ônibus e automóveis segundo ocupações configuráveis e veículos equivalentes segundo fator simplificado. Transporte público não é tratado apenas como automóveis adicionais.
6. **Obras, desvios e alternativas**: reaproveita o modelo agregado v1.4 com interdições, capacidade relativa e desvio percentual *abstrato*; compara fila máxima, atraso médio e veículos não atendidos. Para microssimulação de verdade, exporte um cenário do módulo 18 e execute o **SUMO**. A geração existente permanece baseada em duas rotas sintéticas; este painel não transforma dados OSM em rede SUMO automaticamente.
7. **Rastreabilidade**: até 25 resultados do painel são associados ao documento do projeto (`trafficEngineeringV16`) no JSON e SQLite. Clique em **Salvar revisão** para persistir o projeto. Clique em **Arquivar análises e resultados no SQLite** para criar um registro independente de execução (`traffic_engineering`). Arquivos CSV e JSON de comparação podem ser exportados localmente.

### Uso recomendado

1. Inicie FastAPI e abra `http://127.0.0.1:8000`.
2. Clique **Vias OSM (mapa visível)** após aproximar o mapa a uma região pequena.
3. No painel **19 / Engenharia de tráfego**, clique **Classificar vias OSM carregadas** e confira as classes, número de faixas e velocidades que estavam efetivamente declaradas no OSM.
4. No exemplo de gargalo, use 3 faixas de entrada, 2 de saída, demanda de 2.800 veíc./h e capacidade base de 1.500 veíc./h por faixa. Ajuste pesados, pedestres, ônibus, manobras e o controle da interseção.
5. Configure um cenário com interdição de faixa e percentual teórico de desvio, clique **Analisar e registrar cenário** e consulte o histórico. Repita com outro nome/parâmetros e exporte CSV/JSON.
6. Salve o projeto no SQLite. Para guardar a análise em uma tabela de execuções, clique em **Arquivar análises e resultados no SQLite**.

### Restrições e parâmetros

- A relação V/C é `demanda / capacidade estimada`. A capacidade calculada usa fator de pesados e, opcionalmente, fração verde; não avalia distribuição horária, comprimento de ciclo, saturação por movimento, filas com spillback ou impactos de estacionamentos.
- A análise de cruzamentos usa fatores simplificados e **não calcula** tempos de atraso por interseção com métodos HCM ou SUMO nem avalia segurança de pedestres e ciclistas.
- Não há ainda modelo origem–destino em rede OSM, atribuição dinâmica de rotas, acesso industrial georreferenciado, acessos comerciais reais, geração de rotatórias em CAD, proibição real de manobras em SUMO, ou microssimulação calibrada da cidade. Esses recursos necessitam malha topológica, parâmetros de controle e dados de pesquisa de campo.
- O registro SQLite é local, sem mecanismo multiusuário. Os dados do OSM são observacionais, podendo estar incompletos. Respeite os termos de uso de tiles e Overpass.
- Algumas ações (alterações de projeto e vias, carga de imagens, consultas a mapas) devem ser verificadas visualmente no Windows. A suíte automatizada não substitui homologação de engenharia.

### Validação

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tools -p "test_*.py" -v
```

### Referências e fundamentos

O fluxo funcional de hierarquia viária, redução de faixas, interseções, pedestres, transporte público e movimentos por faixa decorre da transcrição de *Cities: Skylines* fornecida pelo usuário. A transcrição é uma **inspiração de interface** e não fonte de critérios de capacidade, projeto ou segurança de engenharia. Verificar as prescrições aplicáveis do DNIT, manual de projeto urbano e normas locais antes de adotar intervenções reais.
