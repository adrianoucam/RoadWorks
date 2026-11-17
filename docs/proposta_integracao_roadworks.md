# Proposta de integração de ideias no RoadWorks

Data: 11/11/2026. Estado: proposta inicial de produto e arquitetura, sem implementação nesta etapa.

## Objetivo

Evoluir o RoadWorks existente para apoiar órgãos públicos na comparação de intervenções e condições de trânsito. Niterói é o piloto; cidades, áreas de estudo e fontes devem ser configuráveis. Preservar modelagem geométrica, obras 4D, análises existentes e contratos de projetos/API.

## Escopo da leitura

Esta é uma triagem documental, não uma revisão integral dos manuais. Foram consultados abertura, sumários disponíveis e trechos selecionados, além das quatro transcrições. Não se avaliou o funcionamento das aplicações comerciais. Propostas abaixo são decisões para o RoadWorks, não afirmações de equivalência com esses produtos.

| Material local | Evidência consultada | Ideia a incorporar |
|---|---|---|
| `cityengine-help-2022.1.pdf` | Página PDF 86: grafos, nós, arestas, regras e quadras associadas; páginas 143-144: edição de geometria e larguras | Rede editável por objetos, propriedades numéricas e manipulação direta; geração de geometria por parâmetros |
| `OpenRoads-Designer.pdf` | Páginas PDF 1-2; ficha de produto, não manual completo | Elementos relacionados, componentes reutilizáveis, procedência dos dados e atualização consistente de representações e relatórios |
| `2023-c3d-content-brazil-doc-portuguese.pdf` | Capa, sumário e marcadores: Country Kit Brasil 2023, unidades, coordenadas, estilos e verificações geométricas | Configurações brasileiras identificadas, unidades explícitas e apresentação técnica consistente; investigar critérios específicos antes de implementar |
| `transcricao_video1.txt` | Importação de semáforos e iluminação, CRS, ajuste à superfície e objetos repetidos | Importação de inventário georreferenciado com revisão e posicionamento paramétrico |
| `video2.txt` | Edição de sentidos, faixas, curvas, conversões e recuos | Editor de faixas e movimentos, com propriedades físicas separadas das regras de circulação |
| `video3.txt` | Visibilidade de camadas e visualização simplificada | Controle de camadas e níveis de detalhe por tarefa |
| `video4.txt` | Intercâmbio de polígonos e representação de travessias | Importar geometrias preservando seu significado; travessia deve ter categoria própria, mesmo que a transcrição use outra categoria para exibição |
| `digital twin 1-s2.0-S0926580524005314-main.pdf` | Páginas PDF 1-2: segmentação de nuvens de pontos e construção de modelos geométricos de ativos rodoviários | Futuro processamento de levantamentos para inventário, com avaliação e revisão; geometria extraída não fornece automaticamente demanda ou conectividade de tráfego |
| `digital twin  1-s2.0-S2667305325000420-main.pdf` | Páginas PDF 1-2: representação do ativo, atualização e apoio à decisão | Versionar dados e registrar atualização e vínculo com observações; distinguir modelo digital de integração operacional |
| `pontos de engarrafamento admin,+Art+125+BJD.pdf` | Páginas PDF 1-2: estudo de afunilamento com observações de fluxo e velocidade | Registrar formação e dissipação de gargalos; não transferir resultados empíricos para Niterói sem validação local |
| `ponterioniteroi.pdf` | Página PDF 1: relato de problemas de circulação e conflitos em acessos | Fonte de hipóteses e perguntas para o piloto, sujeita a verificação atual; não constitui levantamento operacional validado |

Os demais artigos e manuais permanecem no acervo para aprofundamento. O manual 706 não apresentou texto extraível nas páginas iniciais consultadas; exige inspeção visual/OCR antes de fundamentar requisitos específicos. DNIT/IPR e Green Book devem ter trechos, edição, contexto e aplicabilidade conferidos antes de parametrizar verificações. Não foi realizada revisão normativa nesta etapa.

## Arquitetura proposta

Um projeto relaciona cidade, área de estudo, versão da rede, demanda, controles, eventos e execuções. Cada execução fixa as versões utilizadas e registra parâmetros, motor, período, semente aleatória quando aplicável, resultados e limitações.

1. **Base territorial:** limites, terreno, vias, inventário e fontes com CRS, data e qualidade.
2. **Rede de circulação:** nós, trechos direcionados, faixas, conectores, movimentos permitidos, níveis de pontes/túneis e semáforos.
3. **Projeto geométrico:** eixos, perfis, seções, interseções e componentes relacionados.
4. **Demanda:** viagens origem-destino por intervalo e classe de veículo, inclusive entradas e saídas da área estudada.
5. **Eventos e alternativas:** acidente como perda temporária de capacidade; obra vinculada a localização e calendário; alterações de controle, desvio e oferta viária.
6. **Simulação e comparação:** executar cenário base e alternativas; comparar viagem, espera, filas, vazão, viagens pendentes e efeitos nas regiões vizinhas.
7. **Rastreabilidade:** dados observados, inferidos e sintéticos identificados; relatórios vinculados à execução reproduzível.

A visualização 2D/3D e o motor de tráfego devem compartilhar identificadores de objetos. A geometria exibida não substitui a rede de circulação. Uma alteração geométrica deve invalidar resultados dependentes e exigir nova execução, preservando o histórico anterior.

## Variação percentual e capacidade

O percentual modifica uma demanda de referência identificada, por região, horário e classe. Não corresponde automaticamente ao percentual da frota municipal em circulação. Mudanças sobre regiões sobrepostas precisam de regra explícita para evitar multiplicação duplicada da demanda.

A análise de saturação executará uma série de níveis de demanda, com critérios configuráveis de fila, tempo de viagem, viagens concluídas e recuperação após o evento. Registrar repetição/variabilidade quando o motor for estocástico. O resultado será uma faixa válida para os cenários e critérios estudados, sem anunciar um limite universal da cidade.

## Entregas em ordem de dependência

| Etapa | Entrega | Critério de aceite proposto |
|---|---|---|
| 1. Fundação | Estado completo recuperável, regressão e vínculo de fontes/versões | Reabrir projeto sem perder configurações; manter contratos e recursos existentes |
| 2. Cidades e rede | Niterói configurável e conversão de rede real para SUMO | Segunda cidade sem alterar o motor; testar sentidos, conversões e vias em níveis distintos; mapear IDs OSM/SUMO |
| 3. Demanda e controle | OD por período, classes e semáforos | Entradas validadas e rotas conectadas; lacunas explicitadas; demanda sintética identificada |
| 4. Eventos | Acidentes, obras 4D e alternativas | Evento afeta apenas localização/período configurados; comparação com base equivalente |
| 5. Comparação e saturação | Indicadores, mapas, variação percentual e séries de execuções | Resultados reproduzíveis e critérios explícitos; registrar viagens que não terminam |
| 6. Calibração | Comparação com contagens e tempos observados | Separar dados de ajuste e validação; informar erros e limites encontrados |
| 7. Aprofundamento geométrico | Edição avançada, componentes e levantamentos | Atualizar dependências e sinalizar resultados desatualizados; validar extrações antes de uso |

Recursos geométricos existentes continuam disponíveis durante as etapas. A prioridade funcional é responder às perguntas de trânsito do órgão público; novas capacidades de geometria entram conforme necessárias aos cenários.

## Piloto proposto

Delimitar uma região de Niterói incluindo os acessos que alimentam o tráfego. Cadastrar o cenário de referência e comparar: operação habitual; acidente com fechamento temporário; obra com desvio; demanda aumentada; alternativa mitigadora. Local, horários e parâmetros serão definidos a partir de dados disponíveis, sem presumir condições atuais a partir de relatos históricos.

## Situação atual e limites

O README e as instruções do RoadWorks descrevem análises agregadas e integração SUMO com rede sintética. A existência dessas funções não comprova microssimulação da malha real de Niterói. Esta proposta não executou simulações, não mediu capacidade e não implementou integração com aplicações comerciais.

Integrar ideias significa formular requisitos e implementações próprias. Intercâmbio com ferramentas externas depende de formatos e interfaces verificados; não se presume suporte a formatos proprietários.
