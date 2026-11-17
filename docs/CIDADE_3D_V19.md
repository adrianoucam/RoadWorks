# Cidade e terreno 3D — RoadWorks v1.9

## Usar a nova vista

Inicie com `Iniciar_RoadWorks.cmd`. Abra **9 · Mobilidade urbana** e carregue o recorte OSM de Niterói, outra rede OSM ou um estudo urbano. Depois clique **11 · Cidade 3D** ou escolha **Rede urbana + terreno 3D** no seletor de visualização.

A nova vista é independente da **Vista 3D do corredor**, que continua disponível com o editor geométrico, perfil, veículo e obras legados. O modo de cidade mostra a rede do estudo urbano; não transforma automaticamente o eixo CAD selecionado em uma rede urbana.

Sem terreno importado, a rede aparece no plano de referência `z=0`. Isso é uma convenção de visualização, não altitude real da cidade. O recorte OSM não contém um levantamento altimétrico.

## Recursos

- Superfícies das vias em metros, por número de faixas, com largura visual configurável. Valor inicial de **3,2 m/faixa é hipótese**, não largura levantada.
- Separação lateral dos sentidos opostos que compartilham o mesmo eixo/nós e ID de via OSM. IDs e conectividade do estudo de tráfego são preservados.
- Amostragem das vias sobre o terreno, inclusive nas duas bordas. A aparência acompanha a superfície, mas não constitui projeto de greide, seção, pavimento ou cruzamentos.
- Clique nas superfícies para selecionar o trecho e sincronizar o formulário urbano. O trecho selecionado recebe destaque ciano.
- Marcações e setas esquemáticas de sentido; nomes de vias opcionais, com limite de rótulos e prevenção de sobreposição.
- Camadas de vias, terreno, inventário e nomes; malha de terreno e exagero vertical visual de 1 a 5 vezes.
- Filas máximas da última comparação exibidas por cor; são indicadores agregados e não veículos animados nem medidas instantâneas.
- Acidentes e obras destacados conforme o instante do controle em segundos. Não há atualização com sensores.
- Inventário representado por ícones, sem fabricar modelos ou alturas levantadas de ativos.
- Exportação OBJ das vias e do terreno visíveis. Ícones de inventário não são incluídos nessa exportação.

## Navegação

Arraste para orbitar. Use Shift+arraste ou botão direito para deslocar a câmera. A roda altera o zoom. Clique para selecionar e dê duplo clique ou use **Enquadrar rede e terreno** para voltar ao enquadramento geral.

Na vista de cidade, o painel de perfil/seção é recolhido para liberar espaço; ele continua acessível por **Expandir**. Seus valores pertencem ao eixo geométrico selecionado, não a todos os trechos da cidade. Alterar o exagero vertical só afeta a aparência da cidade 3D; não altera cotas, declividades, arquivos OBJ ou simulações.

## Importar terreno

No painel **22 / Cidade e terreno 3D**, abra **Importar terreno georreferenciado**.

### XYZ/CSV

São aceitos até 2.000 pontos e arquivos de até 30 MB. Informe três colunas numéricas, separadas por ponto e vírgula, espaço, tabulação ou vírgula, usando ponto como separador decimal:

- **Longitude; latitude; cota**: posições em WGS84 e cotas em metros. O programa converte as posições ao plano local da origem informada.
- **XY local; cota**: X e Y em metros em relação à latitude/longitude da origem cadastrada. Coordenadas UTM absolutas não devem ser importadas como XY local; transforme os dados antes ou use GeoTIFF com EPSG.

Informe o datum vertical/procedência declarada. O programa não transforma datums verticais automaticamente e não consegue certificar a fonte de um arquivo pelo nome.

Os pontos são triangulados como TIN. Regiões dentro do fecho convexo são interpoladas; fora dele, não há cobertura. Uma amostra de três pontos não descreve todo o relevo de uma cidade. Revise densidade, extensão e precisão antes de interpretar a superfície.

### GeoTIFF MDT

Use um raster de elevação com EPSG identificado, transformação north-up suportada e até quatro milhões de células. A biblioteca existente trata CRS conhecidos; códigos não cadastrados exigem reprojeção prévia. Os valores do raster são tratados como metros: confira unidade, datum, NoData e se o arquivo é realmente MDT, não uma imagem RGB ou modelo de topo de edifícios.

Lacunas/NoData não recebem cotas inventadas. Trechos de superfície sem cobertura nas amostras de centro/bordas são omitidos e o painel informa quantas amostras faltam. O terreno do painel geométrico pode ser reutilizado com sua origem original, sem reinterpretar seus metros em outra âncora.

### Demonstração

**Criar terreno FICTÍCIO para demonstração** gera uma superfície sintética cobrindo a rede atual, para conhecer o funcionamento. A indicação de terreno fictício permanece no painel e na própria cena. Essa superfície não representa topografia de Niterói.

## Pontes, túneis e alturas

Tags `layer`, `bridge` e `tunnel` são preservadas, mas não convertidas em alturas. Uma ponte com `layer=2` não recebe automaticamente 2 m ou 10 m de elevação. Sem cotas/offset informados, esses trechos são marcados como de geometria vertical desconhecida e representados esquematicamente no plano de referência; com terreno visível, podem ficar ocultos por ele.

O campo **Altura relativa ao terreno** aceita um offset explícito do usuário, de −500 a +500 m. Ele continua sendo uma configuração, não uma medição. No JSON, `visualGeometry.elevationM` pode definir uma cota constante explícita; quando usada, confira o datum. Não são geradas estruturas de pontes, escavações, portais de túneis ou concordâncias verticais automaticamente.

## Salvar e exportar

O snapshot do projeto completo inclui a extensão opcional `urbanSceneV19`, com camadas, resolução, instante, exagero, seleção, parâmetros de importação e uma prévia reduzida do terreno com sua origem. Projetos anteriores permanecem aceitos; não houve renomeação de schemas/tabelas legados.

Salve pelo SQLite ou **Projeto JSON**. A exportação de estudo urbano isolado continua contendo rede e demanda, sem o terreno da cidade. A prévia reduzida tem limite de 2 MB e o projeto completo mantém 8 MB. Grades grandes são amostradas para a visualização; reimporte o arquivo original para engenharia ou volumes.

Na restauração, as faces da prévia são mantidas, preservando lacunas. A interpolação da malha triangular pode diferir da bilinear do raster original entre os vértices. O painel identifica que o terreno restaurado é uma prévia. Ele não substitui o arquivo fonte ou um backup do levantamento.

O OBJ exporta X leste, Y norte e Z elevação, em metros, sem o exagero vertical da tela. O cabeçalho registra a latitude/longitude da origem WGS84. O sistema XY local é uma aproximação adequada apenas a áreas limitadas; o arquivo não declara transformação UTM nem conformidade de engenharia.

## Limites e compatibilidade

A rede mantém os limites de 2.000 nós/4.000 trechos. A cena limita o detalhamento a 60.000 seções e 512 divisões por trecho, com espaçamento configurável entre 5 e 100 m. Não há carregamento de cidade inteira em nível de edifícios, textura aérea, streaming de tiles 3D, edição BIM ou interseções pavimentadas completas. Three.js é carregado pela CDN já utilizada no projeto; a vista exige WebGL disponível.

O erro **Seção transversal inválida**, que fazia o perfil apresentar **Greide inválido**, foi corrigido: o `roadmodel` usa deslocamento negativo na borda direita e o cálculo de seção agora o interpreta como distância positiva. O ajuste não altera o greide cadastrado. Se PVIs ou curvas forem efetivamente inválidos, a validação continua sinalizando o problema.

Sensores, otimização automática de semáforos e extração de imagens/LiDAR não foram acrescentados.
