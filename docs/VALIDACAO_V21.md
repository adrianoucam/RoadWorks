# Verificação v2.1 — 16/11/2026

Execução automática completa de `tools/test_execution.py`: **passed**, código de saída zero.

- 309 testes JavaScript aprovados, zero falhas e zero ignorados.
- 28 testes Python aprovados, incluindo os testes SUMO existentes, zero ignorados.
- Cinco fluxos de navegador aprovados: interdição/contorno, mobilidade urbana, matemática/ML, cidade 3D e estudos.
- O teste novo verifica busca e número ausente, confirmação, fallback XML, seleção por clique real no mapa, interdição bilateral, passagem obrigatória, execução de comparação, CSV/JSON/HTML, invalidação, aplicação, SQLite, restauração, cancelamento e proteção do projeto anterior em nova aba.

Os provedores Nominatim/Overpass/API OSM são simulados no E2E para reprodução determinística. A topologia da fixture é OSM, com fonte/atribuição identificadas. O motor de trânsito e a API/SQLite são executados de fato, com banco temporário isolado. A execução específica do assistente é mesoscópica; não afirmar que o contorno foi validado por SUMO ou por dados reais. As integrações SUMO anteriores foram exercitadas pela suíte Python.

Ambiente: Windows, Node.js 24, Python 3.12, Edge/Playwright e SUMO 1.28.0 disponíveis. WebGL é exercitado pelo teste de cidade 3D com renderização de software; não mede desempenho da GPU do usuário.

Relatório local desta execução: `roadworks_qa/automatico_20261116_144106_19668/report.json`. Comandos, tempos, logs e capturas estão no mesmo diretório, que não entra no pacote público. Rodar `Testar_RoadWorks.cmd` ou `python tools/test_execution.py` cria outra execução isolada e não sobrescreve esse registro.

Na primeira execução, os testes detectaram um problema no próprio roteiro de navegador ao abrir uma segunda aba e um seletor antigo que se tornou ambíguo com a nova janela de resultados. Ambos foram corrigidos; os cinco fluxos passaram na execução completa posterior registrada acima.

A correção de autosave impede que o exemplo inicial de uma nova aba seja salvo sobre o projeto anterior antes de sua abertura. Essa proteção foi testada aguardando o intervalo real de autosave e conferindo a revisão no banco.

Para uso e limitações, consulte [CONTORNO_V21.md](CONTORNO_V21.md). Não é validação normativa, cadastral ou de previsão de trânsito real.
