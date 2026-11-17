# Verificação v2.2 — 17/11/2026

Execução completa de `tools/test_execution.py`: passed. 317 testes JavaScript, 28 testes Python e seis fluxos de navegador aprovados, zero falhas e zero ignorados. Relatório: `roadworks_qa/automatico_20261117_142535_28584/report.json`.

Além da regressão existente, o fluxo de usabilidade verifica busca de ferramenta sem resultado e por teclado, abertura de um painel sem perda de campos, ARIA, próxima etapa, foco/erro contextual/recuperação, tamanho do alvo, Escape e telas de 1600, 900 e 600 pixels. O fluxo de contorno também verifica desfazer/refazer aplicação.

Uma repetição dirigida de `tools/browser_usability.cjs` passou após o ajuste final de rolagem para impedir que o campo com erro fosse coberto pelo catálogo fixo. Captura: `docs/images/usabilidade-v22.png`, inspecionada visualmente. O teste dirigido usou exclusivamente `roadworks_qa/visual_v22.db` na porta 8766.

As consultas geográficas nos testes são simuladas; cálculo, API e persistência são reais em banco isolado. Os testes SUMO existentes foram executados pela suíte Python; não foram usados para validar fisicamente o contorno. Não houve avaliação com participantes, medição de produtividade ou auditoria completa de acessibilidade. A referência PDF fundamenta as escolhas de interação, não certifica a usabilidade do programa.

Nenhum schema de projeto, rede ou tabela SQLite foi alterado. Histórico de desfazer/refazer é temporário e bloqueia sobreposição de edições posteriores. Veja [USABILIDADE_V22.md](USABILIDADE_V22.md).
