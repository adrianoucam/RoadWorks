# RoadWorks 1.8: matemática e ML para uso local

## Começar em casa

Abra `Iniciar_RoadWorks.cmd` na pasta do projeto. O lançador usa `.venv/Scripts/python.exe` quando disponível, reaproveita uma instância v1.8 desta instalação e procura outra porta se a preferida estiver ocupada por outro programa ou versão. Não encerra processos existentes. O servidor permanece restrito a `127.0.0.1`, sem códigos de cor ANSI no terminal.

Se não houver ambiente instalado:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe tools/launch.py
```

Alternativa sem abrir navegador: `python tools/launch.py --no-browser`. Use `--port 8001` para iniciar a busca por outro número. `--probe-only` informa qual porta seria escolhida sem iniciar o servidor.

No aplicativo, abra **10 · Matemática e ML**. Os novos cálculos rodam localmente no navegador, em Workers canceláveis, sem adicionar NumPy, PyTorch, serviços pagos ou necessidade de GPU. Mapas/tiles, bibliotecas já utilizadas pelo aplicativo e consultas OSM continuam dependendo da rede; isso não é uma distribuição totalmente offline.

## O que foi acrescentado

| Função | Uso | Limitação |
|---|---|---|
| Sensibilidade | Varia demanda, capacidade e velocidade para os dois lados de uma referência; rede inteira ou OD/trecho escolhido | Diferenças finitas em sistema discreto, não derivadas exatas; patamares e saltos são possíveis |
| Calibração assistida | Sugere um fator global limitado para demanda, capacidade ou velocidade | Busca por coordenadas, sem garantia de ótimo global; não altera semáforos |
| Demanda histórica | Regressão ridge sazonal com hora e dia da semana; comparação com referência por hora | Uma série por área/classe; não considera eventos, feriados ou mudanças estruturais automaticamente |
| Ajuste OD | Estima taxas não negativas e opcionalmente respeita um total conhecido | Atribuição estática por rotas de tempo livre; não ajusta descarga de tráfego congestionado |
| PCA | Mostra padrões de variação entre cenários padronizados | Não mede importância causal, risco, segurança ou qualidade da intervenção |
| Desempenho | Cache de estados entre eventos, índice de adjacência e fila de prioridade no roteamento | Ganho depende da rede e dos cenários; não implica simulação municipal completa |

As técnicas seguem os fundamentos de mínimos quadrados, regularização, sensibilidade e PCA discutidos no material matemático fornecido pelo usuário. O código é implementação própria e não incorpora o PDF no pacote. Não foram implementados sensores, otimização automática de semáforos ou extração de imagens/LiDAR.

## Usar e conferir cada análise

### Sensibilidade

Cadastre o estudo no painel urbano, atualize a seleção e escolha a variação percentual. O resultado mostra fila com parâmetro reduzido/aumentado e mudança de fila por ponto percentual. A saída JSON contém também viagens concluídas, pendentes, tempo médio das concluídas e fila acumulada em veículos-segundo. Nenhum parâmetro é aplicado ao estudo por essa análise.

Há limite de 12 parâmetros e orçamento de 30 milhões de trechos × segundos × execuções. Reduza área, duração ou quantidade de parâmetros se necessário. Variações que excedem limites físicos cadastrados são rejeitadas, sem truncar silenciosamente os valores.

### Calibração assistida

Importe JSON com `source` (`observed`, `synthetic` ou `mixed`) e `observations`. Exemplo:

```json
{
  "source": "observed",
  "observations": [
    {"id":"dia1","period":"2026-11-10_pico","role":"fit","metric":"maxQueue","observed":120,"scale":100,"percent":0},
    {"id":"dia2","period":"2026-11-11_pico","role":"validation","metric":"maxQueue","observed":150,"scale":100,"percent":10}
  ]
}
```

Os valores desse trecho ilustram somente o formato; não constituem medições. `percent` é a variação global da demanda no cenário da observação; rede, eventos e duração vêm do estudo atual. As métricas disponíveis são `maxQueue`, `completed`, `pending`, `meanTravelSecondsCompleted` e `totalQueueVehicleSeconds`.

O erro de cada observação é dividido por `scale` antes de ser elevado ao quadrado; isso evita somar diretamente grandezas de unidades diferentes. Escolha escalas justificadas e preserve-as no relatório. Uma escala menor dá maior importância àquela observação. Não há ajuste automático dessas escalas.

Períodos de ajuste e validação precisam ser distintos. A busca só utiliza observações `fit`. A validação é avaliada depois de selecionar os parâmetros, sem dirigir a busca. A interface informa se houve melhora nos dois conjuntos. Repetir escolhas de parâmetros olhando sempre o mesmo teste deixa de ser validação independente; reserve dados adicionais para avaliação final.

O usuário precisa assegurar que a rede e os eventos representam os períodos comparados e que os dados são efetivamente independentes. O programa valida os identificadores declarados, não a procedência de levantamentos.

Salve uma revisão antes de clicar **Aplicar sugestão ao estudo**. Se o estudo mudar após o cálculo, a aplicação é recusada pelo SHA-256 da entrada. A sugestão não configura planos semafóricos e nunca altera o indicador para `calibrated: true`.

### Regressão de demanda

Formato de histórico:

```json
{
  "schema":"roadworks-demand-history/1.8",
  "source":"observed",
  "rows":[
    {"timestamp":"2026-11-10T08:00:00-03:00","demandVph":1200},
    {"timestamp":"2026-11-10T09:00:00-03:00","demandVph":1000}
  ]
}
```

Este fragmento ilustra o formato, mas não atende ao mínimo de 24 observações. Use uma única área/classe e a mesma unidade (veículos/hora) e fuso em toda a série. Datas inválidas, timestamps repetidos e mistura de fusos são rejeitados. Séries com maior cobertura de horários e dias permitem uma avaliação mais útil.

O histórico é ordenado pelo instante real. Os primeiros 75% treinam o modelo; os últimos 25% são o teste. A padronização utiliza somente o treino. O modelo usa seno/cosseno de hora e dia da semana e um intercepto. Ridge é resolvido com Householder QR no sistema aumentado, sem inverter `XᵀX`. O valor de regularização é escolhido pelo usuário, não otimizado no teste.

O teste mostra MAE/RMSE em veículos/hora e R² quando definido. A referência é a média da hora no treino, com média global para horas não vistas. O sistema informa quando o modelo não supera essa referência. Respostas de teste não entram nos coeficientes nem na padronização.

**Estimar demanda** usa o modelo treinado, não um novo ajuste ao histórico completo. Predições negativas são apresentadas como zero, preservando a previsão bruta no JSON. O sistema sinaliza atributos fora da faixa de treino; isso não é intervalo de confiança e não detecta toda mudança de regime. O padrão semanal não prova a validade de previsões muito distantes.

Aplicar uma estimativa exige selecionar uma OD correspondente à série. O sistema não consegue descobrir automaticamente se o histórico de um bairro representa uma OD específica. Não distribua um volume agregado como se fosse uma medição de cada par OD.

### Ajuste origem–destino

Importe `source`, `time` em segundos, `lambda` e `counts` com `edge` e `observedVph`. Um `total` opcional restringe a soma das taxas OD antes dos multiplicadores percentuais. O resultado usa somente OD ativas no instante escolhido e rotas disponíveis naquele instante. Não agrega automaticamente um período inteiro.

O solver minimiza erro das contagens mais penalização quadrática da distância ao prior atual. Usa gradiente projetado com caixa 0–30.000 veículos/h por OD e, quando fornecido, igualdade do total. São aceitas até 50 OD ativas e 100 contagens. O relatório mostra convergência, posto numérico e identificação. Se diferentes OD percorrem os mesmos trechos, as contagens podem não separá-las; nesse caso a regularização escolhe uma solução próxima ao prior sem criar informação nova.

### PCA

Use três ou mais comparações da mesma cidade ou uma matriz JSON com `rows`, `columns` e `labels`. São aceitos 2–20 indicadores e até 2.000 cenários. A padronização evita que a unidade de medida domine a análise. O algoritmo calcula componentes por rotações de Jacobi da covariância simétrica; o JSON inclui médias, escalas, componentes, autovalores e variância explicada.

O gráfico mostra PC1 e PC2 com identificação dos pontos. Proximidade sugere similaridade nos indicadores informados, não equivalência das intervenções. Se todos os cenários forem iguais, a análise é rejeitada por falta de variação.

## Exemplos, persistência e relatórios

**Carregar dados de demonstração FICTÍCIOS** preenche os quatro editores, sem trocar o estudo urbano atual. Os exemplos de calibração e OD correspondem à rede fictícia A–B–C. Para reproduzi-los, use também **Novo exemplo fictício** no painel urbano. Os exemplos não foram medidos em Niterói.

Resultados e entradas do painel ficam em `urbanV17.analysisV18`, uma extensão opcional do snapshot existente. Projetos antigos continuam aceitos. Não foram renomeados schemas legados nem alteradas tabelas do banco. Salve pelo painel SQLite ou pelo JSON do projeto completo para preservar as análises. **Exportar estudo JSON**, no painel urbano, continua exportando somente a rede/demanda; não inclui o workspace de análise.

Cada análise registra data, parâmetros, origem e hash do estudo. Exporte JSON ou relatório HTML. Preserve também uma revisão do projeto com esse hash para reproduzir os cálculos. Aplicações registram procedência em `analysisProvenance`; o parâmetro continua uma estimativa, não uma medição.

O workspace de análise tem limite de 2 MB e o projeto completo mantém o limite de 8 MB. Dados importados muito grandes precisam ser reduzidos ou arquivados separadamente. O arquivo de exemplo é `samples/analises_ML_FICTICIAS.json`.

## Alcance em relação ao InfraWorks

O RoadWorks reúne funções locais de geometria, terreno, corredor, volumes preliminares, obras 4D, tráfego e análise. Pode servir como ferramenta pessoal para estudo e experimentação nessas áreas. Esta entrega não implementa equivalência completa com o InfraWorks: intercâmbio proprietário, edição BIM completa, colaboração em nuvem, cobertura de projeto executivo e validação normativa continuam fora da equivalência demonstrada.

## Verificação

```powershell
node --test tests/*.test.mjs
$env:PATH=(Join-Path $PWD '.venv\Scripts')+';'+$env:PATH
.\.venv\Scripts\python.exe -m unittest discover -s tools -p "test_*.py" -v
node tools/benchmark_urban.mjs
```

`tools/browser_analysis.cjs` testa a interface nova com Playwright/Edge e banco de QA; não o execute contra banco de produção. `tools/browser_urban.cjs` preserva a verificação dos fluxos anteriores. Não há testes de campo ou homologação de engenharia nesta entrega.
