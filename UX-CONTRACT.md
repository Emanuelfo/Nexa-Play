# Contrato da área social do Nexa Quest

Idioma: pt-BR. Identidade e tokens: [DESIGN.md](DESIGN.md). Implementação sem framework, com shell e renderizadores canônicos em `public/js/main.js`; chamadas e feedback em `public/js/functions.js`.

## Fontes de regras

| Domínio | Fonte | Consequência na interface |
|---|---|---|
| Privacidade de perfis | `src/controllers/perfilController.js`, README: limitações sociais | Perfis privados só revelam habilidades, área e portfólio ao próprio usuário e a amigos; busca não pesquisa campos ocultos. Biografia só participa da busca se visível. |
| Acesso e participação | `src/services/projetoAcesso.js`, README: projetos | Projeto público de equipe aceita solicitações. Individuais não aceitam; privados usam convites. Convites privados recebem visão mínima. Só o proprietário edita. |
| Dados opcionais e compatibilidade | `db/migrations/20261127_colaboracao_social.sql`, `src/utils/socialMetadata.js` | Sem dados inventados. Categorias antigas não são reescritas. Habilidades antigas ausentes viram lista vazia. |
| Reabertura após recusa | `src/services/projetoAcesso.js` | Respeitar `disponivel_em`; evitar envios repetidos. |

## Canonical UI Map

| Capacidade | Proprietário canônico | Variantes / verificação |
|---|---|---|
| Navegação | `renderSocialShell`, `initTabs` | Sidebar no desktop; cinco itens iguais no celular. Projetos cobre lista, criação e detalhe. Avatar abre conta. Teclado e viewport real. |
| Busca | `initSearchSuggest`, `pesquisarAmigos`, `initProjectExplorer` | Busca de pessoas no topo encaminha `q`; em Pessoas só existe a busca local. Pessoas aceita área sem termo. Cancelar respostas antigas inclusive ao limpar. Filtros ficam na URL. |
| Form | `prepareSocialForm`, `validateSocialForm`, `NP.setErr`, `socialFormError` | Criação/edição compartilham `projectFormFields`. Rótulos visíveis, erros associados, foco no primeiro inválido, texto preservado e bloqueio durante envio. |
| Select/Listbox | `<select>` nativo | Geometria do popup e interação pertencem ao sistema operacional. Não há exigência de popup desenhado pela aplicação. Verificação de abertura, teclado, seleção e celular. |
| Overlay | `mountSocialDialog`, `confirmSocialAction`, `shareSocialPost`, `<dialog>.showModal()` | Fundo inerte, foco inicial em Cancelar, Esc e retorno ao disparador; conteúdo limitado a `100dvh`. Editores e comentários são disclosures inline, sem semântica modal. |
| Scrollbar | `public/css/social.css` global | Tokens semânticos, gutter estável; forced-colors usa o sistema. Documento mantém a rolagem de formulários. |
| Toast/status | `NP.toast`, `NP.status` | Mensagens de resultado em live regions, erros junto ao formulário. |
| CRUD | Controladores existentes + funções de criação/edição em main.js | Criar leva ao detalhe. Editar projeto fecha o editor e retorna foco. Editar perfil mantém o formulário. Cancelar criação volta à origem social válida ou Projetos. |
| Feed | `renderFeedPost`, `initFeed` | Curtida com texto, preenchimento e `aria-pressed`; comentários com Esc e retorno do foco; compartilhamento em janela com link selecionável, cópia e integração nativa opcional. Falhas mantêm rascunhos. |

## Responsividade e recuperação

No desktop, a primeira postagem e suas ações aparecem em 1366×768. Em 360/390/430px o compositor vem imediatamente após o cabeçalho, os projetos entram depois de duas postagens, a coluna de apoio fica oculta e a navegação reserva safe area. `VisualViewport` oculta a navegação durante teclado sobreposto. O comportamento com teclado físico e viewport reduzido foi verificado; teclado virtual físico iOS/Android ainda requer teste em aparelho.

Formulários não recarregam a página ao falhar; botões mantêm rótulo e geometria durante envio. Dados de sessão e regras de autorização permanecem sob os serviços existentes. Não há gravação local persistente de texto público/privado, nem integração de XP inventada.

## Evidências e reprodução

- `node --test tests/social-colaboracao.test.js tests/projetos-acesso.test.js`: persistência, limites, privacidade, acesso e participação.
- `npm test`: suíte completa; falha preexistente de referências a Google em arquivos legados não alterados.
- `npm run test:e2e`: depende de `playwright-core` e Chromium, ausentes neste ambiente. A verificação desta alteração foi feita no navegador integrado.
- Servidor visual com dados fictícios: PowerShell `$env:SOCIAL_FIXTURES='1'; $env:PORT='4174'; node tests/e2e/mock-server.mjs`. Nunca é usado pelo servidor de produção.
- Capturas e evidências em `artifacts/social/`. A matriz JSON registra oito telas nas três larguras de celular.
