# Verificação da versão 1.9

Data: 12/11/2026. Ambiente: Windows, Node.js 24, Python 3.12 no ambiente virtual do projeto, Edge/Playwright e SUMO/netconvert 1.28.0.

- `node --test tests/*.test.mjs`: **277 testes passaram**, zero falhas e zero ignorados. Inclui regressão da seção com borda direita negativa, projeção entre origens distintas, sentidos opostos, superfície sintética identificada, NoData/lacunas, pontes sem cotas, seleção/eventos, restauração de malha e índices OBJ válidos.
- Com `.venv/Scripts` no PATH, `.\.venv\Scripts\python.exe -m unittest discover -s tools -p "test_*.py" -v`: **24 testes passaram**, zero falhas. Inclui API/SQLite, lançador e execução efetiva dos casos SUMO.
- `tools/browser_scene.cjs`: **passou** em banco de QA fora da raiz pública. Foi exercitado WebGL com renderização por software SwiftShader, não apenas geração de dados: triângulos renderizados, seleção por raycast com clique de mouse, recorte OSM de 170 trechos, terreno com variação de altura efetivamente enviada à geometria, alternância de camadas, largura visual, gravação/restauração de prévia pelo SQLite, importação de arquivo XYZ fictício e download OBJ.
- `tools/browser_urban.cjs` e `tools/browser_analysis.cjs`: **passaram**, sem erros JavaScript, preservando comparação, edição, saturação, relatórios, calibração assistida, regressão, PCA e persistência.
- Inspeção sintática dos quatro módulos novos/afetados de integração 3D: sem erros. Captura de tela da cidade 3D inspecionada: rede, terreno, nomes, seleção e fonte fictícia foram exibidos.

O teste de relevo usou uma superfície explicitamente **FICTÍCIA**, não topografia real de Niterói. A rede do recorte é cartográfica OSM; número de faixas/larguras e demais atributos continuam sujeitos a revisão. O caminho GeoTIFF reutiliza o leitor existente, mas não foi exercitado com um arquivo GeoTIFF real nesta entrega; o teste de importação de navegador usou XYZ.

A prévia triangular restaurada pode diferir da interpolação bilinear do raster entre vértices, por isso é identificada como prévia para visualização. Não foram realizados levantamento, comparação altimétrica de campo, homologação de engenharia, teste com toda a cidade ou comprovação de equivalência ao InfraWorks. As três exclusões anteriores do usuário foram preservadas.
