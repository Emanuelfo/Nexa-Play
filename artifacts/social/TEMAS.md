# Restauração seletiva de cores

Fonte: `git show 44e956b:public/css/theme.css`, comparada à versão `735a575` e ao workspace. Todos os tokens hexadecimais históricos foram conferidos e mantidos; a navegação integrada continua usando as superfícies escuras. Não foi feito checkout/revert de arquivos de layout ou backend.

## Causa observada e correção

A paleta histórica ainda existia. No navegador de teste, uma preferência clara salva era reaplicada, produzindo canvas `#f4f6fa`; o script e o HTML também tinham claro como fallback. Além disso, seletores genéricos `.btn:hover` no tema escuro alcançavam variantes `.btn.btn-soft`, tornando botões secundários azuis. A regra da aba selecionada forçava branco em vez do token de seleção.

Agora o fallback é escuro; a preferência explícita light/dark é respeitada, inclusive na recarga e entre abas. O color-scheme e os tokens são resolvidos pelo mesmo seletor CSS, sem estilo inline paralelo. Primários e secundários têm regras de cor separadas. Valores escuros: canvas `#101722`, superfície `#182230`, apoio `#222e3e`, texto `#e6edf8`, borda `#2d3b4e`, ação `#3a68d1`, link `#91b2ff`, ciano `#70dcff`.

Não foi encontrado overlay preso: após carregamento, preloader ausente, opacity=1 e filter=none. Portanto, o preloader foi preservado.

## Verificações

- 12/12 testes de tema e preloader: preferência ausente, storage bloqueado, opção clara/escura, migração de preferência legada, alternância, recarga, sincronização e fallback HTML.
- Comparação automática dos tokens com `44e956b`: valores históricos preservados.
- Navegador: claro → recarga → claro; escuro → recarga → escuro. Nove telas sociais com fundo escuro consistente, opacity=1 e filter=none. `theme-restoration-checks.json`.
- Contraste medido em Pessoas: título 15,27:1; secundário 8,50:1; usuário 7,57:1; texto do campo 13,61:1; menu ativo 6,55:1; botão primário 5,15:1. `restored-theme-contrast.json`.
- Capturas de Pessoas com dados fictícios: `pessoas-cores-restauradas.jpg` e `pessoas-cores-restauradas-celular.jpg`.

A correção está no código local, sem deploy. Alinhamento, estrutura e correções de carregamento de conexões foram preservados.
