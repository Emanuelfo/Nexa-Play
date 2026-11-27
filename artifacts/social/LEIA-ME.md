# Verificação da área social — 27/11/2026

As capturas usam **dados fictícios** do servidor local de QA. Os logotipos e o golfinho são os SVGs oficiais existentes, sem modificações.

## Resultado

- Início com compositor e primeira publicação completa antes da dobra em 1366×768. As ações da primeira publicação terminam em 396px.
- Oito telas × quatro larguras (360, 390, 430 e 1366px): 32 verificações finais sem transbordamento horizontal e sem carregamentos pendentes. Menu ativo conferido em cada tela. `final-responsive-checks.json`.
- Cinco itens de navegação com larguras iguais no celular. Projetos recentes após duas postagens; sugestões e progresso fora do feed mobile. `responsive-checks.json`.
- Contraste medido em nomes, usuários, horários, ações e disponibilidade: mínimo de 4,92:1 no claro e 7,57:1 no escuro entre os elementos medidos. `contrast-checks.json`.
- Curtir, comentar, fechar comentários por Esc, foco inicial e retorno ao disparador; publicação após falha com texto preservado; compartilhamento com link visível e confirmação de cópia; diálogo de confirmação com fundo inerte e Esc.
- Busca do topo preserva Godot em Pessoas; filtro de área, resultado vazio orientado, adicionar amigo e solicitação enviada; acesso direto aos projetos do perfil.
- Projeto: solicitar participação e impedir novo envio pelo estado pendente; proprietário cria e edita contribuição, resumo e etapa; cancelar criação retorna aos filtros de origem; editar retorna o foco.
- Perfil: salvar habilidades, recarregar, falhar e reenviar mantendo texto. Nome de 78 caracteres e biografia de 460 caracteres sem transbordamento a 360px. Publicação longa e URL extensa com expansão sem transbordamento.

## Backend e checks

- Migração `20261127_colaboracao_social.sql` aplicada ao banco conectado: seis colunas aditivas, sem reescrever registros antigos.
- Consultas reais do backend para pessoas, sugestões e projetos: HTTP lógico 200.
- Integração real dos controladores com PostgreSQL: perfil e habilidades persistidos e encontrados; habilidade de perfil privado excluída da busca de terceiros; projeto criado, lido e editado com novos campos. Edição por payload antigo preservou os metadados. Todas as fixtures foram executadas em transações revertidas. `database-checks.json`.
- `node --test tests/social-colaboracao.test.js tests/projetos-acesso.test.js`: **16/16**. `collaboration-tests.txt`.
- `npm test`: **51/52**. A única falha é a verificação estática de remoção de Google, que encontra `google_sub` em `src/controllers/googleAuthController.js`, arquivo preexistente e não alterado. `unit-tests.txt`.
- `node --check` nos três arquivos JavaScript de aplicação modificados: passou.
- `designmd lint DESIGN.md`: zero erros e zero avisos.
- Auditoria premium estrita: zero findings. `premium-audit.json`.
- `git diff --check`: passou.

## Limites

- `npm run test:e2e` depende de `playwright-core` e Chromium, não instalados neste ambiente. Os fluxos acima foram verificados no navegador integrado; a suíte antiga de Playwright não foi executada com sucesso.
- O teclado virtual de iOS/Android em aparelho físico não foi validado. A implementação usa VisualViewport, safe area, documento rolável e janela limitada ao viewport; teclado físico e viewports estreitos/baixos foram conferidos.
- Não foi feito deploy do frontend/backend. Outros bancos precisam receber a migração antes do novo backend. As limitações existentes de upload e de integração do jogo permanecem.

## Capturas

- `inicio-desktop.jpg` e `inicio-celular.jpg`: tema claro.
- `inicio-desktop-escuro.jpg` e `inicio-celular-escuro.jpg`: tema escuro.
- `pessoas-desktop.jpg`, `projeto-desktop.jpg`, `projetos-celular.jpg`, `compartilhar-celular.jpg`: telas e interação de apoio.


## Revisão visual inspirada na organização do Reddit

Cabeçalho transversal com logo oficial, busca ampla e Publicar; sidebar neutra com criação junto a Meus projetos; feed contínuo com divisores e ações em cápsulas; Pessoas em lista compacta. Alteração aplicada pelo shell e estilos compartilhados em todas as oito telas sociais. Capturas desta versão: `rede-desktop.jpg`, `rede-celular.jpg`, `rede-desktop-escuro.jpg`. As imagens com prefixo `inicio-` documentam a versão anterior.

Nova matriz: oito telas em 360, 390, 430 e 1366px, sem overflow (`redesign-checks.json`). No navegador: Publicar focou o compositor; curtida, comentários/Esc, busca Godot, acesso aos projetos de perfil e solicitação de participação passaram. A busca continua explicitamente limitada a pessoas/habilidades. Não foi adicionada ordenação inexistente. As limitações de E2E legado, teclado físico de aparelho e deploy listadas acima permanecem.
