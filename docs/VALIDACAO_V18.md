# Verificação da entrega v1.8

Data: 12/11/2026. Ambiente: Windows, Node.js 24, Python 3.12 no ambiente virtual do projeto e SUMO/netconvert 1.28.0.

- **265 testes JavaScript passaram**, zero falhas e zero ignorados, com `node --test tests/*.test.mjs`. Incluem solução afim conhecida com colinearidade, intercepto constante, validação de entradas, separação cronológica, invariância dos coeficientes a mudanças nas respostas de teste, recuperação de fator sintético de capacidade, independência do conjunto de validação, não negatividade e igualdade do total OD, falta de identificação e ortonormalidade da PCA.
- **24 testes Python passaram**, zero falhas, com `.venv/Scripts` no PATH e `.\.venv\Scripts\python.exe -m unittest discover -s tools -p "test_*.py" -v`. Incluem API/SQLite, dois testes com SUMO efetivamente executado e três testes do lançador para porta livre, ocupada por outro programa e ocupada por esta instalação.
- **Fluxo novo no navegador passou** com `tools/browser_analysis.cjs`, Playwright e Edge headless, usando API local e banco exclusivo de QA fora da raiz publicada. Verificou sensibilidade, calibração e aplicação do fator 0,8 fictício, recusa de reaplicação sobre estudo modificado, regressão, previsão, recusa de previsão após alteração da data sem recalcular, ajuste OD, PCA, cancelamento, relatórios e restauração dos resultados/entradas pelo SQLite.
- Os testes não avaliam qualidade de previsões reais de trânsito. Os dados de demonstração e os alvos usados para testar calibração são explicitamente fictícios.
- A interface foi inspecionada em captura de tela. O gráfico PCA e tabelas renderizaram. Os tiles do mapa continuam externos e podem não aparecer durante testes sem conectividade.

O fluxo legado `tools/browser_urban.cjs` também passou após a integração: comparação, edição, saturação, exportação, SQLite e recuperação sem eixo CAD, sem erro JavaScript. O lançador reconheceu e reaproveitou a instância de QA na porta 8765 no teste `--probe-only`.

## Medição de desempenho

Foi comparada a implementação anterior copiada antes da alteração com a atual, na mesma máquina. Comando:

`node tools/benchmark_urban.mjs ../roadworks_qa/urban_before_v18.mjs`

Cinco execuções após um aquecimento por caso, tomando a mediana:

| Caso | Antes | Depois | Razão antes/depois |
|---|---:|---:|---:|
| Exemplo fictício, 4 trechos, 2.400 s | 23,44 ms | 18,03 ms | 1,30 |
| Recorte OSM de 170 trechos, 2.400 s, demanda de teste fictícia | 200,93 ms | 118,14 ms | 1,70 |

Os resultados completos foram idênticos nos dois casos comparados, incluindo séries e métricas. Valores são específicos desses ensaios e não garantem ganhos semelhantes em outros computadores ou estudos. O módulo anterior é um artefato de QA local e não é necessário para usar o programa; sem esse argumento, o script mede somente a versão atual.

Também foi corrigida a invalidação do cache de rotas em eventos com limites de tempo fracionários: o evento passa a ser processado no próximo passo inteiro, de acordo com a discretização de um segundo. Há teste dedicado de reabertura com `end=10.5`.

## Limites

Não houve calibração ou validação com levantamentos reais, teste de capacidade da cidade inteira, homologação normativa ou comprovação de equivalência ao InfraWorks. Sensores, otimização automática de semáforos e extração de imagens/LiDAR não foram acrescentados. Consulte `ANALISE_LOCAL_V18.md` para formatos, uso e limitações de cada método.
