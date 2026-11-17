# Estudos e experimentos — RoadWorks 2.0

O painel **12 · Estudos** organiza experimentos de mobilidade em quatro etapas: preparar, verificar, simular e comparar. Os conceitos de organização vêm dos manuais de simulação fornecidos; o cálculo continua sendo o modelo de filas da rede viária. Não foi implementado um solver estrutural do SolidWorks.

## Começar

1. Inicie `Iniciar_RoadWorks.cmd` na raiz do projeto. O lançador escolhe uma porta livre e informa o endereço. Nesta instalação ele também reconhece o ambiente Python mantido em `roadworks_swept_path/.venv`.
2. Em **9 · Mobilidade urbana**, prepare a rede e cadastre demanda OD, faixas, capacidades, semáforos manuais e eventos. Para experimentar sem dados próprios, use **Novo exemplo fictício**. O recorte OSM de Niterói não possui demanda observada; cadastre-a antes de simular.
3. Abra **12 · Estudos** e clique em **Capturar rede atual como base**. A cópia é independente da rede corrente. Recapturar substitui essa base e invalida os resultados.
4. Selecione uma alternativa, ajuste suas propriedades e clique em **Aplicar propriedades**. **Descartar edição** recupera as propriedades aplicadas. A execução, exportação e gravação do projeto exigem resolver a edição pendente.
5. Clique em **Verificar** e leia erros e avisos. Depois, **Executar lote**. O cálculo roda em Worker e pode ser cancelado.
6. Compare concluídas, pendentes, filas e tempos. Use **Ampliar comparação e gráficos** para examinar as tabelas em uma janela maior. A primeira alternativa é sempre a referência dos deltas; **Usar como referência** muda a ordem e exige nova execução.
7. Exporte o estudo JSON, a comparação CSV ou o relatório HTML. **Salvar revisão** no painel SQLite guarda também o estudo. Ao importar/restaurar, as entradas voltam à tela e os resultados precisam ser recalculados; o JSON exportado conserva a evidência anterior.

## Alternativas

Existem três configurações iniciais: referência sem eventos, eventos cadastrados e demanda +25%. É possível duplicar e manter de 1 a 12 alternativas com nomes próprios.

| Propriedade | Efeito |
|---|---|
| Variação de demanda | Substitui o percentual global da base, entre −100% e +300%; não soma ao percentual global que estava na rede |
| Fator de capacidade | Multiplica capacidade por faixa em toda a rede ou no trecho indicado; não adiciona faixas nem muda armazenamento |
| Remover eventos | Remove acidentes/obras da alternativa; semáforos permanecem |
| Manter eventos | Preserva os eventos da base |
| Adicionar interdição | Mantém os eventos e acrescenta obra/acidente em um trecho, com intervalo em segundos e número de faixas fechadas |
| Horizonte | Duração opcional de 60 a 14.400 segundos; precisa ser compatível com os períodos OD e eventos |

Não há alteração implícita da rede desenhada ao executar o lote. **Carregar alternativa na rede** aplica explicitamente o documento compilado nos painéis de mobilidade e cidade 3D, invalidando suas análises anteriores. **Localizar trecho no mapa/3D** sincroniza a seleção. A camada de filas do 3D continua sendo a última comparação do painel de mobilidade; os resultados do lote são apresentados no painel de estudos e não são sobrepostos silenciosamente na cena.

## Solucionador, repetições e sondas

- **Chegadas regulares:** acumulador determinístico de volume por OD. Repetir com sementes diferentes produz o mesmo resultado.
- **Chegadas Poisson:** contagem aleatória em cada intervalo, usando a intensidade OD e os ajustes de demanda. Mesmas entradas e semente reproduzem a execução. Isso é uma hipótese de geração de viagens, não uma demanda medida.
- **Semente:** inteiro entre 0 e 4.294.967.295. Cada repetição usa a seguinte, com retorno a zero após o máximo. As alternativas usam a mesma lista de sementes, sem garantir que cada viajante corresponda entre alternativas.
- **Passo:** 0,5; 1 ou 2 segundos. A duração deve ser divisível pelo passo. Movimento entre trechos é preparado por passo para impedir que um veículo atravesse vários trechos na mesma atualização. Tempos de percurso são arredondados para o próximo passo. Eventos são avaliados no início dos passos e fronteiras fracionárias passam a valer no próximo passo. Semáforos são amostrados por passo; o refinamento pode modificar resultados.
- **Repetições:** de 1 a 5 por alternativa. Os indicadores são resumidos por mínimo, mediana e máximo entre execuções. Essa faixa não é intervalo de confiança; a mediana dos P95 não é o P95 de uma população combinada.
- **Sondas:** até 10 IDs de trechos existentes na base. Registram fila, PCU armazenados e saídas cumulativas a cada minuto e ao final. O botão de adição usa o trecho selecionado na rede atual, que precisa existir também na base congelada.

Os detalhes por trecho guardam os 20 maiores em fila máxima e quaisquer sondas adicionais. Gráficos, sondas e detalhes por trecho exibem **a primeira repetição**, com semente identificada; a comparação agregada usa todas. O gráfico mostra amostras de 60 segundos e pode não mostrar o pico calculado a cada passo.

## Indicadores e critérios

| Indicador | Definição |
|---|---|
| Conclusão (%) | Concluídas / ofertadas × 100; indeterminada quando nenhuma viagem foi ofertada |
| Pendentes | Viagens ainda na rede ou aguardando entrada ao terminar o horizonte |
| Fora da rede | Viagens ofertadas sem conseguir entrar; critério percentual refere-se ao **final** do horizonte |
| Fila máxima | Maior número simultâneo de veículos prontos aguardando em trechos, somado aos que aguardam entrada |
| Viagem P50/P95 | Percentil interpolado dos tempos entre oferta e conclusão, **somente de viagens concluídas** |
| Espera P95 | Percentil dos tempos de espera acumulada das viagens concluídas, incluindo espera para entrar |
| Fila acumulada | Integral temporal do total em fila, em veículos·hora |
| Vazão concluída | Concluídas × 3.600 / duração em segundos |
| Conservação | Ofertadas − concluídas − na rede − fora; deve ser zero |
| Delta à referência | Diferença entre medianas; o JSON também registra percentual quando a referência é diferente de zero |

Os tempos podem parecer favoráveis quando muitas viagens permanecem pendentes: leia esses indicadores juntos. Conclusão de 100% num horizonte longo não demonstra ausência de congestionamento. O escoamento após a demanda deve fazer parte do planejamento do experimento.

Os quatro critérios são limites operacionais informados pelo usuário: conclusão mínima, fila máxima, viagem P95 máxima e percentual final máximo fora da rede. O lote **atende** somente se todas as regras de todas as repetições atendem. Uma falha determina **não atende**. Se não existe falha, mas falta uma métrica, fica **indeterminado**. Não há classificação normativa automática.

## Convergência temporal

O botão compara a alternativa selecionada com chegadas regulares, passos de 2, 1 e 0,5 segundos. Examina concluídas, fila máxima, viagem P95 e fila acumulada. A variação usada é `100 × |a−b| / max(|a|, |b|, 1)`. O denominador mínimo 1 evita divisões por zero e define a escala para grandezas pequenas.

O status final considera a passagem de 1 para 0,5 segundo contra a tolerância informada. O relatório conserva também a passagem de 2 para 1 segundo. Resultado estável significa estabilidade apenas nesses passos, para o mesmo modelo. Não é validação de campo, estimativa rigorosa do erro nem convergência de malha de elementos finitos.

## Usabilidade e arquivos

**Ctrl+K** ou **Comandos** abre busca de painéis e ações: navegar, salvar revisão e abrir a cidade 3D. A cidade ganhou vistas superior, frontal e isométrica, além do enquadramento do trecho selecionado. As cotas continuam dependendo de MDT e dados reais; a câmera não altera geometria ou resultados.

O estudo usa schema `roadworks-study-workspace/2.0`; o projeto mantém `roadworks-swept-path/1.6`, com extensão opcional `studyWorkbenchV20`. Os schemas anteriores e as tabelas SQLite foram preservados. O lote registra data UTC, parâmetros, origem dos dados, sementes, critérios e hash SHA-256 das entradas. O hash identifica alterações; não certifica autenticidade, calibração ou qualidade dos dados. O HTML contém as entradas e a comparação completa, mas detalha sondas/trechos da alternativa selecionada. O CSV exporta a comparação de todas as alternativas e protege células textuais contra interpretação como fórmulas.

Limites adicionais: estudo JSON até 4 MB; projeto até 8 MB; orçamento do lote até 30 milhões de trechos × passos × repetições; até 30.000 viagens ofertadas por execução. O orçamento é uma proteção de custo, não uma previsão de tempo. Resultados inválidos ou execuções interrompidas não são aproveitados como lote concluído.

## Estrutura atual e execução

O código executável está na **raiz**: `index.html`, `style.css`, `src/`, `tools/`, `tests/`, `samples/`. A pasta histórica `roadworks_swept_path/` conserva materiais de desenvolvimento e o ambiente Python desta instalação. Seu iniciador encaminha ao iniciador da raiz.

Nesta instalação, o banco existente `roadworks_data/roadworks.db` da raiz foi preservado. Em uma distribuição sem a pasta histórica, o padrão continua sendo `../roadworks_data/roadworks.db`; `ROADWORKS_DB` permite indicar outro local. Pastas privadas, bancos e anexos ocultos não são servidos pela rota estática.

## Limites mantidos

Sem sensores, otimização automática de semáforos ou extração por imagens/LiDAR. O novo solucionador de estudos é mesoscópico; não incorpora mudança de faixa, redistribuição dinâmica de rotas em viagem, FEA, CFD, tensões, deformações ou dimensionamento estrutural. As opções novas não são convertidas automaticamente em configurações SUMO. Para microssimulação externa, carregue explicitamente a alternativa na rede e use o fluxo SUMO existente, conferindo os limites de tradução documentados em `URBAN_V17.md`.

Veja a [origem das propostas nos manuais](SOLIDWORKS_PROPOSTAS_V20.md) e o [registro de verificação](VALIDACAO_V20.md).
