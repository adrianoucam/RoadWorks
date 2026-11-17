# Palmier / General Castrioto — estudo exploratório

Preparado em 16/11/2026 a pedido do usuário. O nº 443 da Rua Doutor Luiz Palmier **não foi confirmado** pelo geocodificador nem pelos endereços presentes no recorte OSM. O estudo usa uma localização aproximada retornada para a rua, no segmento `785104516`, entre Guimarães Junior e Doutor March. Não atribua esse segmento ao imóvel nº 443 sem confirmação do ponto.

## Abrir

Com o RoadWorks em execução: [mapa e comparação](http://127.0.0.1:8000/studies/palmier_443_20261116/index.html).

No programa principal, importe `projeto_roadworks.json` pelo painel **15 / Exportação → Importar projeto JSON**. O projeto inclui rede urbana, obra, demanda hipotética, comparação base/alternativa, estudos v2.0 e eixo geométrico do contorno. O estudo v2.0 exige execução novamente após importar/restaurar, por projeto. A comparação urbana já executada fica registrada no projeto.

Em **9 · Mobilidade urbana**, use **Comparar base e alternativa**. Em **12 · Estudos**, use **Executar lote**. Em **11 · Cidade 3D**, abra a rede; sem MDT, a elevação zero é apenas referência visual, não terreno levantado.

## Cenário e resultados

- Bloqueio total nos dois sentidos do way OSM `785104516`, de 0 a 3.600 segundos.
- Origem: nó OSM `890526599` (Palmier / Guimarães Junior).
- Destino: nó OSM `1968640874` (Palmier / Doutor March).
- Contorno calculado: **Guimarães Junior → General Castrioto → Doutor March**.
- Percurso direto: **126,11 m**. Contorno: **1.575,06 m**. Comprimentos dos eixos OSM, não levantamento de faixa.
- Demanda **hipotética**: 600 automóveis/h durante 30 minutos (300 viagens), chegadas regulares; horizonte de uma hora, incluindo escoamento.
- Sem obra: 300/300 concluídas, tempo médio/P95 de 18 s.
- Com obra e contorno: 300/300 concluídas, tempo médio/P95 de 205 s.
- Sensibilidade com demanda +50%: 450/450 concluídas, tempo médio/P95 de 205 s.
- Fila máxima zero e residual de conservação zero nos três casos.

Fila zero não significa ausência de congestionamento real. Não há tráfego de fundo, semáforos, prioridade ou conflitos em cruzamentos cadastrados. Não há dados observados de demanda. Capacidade de 1.200 veíc./h/faixa e armazenamento comprimento/7,5 m são hipóteses do importador. O recorte contém corredores selecionados e não avalia todas as ruas alternativas do bairro.

O percurso respeita conectividade por IDs de nós e os sentidos presentes nas tags OSM. Tags ausentes não comprovam circulação em ambos os sentidos. Quatro relações de conversão ficaram incompletas no recorte de corredores, conforme os avisos conservados nos JSON. Confirme sinalização, conversões, acessos e viabilidade operacional atuais em campo antes de qualquer planejamento real. Não é desvio autorizado, previsão calibrada nem projeto executivo.

## Procedência e integridade

- OSM API oficial: `https://api.openstreetmap.org/api/0.6/map?bbox=-43.106,-22.871,-43.087,-22.856`, consultada em 16/11/2026.
- Busca Nominatim: `443 Rua Doutor Luiz Palmier Niteroi Brazil`, retornou somente segmentos de rua, sem número predial. Referência aproximada usada: −22,8620925; −43,0954483.
- © OpenStreetMap contributors, ODbL 1.0: <https://www.openstreetmap.org/copyright>.
- Dados brutos: `mapa.osm`; seleção viária: `osm_viario.json`; corredores modelados: `corredor_osm.json`.
- Entradas e resultados: `estudo_urbano.json`, `estudos_v20.json`, `resultado.json`, `projeto_roadworks.json`.

O script `reproduzir.mjs` reutiliza o motor de filas da aplicação, gera os arquivos e verifica continuidade da rota, presença da General Castrioto no contorno, exclusão de trechos interditados, volumes e conservação. Execute da raiz:

```powershell
node studies/palmier_443_20261116/reproduzir.mjs
```

As consultas Overpass tentadas não forneceram dados; o estudo utiliza exclusivamente a resposta bem-sucedida da API oficial OSM. Sem edição destrutiva de projetos existentes. Não foi implementada extração de imagens/LiDAR, atualização com sensores ou otimização de semáforos.


## Verificações desta execução

292 testes JavaScript e 26 testes Python aprovados, incluindo os testes de integração SUMO já existentes. Este estudo específico foi executado pelo modelo mesoscópico do navegador/Node, **não pelo SUMO**. O lote também foi executado na interface, o projeto foi salvo separadamente no SQLite, e os botões sem/com obra e o horizonte de 60 minutos foram conferidos no mapa de demonstração. Nenhuma alteração no motor do programa foi necessária.
