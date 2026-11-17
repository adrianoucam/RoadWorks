# Usabilidade — v2.2

Aplicação incremental de princípios de UX/UI ao RoadWorks, sem remover módulos nem modificar schemas de projeto, de rede urbana ou tabelas SQLite. O cálculo de tráfego e as hipóteses de engenharia permanecem os mesmos.

## Referência consultada

Pontes, Anna Lara Nascimento. **Boas práticas em UX e UI Design: um guia prático e teórico para projetar interfaces digitais intuitivas**. TCC em Design, Universidade Federal do Ceará, 2022, 94 páginas. Arquivo fornecido pelo usuário: `2022_tcc_alnpontes.pdf`.

Foram consultadas as seções relevantes às dez heurísticas, especialmente páginas PDF 27–42. A página 39 também foi renderizada e inspecionada visualmente. Não foi copiado conteúdo gráfico, código ou texto extenso do documento para o programa ou para a distribuição.

| Princípio discutido | Páginas PDF | Ajuste entregue |
|---|---|---|
| Visibilidade do estado | 27–28 | Indicador da próxima ação, etapas de local/obra/contorno/comparação e estado de processamento |
| Linguagem e reconhecimento | 28–29, 33–35 | Catálogo pesquisável de ferramentas com títulos sem códigos/versão; ajuda junto aos campos |
| Controle e liberdade | 29–30 | Sair da seleção do mapa com Escape ou botão; desfazer/refazer última aplicação |
| Prevenção de erros | 32–33 | Campos inválidos destacados, explicação específica, foco no primeiro erro e dados preservados |
| Eficiência e acesso por teclado | 36–37 | Enter no catálogo, foco visível e estado expandido dos painéis comunicado por ARIA |
| Organização e hierarquia | 38–39 | Navegação persistente, formulário mais legível, alvos de interação maiores e etapas agrupadas |
| Recuperação de erros | 39–40 | Mensagens junto ao campo e impedimento de desfazer/refazer sobre edições posteriores |
| Ajuda e documentação | 41–42 | Ajuda rápida no catálogo, instruções de unidade e explicação do intervalo da obra |

Essas adaptações são decisões de implementação para o contexto de engenharia do RoadWorks. Não equivalem a uma avaliação com usuários, certificação de acessibilidade ou comprovação de ganho de produtividade. Uma avaliação posterior deve observar pessoas representativas completando tarefas reais e registrar dificuldades, erros, tempo e percepção.

## Como usar

1. Inicie `Iniciar_RoadWorks.cmd` e abra o endereço informado. Use **Ctrl+F5** para carregar os arquivos atualizados.
2. No topo do painel esquerdo, use **Encontrar ferramenta**. Digite, por exemplo, `contorno`, `terreno` ou `projetos`. Escolha o painel na lista. Se houver apenas uma correspondência, Enter já abre esse painel. O filtro não exclui painéis nem altera dados.
3. A opção **Ajuda rápida e atalhos** explica o acesso por teclado, o fluxo do contorno e os limites do desfazer. **Ctrl+K** continua disponível para os comandos existentes.
4. No assistente de contorno, os botões **Local**, **Obra**, **Contorno** e **Comparar** levam diretamente à etapa. A indicação da próxima ação se atualiza com o estado real, inclusive consultas e simulação em processamento.
5. Se um valor estiver inválido, o programa abre o grupo correspondente, destaca o campo, mostra o motivo e coloca o foco nele. Nada é corrigido silenciosamente. Ao editar, a comparação anterior continua sendo invalidada como antes.
6. Durante a seleção de um ponto ou trecho no mapa, use **Escape** ou **Sair da seleção**. Os campos preenchidos são preservados.
7. Depois de **Aplicar cenário à rede urbana**, use **Desfazer aplicação** para recuperar a rede imediatamente anterior. **Refazer aplicação** repõe o cenário. Se a rede tiver sido editada posteriormente, a operação é bloqueada para não sobrescrever essas edições. Nesse caso, use as revisões SQLite.

Desfazer/refazer é limitado à última aplicação nesta sessão. Não é histórico global de todos os módulos, não desfaz salvamentos SQLite e não é conservado após restaurar/recarregar o projeto. As revisões SQLite permanecem sendo o histórico persistente. Botões desabilitados não indicam erro: podem significar que ainda não há operação a desfazer/refazer.

## Arquivos e compatibilidade

- `src/usability.mjs`: políticas puras de validação, progresso e histórico; catálogo de ferramentas e sincronização ARIA.
- `src/detour-ui.mjs`: etapas, erros contextuais, saída da seleção e desfazer/refazer.
- `src/app.mjs`: montagem da navegação depois dos módulos existentes.
- `style.css`: dimensões, contraste de mensagens, foco, agrupamento e preferência por movimento reduzido.
- `tests/usability.test.mjs`: oito casos de políticas e histórico.
- `tools/browser_detour.cjs`: navegação por teclado, erros preservados/corrigidos, Escape e desfazer/refazer no fluxo real.

Todos os IDs e schemas anteriores foram preservados. O novo catálogo atribui IDs somente a seções que ainda não tinham identificador. Não há migração de banco nem alteração da configuração da obra pelo catálogo.

## Verificação automática

Use `Testar_RoadWorks.cmd` ou execute:

```powershell
.\roadworks_swept_path\.venv\Scripts\python.exe tools/test_execution.py
```

Na instalação com `.venv` na raiz, ajuste esse caminho. A execução usa API/SQLite temporários e gera logs, relatório e capturas em `roadworks_qa`. As respostas geográficas do teste continuam simuladas para reprodução. Consulte o registro desta versão em `VALIDACAO_V22.md`.
