# Recorte OpenStreetMap de Niterói

Dados cartográficos: © OpenStreetMap contributors, disponibilizados sob ODbL. Atribuição e licença: https://www.openstreetmap.org/copyright

Obtido em 11/11/2026 por uma requisição à API oficial:

`https://api.openstreetmap.org/api/0.6/map?bbox=-43.108,-22.907,-43.101,-22.902`

Limites da consulta em WGS84: oeste -43.108, sul -22.907, leste -43.101, norte -22.902. Vias podem ultrapassar a caixa porque a API inclui suas geometrias completas.

- `niteroi_osm_recorte.json`: resposta XML convertida para estrutura JSON com nós, vias, relações e tags. Não é um levantamento municipal. Contém 1.524 elementos retornados pela API.
- `niteroi_rede_OSM_sem_demanda.json`: estudo derivado com 133 nós e 170 trechos direcionados utilizáveis. **Sem OD, eventos ou planos semafóricos observados.** Inclui a fonte original e avisos de parâmetros presumidos.

Capacidade de 1.200 veículos/h por faixa, armazenamento por comprimento/7,5 m e velocidades/faixas ausentes são hipóteses de inicialização identificadas nos objetos. Tags declaradas no OSM também exigem revisão. Nenhum volume de tráfego real foi atribuído ao recorte.

O botão **Abrir recorte OSM de Niterói** carrega o estudo local sem consultar servidores externos. A atualização desse recorte é manual. Não representa integração com sensores nem atualização operacional em tempo real.

Validação técnica realizada: importação da rede e conversão/execução SUMO com duas viagens de teste de demanda **FICTÍCIA** em um trecho. Isso verifica o pipeline, não a circulação real ou capacidade da área. O caso de QA não é distribuído como demanda observada.
