# Aplicação dos conceitos dos manuais SolidWorks

Foram consultadas seções selecionadas dos três PDFs fornecidos pelo usuário. As páginas abaixo são **páginas do arquivo PDF, contadas a partir de 1**; podem diferir da paginação impressa. Os documentos são referências de organização e raciocínio de simulação, não especificações matemáticas de tráfego. Nenhum código, imagem, modelo ou texto extenso proprietário foi incorporado ao programa ou ao pacote.

| Fonte e páginas PDF | Conceito observado | Adaptação entregue no RoadWorks |
|---|---|---|
| `Fundamentals3DDesign_SIM_ENG_LV_2023_final.pdf`, 30, 32, 35–36 | Árvore, propriedades, comandos contextuais e feedback | Árvore de preparação, propriedades aplicar/descartar, busca Ctrl+K e mensagens de estado |
| Mesmo manual, 277, 279, 298 | Estudos, configurações/unidades, etapas de solução e acompanhamento | Estudo nomeado, base congelada, alternativas, opções do solucionador e progresso cancelável |
| Mesmo manual, 306 | Inspeção dos resultados por seleção/sondas | Sondas por trecho, seleção sincronizada e enquadramento 3D; não foi implementado corte volumétrico estrutural |
| Mesmo manual, 316, 318 | Comparação de resolução e interpretação com hipóteses | Comparação de passos temporais, percentis, conservação e documentação das hipóteses; não se confunde passo de tráfego com malha FEA |
| `SolidWorks_Simulation_Student_Guide-ENG.pdf`, 10, 12–14, 18–19 | Definir estudo, preparar condições, calcular e relatar | Verificação de demanda/topologia, execução e relatórios JSON/CSV/HTML rastreáveis |
| Mesmo guia, 36, 39–40 | Duplicação, refinamento, convergência e invalidação após mudanças | Duplicar alternativas, refinamento temporal, deltas à referência e descarte de resultados desatualizados |
| `Top-Five-Reasons-Engineers-Should-Learn-Simulation-eBook_PT-BR.pdf`, 2–4 | Qualidade dos dados, condições realistas, iteração e comparação com realidade | Origem explícita dos dados, avisos de calibração, critérios transparentes e distinção entre exemplo fictício e estudo observado |

## Propostas que exigem outro domínio de cálculo

Análise de tensões/deformações, materiais, contatos, fadiga, flambagem e fator de segurança estrutural necessitam solver, modelos constitutivos, condições de contorno e validação específicos. Não foram simulados por analogia com o tráfego. Esses manuais não tornam o RoadWorks equivalente ao SolidWorks Simulation ou ao InfraWorks.

A adaptação prioriza funções úteis ao objetivo do projeto: comparar obras e acidentes, variar demanda e capacidade, verificar gargalos e tornar os experimentos reproduzíveis. O teste de convergência temporal mede sensibilidade numérica; a validação física continua dependendo de observações independentes.

## Módulos entregues

- `src/study-workbench.mjs`: contratos, compilação de alternativas, verificação, lote, critérios, estatísticas e convergência.
- `src/study-worker.mjs`: execução em segundo plano.
- `src/study-ui.mjs`: preparação, propriedades, resultados, gráficos, comandos e exportação.
- `src/urban-traffic.mjs`: detalhes opcionais, percentis, sementes, chegadas Poisson, passos e sondas.
- `src/urban-renderer.mjs` e `src/urban-scene-ui.mjs`: câmeras e enquadramento por seleção.
- `src/app.mjs`: snapshot aditivo e restauração.
- `tools/api.py`, `tools/launch.py` e iniciadores: compatibilidade com a estrutura atual e acesso estático protegido.

Uso e definições: [ESTUDOS_V20.md](ESTUDOS_V20.md).
