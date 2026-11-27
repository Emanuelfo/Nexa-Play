# Nexa Play — site + API com banco de dados PostgreSQL

Site em HTML5/CSS3/JavaScript puro com backend **Node.js + Express + Sequelize + PostgreSQL**:
contas (cadastro e login convencionais, com e-mail ou usuário e senha), sessões com JWT, projetos e mensagens de contato ficam no banco.

## Como rodar
1. Configure `DATABASE_URL` e `JWT_SECRET` no arquivo `.env`.
2. Execute o schema de `db/schema.sql` no PostgreSQL.
3. Execute `npm install` e depois `npm start`.
4. Acesse **http://localhost:3000**. Não abra as páginas por `file://` ou por um servidor estático (como Live Server), pois o cadastro precisa da API Express na mesma origem.

O servidor Express serve os arquivos do site e a API na mesma origem. As tabelas da aplicação continuam sendo provisionadas pelo schema; o backend cria apenas a tabela técnica interna de rate limiting, de forma idempotente.

## Deploy Vercel + Render
- O frontend envia chamadas para `/api` na própria origem. Na Vercel, `vercel.json` encaminha para `https://nexa-play.onrender.com`.
- O backend permite CORS com credenciais para as origens Vercel/Render de produção e as origens exatas de `CORS_ORIGINS`. O navegador usa cookie HttpOnly e validação por JWT.
- Se os domínios mudarem, atualize as origens em `src/app.js`/`CORS_ORIGINS` e o destino em `vercel.json`.

## Estrutura
```
src/
  app.js                       Servidor Express (serve public/ e a API)
  config/database.js           Conexão Sequelize/PostgreSQL (lê o .env)
  models/Usuario.js            Contas, identidade e preferências de privacidade
  models/Mensagem.js           Mensagens do formulário de contato (ligada ao usuário, se logado)
  controllers/                 usuario (cadastro, /me), auth (login), projeto, mensagem
  middlewares/auth.js          Valida o JWT (+ versão opcional para visitantes)
  routes/                      Rotas da API
  utils/validacao.js           Validações no servidor
public/                        O site (index.html, paginas/, css/, js/, assets/)
```

## API
| Método | Rota | Acesso | Função |
|---|---|---|---|
| POST | `/api/usuarios` | público | Cadastro (retorna token + dados) |
| POST | `/api/login` | público | Login por e-mail ou nome de usuário |
| GET | `/api/me` | token | Dados do usuário logado |
| GET | `/api/me/perfil` | token | Perfil próprio, estatísticas, atividades concluídas e evolução mensal registradas |
| PUT | `/api/me/perfil` | token | Atualiza nome, usuário, biografia, URLs HTTPS de imagens e privacidade |
| POST | `/api/mensagens` | público (token opcional) | Salva mensagem de contato |
| GET | `/api/usuarios/:id/perfil` | token | Perfil e dados de jogo permitidos pelas preferências de privacidade; nunca retorna e-mail |
| GET | `/api/me/amizades` | token | Lista amigos e solicitações recebidas/enviadas |
| GET | `/api/usuarios/buscar?q=...` | token | Pesquisa por nome ou nome de usuário e retorna o estado da relação |
| GET | `/api/usuarios/sugestoes` | token | Sugere perfis públicos sem relação existente |
| POST | `/api/usuarios/:id/amizade` | token | Envia solicitação de amizade |
| PUT | `/api/usuarios/:id/amizade` | token | Aceita solicitação recebida |
| DELETE | `/api/usuarios/:id/amizade` | token | Recusa solicitação recebida, cancela solicitação enviada ou remove amizade |
| GET | `/api/publicacoes?limite=10&cursor=...&usuario=...` | token | Feed paginado; `usuario` filtra publicações de um perfil |
| GET | `/api/publicacoes/:id` | token | Consulta uma publicação compartilhada |
| POST | `/api/publicacoes` | token | Cria publicação de texto; `conquista_id` opcional só é aceito para conquista desbloqueada pelo próprio usuário |
| DELETE | `/api/publicacoes/:id` | token | Apaga uma publicação do próprio usuário |
| PUT | `/api/publicacoes/:id` | token | Edita o texto da própria publicação até 30 minutos após a criação (`{ "texto": "..." }`) |
| PUT / DELETE | `/api/publicacoes/:id/curtida` | token | Adiciona ou remove a curtida |
| GET | `/api/publicacoes/:id/comentarios?limite=10&cursor=...` | token | Lista comentários paginados |
| POST | `/api/publicacoes/:id/comentarios` | token | Cria comentário (máximo 1.000 caracteres) |
| GET | `/api/projetos?limite=12&cursor=...&q=...&categoria=...&usuario=...` | token | Explora projetos públicos com busca e paginação; `usuario` filtra pelo proprietário |
| GET | `/api/me/projetos?limite=20&cursor=...` | token | Lista projetos criados, aceitos ou com convite/solicitação pendente |
| POST | `/api/projetos` | token | Cria projeto |
| GET | `/api/projetos/:id` | token | Detalhe, equipe aceita, até 20 atualizações e solicitações para o proprietário |
| PUT | `/api/projetos/:id` | proprietário | Edita informações do projeto |
| POST | `/api/projetos/:id/convites` | proprietário de equipe | Convida por `nome_usuario` |
| POST | `/api/projetos/:id/solicitacoes` | token | Solicita participação em equipe pública |
| PUT | `/api/projetos/:id/participantes/:usuarioId` | convidado ou proprietário | Aceita/recusa convite ou solicitação (`{ "acao": "aceitar" }`) |
| DELETE | `/api/projetos/:id/participantes/:usuarioId` | participante ou proprietário | Cancela participação/convite ou remove integrante |
| POST | `/api/projetos/:id/atualizacoes` | proprietário ou integrante aceito | Publica atualização (máximo 2.000 caracteres) |

O feed usa as tabelas `publicacoes`, `comentarios` e `curtidas`; o perfil usa `amizades`, `usuario_conquistas` e `progresso_usuario`; projetos usam `projetos`, `projeto_participantes` e `projeto_atualizacoes`. Execute o `db/schema.sql` atualizado no banco PostgreSQL/Supabase antes de publicar o backend. A migração é idempotente e inclui as alterações de perfil e de projetos. Nomes de usuário legados passam a usar um identificador derivado do nome e do ID; contas continuam podendo entrar com e-mail. Os endpoints de projeto exigem autenticação e validam autorização no servidor.

### Limitações sociais do schema atual
- Imagens de perfil e capa aceitam URLs HTTPS; ainda não existe serviço para upload de arquivos.
- Projetos aceitam apenas links externos e imagens em URLs HTTPS; ainda não há upload de arquivos nem comentários específicos de projeto.
- Publicações só armazenam texto e referência opcional a uma conquista; imagens/projetos vinculados e eventos/notificações do jogo precisam de suporte adicional.
- Perfis privados mostram apenas identidade básica até que uma amizade seja aceita. Publicações de perfis privados também ficam restritas ao próprio usuário e a amigos.
- O e-mail nunca é disponibilizado no perfil público. Cada usuário pode ocultar biografia, pontuação, quantidade de amigos, conquistas e progresso individualmente.

### Segurança da API
- Helmet aplica cabeçalhos HTTP e uma CSP compatível com os scripts e fontes locais, imagens HTTPS, o vídeo do YouTube e o jogo no itch.io. Os limites de requisição são compartilhados entre instâncias por `api_rate_limit_windows` no PostgreSQL; o servidor cria a tabela de forma idempotente e limpa janelas expiradas.
- Limites atuais: API 1.200 req/min/IP; login 10 req/15 min/IP e 20 por identificador; cadastro 5/h/IP; mensagens 5/h/IP; publicações 10/h/usuário; comentários 30/min/usuário; curtidas 60/min/usuário; solicitações de amizade 20/h/usuário. Escritas de perfil e projetos também têm limites próprios e retornam HTTP 429 com `Retry-After`.
- Configure `JWT_SECRET` com pelo menos 32 bytes aleatórios, `CORS_ORIGINS` para domínios adicionais e `DATABASE_SSL_CA` com o certificado raiz PEM do projeto Supabase (substitua quebras de linha por `\n` se necessário). A CA ativa a validação do certificado TLS; sem ela, a conexão mantém criptografia mas não valida o certificado e o backend em produção emite um alerta. O Render deve ser o único proxy confiável à frente do Express; os logs JSON registram IDs de requisição e eventos de abuso sem gravar tokens, senhas, corpos ou IPs em texto claro.
- A API valida JWT HS256, expiração e revogação, usa consultas parametrizadas e exige autorização no servidor. Cookies SameSite=Lax, origens autorizadas e cabeçalho de escrita protegem as requisições do navegador contra CSRF.
- O backend conecta ao PostgreSQL/Supabase pelo `DATABASE_URL` de servidor e, conforme o schema atual, essa role pode ignorar RLS. As tabelas seguem com RLS habilitado e sem policies para acesso público, mas RLS não substitui as verificações de identidade/autoria da API quando a role do backend tem bypass. Aplicar RLS por usuário exigiria migrar a autenticação customizada para Supabase Auth e criar policies; esta implementação não altera as policies/tabelas sociais.
- A CSP aplicada pelo Helmet vale para páginas servidas diretamente pelo Express. O frontend de produção é publicado na Vercel: os cabeçalhos dos documentos HTML (CSP estrita sem `unsafe-inline`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS) ficam em `vercel.json` (e em `public/vercel.json`, que deve ser mantido igual se o Root Directory da Vercel for `public`).

### Dados do Nexa Quest e integração Unity
- O repositório não contém scripts/projeto Unity nem um endpoint de recebimento de resultados do jogo. Portanto, não é possível confirmar como o cliente Unity salva ou envia progresso, e nenhuma integração de escrita com o jogo foi inventada.
- O schema existente permite consultar `usuarios.pontos`, atividades em `progresso_usuario` (incluindo pontuação e data de conclusão) e conquistas em `usuario_conquistas`. O perfil expõe histórico e agregação mensal apenas quando a preferência `mostrar_progresso` permite; conquistas continuam sob `mostrar_conquistas`.
- O schema não registra nível, experiência (XP) ou progresso até o próximo nível. A interface informa essa indisponibilidade em vez de calcular ou inventar valores. Pontos são apresentados como pontuação armazenada, não como XP.
- A página de estatísticas é somente leitura para resultados do jogo. O compartilhamento no feed referencia uma conquista existente e o backend verifica que ela pertence ao usuário autenticado; isso não altera pontuação nem desbloqueia conquistas.
- Uma integração Unity futura precisa ser definida com o projeto do jogo e validada pelo backend (identidade autenticada, atividade/conquista válida e regra de pontuação no servidor) antes de aceitar qualquer gravação.

### Projetos — schema, API e regras de acesso
Antes de implementar a experiência, o desenho de backend/schema foi documentado aqui:
- `projetos` armazena título, descrição, URL HTTPS de imagem, categoria, link externo opcional, proprietário, visibilidade (`publico`/`privado`) e tipo (`individual`/`equipe`).
- `projeto_participantes` mantém uma relação única por projeto/usuário, origem (`convite`/`solicitacao`) e estado pendente/aceito/recusado.
- `projeto_atualizacoes` registra novidades de projeto separadas das publicações do feed.
- Apenas projetos públicos aparecem em Explorar. Projetos privados e suas atualizações só podem ser consultados pelo proprietário e integrantes aceitos. Apenas o proprietário edita dados e gerencia participantes. Projetos individuais não aceitam participantes. Solicitações só são aceitas em projetos públicos de equipe; convites do proprietário podem ser enviados a equipes públicas ou privadas.
- O backend acessa o PostgreSQL/Supabase pelo Sequelize; o navegador não recebe credenciais do Supabase. Imagens e links externos aceitam URLs HTTPS, sem upload. Não há comentários ou upload de imagens de projeto nesta versão.

## Jogo NEXA QUEST incorporado
- Página: `public/paginas/jogo.html` (menu "Jogo" da área autenticada, com botão de tela cheia). Proporção 16:9 responsiva; o jogo roda dentro da plataforma, sem redirecionar ao itch.io.
- Acesso: a página usa o mesmo fluxo de sessão das demais (`data-protected`). O HTML não contém o endereço do jogo: o iframe só é criado depois de `GET /api/jogo`, rota protegida pelo middleware `auth`, devolver a URL de incorporação. Sem sessão válida (inclusive após F5 ou logout) a API responde 401 e o usuário vai para o login; depois de entrar, volta ao jogo.
- URL: padrão `https://itch.io/embed-upload/20479421?color=000000`; pode ser trocada com `GAME_EMBED_URL` (só aceita `https://itch.io/embed-upload/...`).
- Tela cheia: há um único controle, o botão "Tela cheia" da plataforma (`#game-fullscreen`). Ele aplica a Fullscreen API ao `#game-stage` (ancestral do iframe, que nunca é movido nem recarregado, então o progresso da partida é mantido). Em celulares pede orientação horizontal com `screen.orientation.lock('landscape')` (só funciona em tela cheia no Chrome/Android) e libera o bloqueio em qualquer saída (botão, ESC, gesto ou botão Voltar). Onde o bloqueio não existe (Safari/iPhone, Firefox), aparece o aviso "Gire o celular para jogar na horizontal".
- iPhone/Safari: não existe Fullscreen API para elementos. Nesse caso (e só nele, ou se a API falhar) a plataforma usa um modo imersivo (`position: fixed`, rolagem travada, sem menus). Não é tela cheia real: a barra do Safari continua visível. Para tela cheia de verdade no iPhone, o usuário precisa adicionar o site à Tela de Início.
- O iframe é criado SEM a permissão `fullscreen` de propósito: assim o botão nativo do itch.io não funciona dentro da plataforma e não compete com o botão do Nexa Quest. Remover `allowfullscreen` desativa a função, mas o itch.io continua exibindo o botão; para escondê-lo, desmarque "Fullscreen button" em *Embed options* do projeto no itch.io (não é possível fazer isso pelo código da plataforma, pois o conteúdo do iframe é de outra origem). Controles de tela cheia criados dentro do próprio jogo também deixam de funcionar.
- Dimensionamento: `GAME_VIEWPORT_MODE=fluid` (padrão) faz o iframe preencher a caixa 16:9. Se o itch.io embute o jogo com tamanho fixo em pixels (Embed options → "Embed in page" com largura/altura) e a imagem aparece cortada, use `GAME_VIEWPORT_MODE=scaled` com `GAME_WIDTH`/`GAME_HEIGHT` iguais ao tamanho configurado no itch.io (padrão 1920x1080); o iframe mantém esse tamanho e é reduzido por CSS para caber, sem cortes.
- CSP: `frame-src` do Helmet inclui `https://itch.io`. Se o frontend publicado aplicar CSP própria (Vercel/Netlify), inclua também `frame-src https://itch.io`.
- Limite conhecido: o endereço de incorporação do itch.io é público para quem o descobrir; ele não impede o acesso direto ao jogo no itch.io. Restringir de verdade exigiria alterar a visibilidade do jogo no itch.io (ex.: protegido por senha/privado) ou hospedar o build no próprio servidor.
- Não há sincronização de XP, nível ou progresso entre o jogo e o banco.

## O que mudou no front-end
- `js/functions.js`: `NP.api()` envia o cookie HttpOnly para a API da própria origem. JWTs antigos no armazenamento do navegador são migrados para cookie.
- `js/main.js`: cadastro, login e contato chamam a API. Ao abrir cada página,
  o usuário é confirmado no servidor (`NP.loadUser()`).

## Pendências
- **Recuperação de senha: não existe, por decisão de projeto.** Não há "Esqueci minha senha" nesta versão. Quem perder a senha não tem como recuperar a conta sozinho.
- **Login com Google: removido** (backend, frontend e dependência `google-auth-library`). As colunas `google_sub` e `google_vinculado_em` seguem no banco, sem uso. Veja `db/verificacoes/contas-google.sql`.
- O jogo é incorporado em `paginas/jogo.html` (ver seção acima).
- Ver também *Pendências futuras*, no fim deste arquivo.

## Redesign visual
- `public/css/style.css`: estilos compartilhados (no fim do arquivo estão as seções do redesign: palco escuro, faixa em movimento, manifesto, páginas internas, autenticação, rodapé).
- `public/css/responsive.css`: ajustes para tablet e celular.
- `public/js/motion.js`: animações (revelação na rolagem, parallax, inclinação 3D com o mouse, botões magnéticos, barra de progresso). Respeita "movimento reduzido" do sistema.
- `public/assets/imagens/mascote-palco.png`: a mesma mascote de `mascote-destaque.png`, apenas sem o fundo claro embutido (o original foi mantido).


## Sessão do navegador — Vercel e Render

O frontend usa `/api` na própria origem. O `vercel.json` da raiz encaminha essas
rotas ao Render. Na Vercel, use **Root Directory = raiz do repositório**,
framework **Other**, sem comando de build, com saída `public`. Se o projeto usa
**Root Directory = public**, a configuração equivalente em `public/vercel.json`
encaminha a API e a saída deve ser a própria pasta (`.`). Publique também
o backend atualizado no Render, com `NODE_ENV=production`, `JWT_SECRET` existente,
`DATABASE_URL` existente. O login convencional usa essas variáveis.
`CORS_ORIGINS` recebe origens adicionais exatas, separadas por vírgula.
A origem Vercel de produção e a origem Render já são permitidas.

O JWT existente passa a ser enviado em `nexa_session`, cookie HttpOnly, Secure
em HTTPS/produção, SameSite=Lax, Path=/api e sem Domain. A Vercel encaminha
Cookie e Set-Cookie pelo proxy. O navegador mantém a comunicação na própria
origem, sem depender de cookies de terceiros. As sessões de Vercel e Render
são independentes por domínio. Use o frontend Vercel para entrar e acessar
pela landing Vercel. Abrir HTML por `file://` não suporta esse fluxo.

Os prazos permanecem 8 horas e 30 dias com **Lembrar de mim**. Somente a opção
persistente emite Max-Age. O **cadastro sempre abre sessão temporária** (cookie de sessão, JWT de 8 h): a persistência de 30 dias só é escolhida no login, com **Lembrar de mim**.
Tokens antigos são trocados por cookie sem renovar a validade e removidos de
localStorage/sessionStorage após a troca. Novos JWTs não são retornados no JSON
nem gravados no armazenamento JavaScript.

O logout revoga o hash SHA-256 do JWT até sua expiração e só depois limpa o cookie.
No startup, o servidor cria de forma idempotente a tabela técnica
`public.jwt_revocations`, seu índice e RLS, assim como já faz com rate limiting.
A role do banco precisa dessas permissões. Nenhuma tabela de usuários é alterada.
A tarefa periódica remove hashes expirados. Falha no banco impede autenticação.

Chamadas de escrita à API exigem `X-Nexa-Request: 1`. O frontend já envia esse
cabeçalho. CORS permite credenciais apenas para origens autorizadas e valida o
preflight do cabeçalho para proteger as operações autenticadas por cookie contra
CSRF. Respostas privadas usam Cache-Control: private, no-store.
Clientes Bearer existentes podem continuar usando Authorization, que também exige preflight no navegador.
O middleware mantém leitura Bearer para migração e compatibilidade.

Execute `node --test tests/session.test.js tests/session-client.test.js tests/auth-issuance.test.js tests/traditional-forms.test.js` para os
testes isolados de JWT, cookie, revogação, migração e encaminhamento do cliente.
Fechar/reabrir navegador e o proxy publicado exigem verificação após o deploy.

Para o teste integrado local com PostgreSQL, inicie `npm start` e execute
`node tests/session-live.cjs`. O teste cria e remove uma conta temporária própria.
A migração histórica `db/migrations/20261114_login_google.sql` não é mais necessária
para o funcionamento da aplicação (o login com Google foi removido). Se ela já foi
aplicada, as colunas permanecem sem uso; não remova nada sem uma migração planejada e autorizada.


## Revisão da autenticação tradicional

Na revisão, a implantação Vercel consultada respondeu 404 para `/api/me`, enquanto
`https://nexa-play.onrender.com/api/me` respondeu 401 JSON, como esperado sem sessão.
O frontend publicado já usava `/api`. Os dois arquivos Vercel cobrem os diretórios
de projeto suportados e apontam todas as rotas da API para o Render. Uma resposta
HTML ou JSON inválida agora é tratada como erro de comunicação, inclusive com HTTP
200, e nunca é aceita como sessão válida. O deploy Vercel precisa ser atualizado.

O backend também precisa de redeploy para as consultas de e-mail normalizado,
projeções explícitas dos dados de autenticação e limite de 72 bytes do bcrypt no
login. O cadastro já aplicava esse limite. O login passa a rejeitar sufixos além
após os 72 bytes em vez de permitir a truncagem silenciosa do bcrypt.
A duplicidade de e-mail é verificada sem distinguir maiúsculas e minúsculas,
inclusive para dados antigos com espaços, e erros apontam o campo correto.
Esta revisão não introduz migração ou alteração do schema do banco.

Os formulários recebem os handlers antes da validação inicial da sessão,
bloqueiam envios simultâneos e liberam nova tentativa em caso de erro. O fallback
HTML usa POST para evitar credenciais na URL. A confirmação de sessão diferencia
indisponibilidade do servidor de falha de autenticação. Respostas antigas não
restauram nem removem uma sessão estabelecida por outra operação.

Ao sair, o conteúdo privado é ocultado antes da navegação e antes da captura do
cache de histórico. Documentos restaurados validam a sessão novamente. O logout
é comunicado às outras abas quando o navegador oferece BroadcastChannel.
O cookie continua HttpOnly, Secure em produção e SameSite=Lax, com validade de
8 horas ou 30 dias quando a opção Lembrar de mim está marcada.

Variáveis no Render permanecem `NODE_ENV=production`, `DATABASE_URL` e
`JWT_SECRET` com pelo menos 32 bytes. Mantenha o segredo existente para preservar
as sessões válidas. `CORS_ORIGINS` adiciona somente origens exatas necessárias.
A configuração de CORS e os limites de requisições foram preservados nesta revisão.
O frontend utiliza o proxy de mesma origem porque chamadas diretas entre Vercel e
Render dependeriam das permissões de cookies de terceiros do navegador.

Validação realizada com testes isolados, PostgreSQL e navegador local através de
um proxy. Incluiu cadastro, hash, e-mail duplicado, senha correta/incorreta,
sessão temporária/persistente, atualização, entrada pela landing, logout,
rotas protegidas, expiração, falha temporária do backend e botão Voltar.
As contas temporárias foram removidas. O teste integrado simula um cliente de proxy
com IP reservado por execução para usar sua própria cota de rate limiting.
Fechar e reabrir o processo do navegador e a configuração após deploy de ambos
os serviços continuam sendo verificações manuais.

## Variáveis de ambiente
Nunca versione o `.env`. Use `.env.example` como modelo.

| Variável | Onde | Obrigatória | Descrição |
|---|---|---|---|
| `DATABASE_URL` | Render / local | sim | Conexão PostgreSQL (Supabase). |
| `DATABASE_SSL_CA` | Render | recomendada em produção | Certificado raiz PEM do projeto Supabase; ativa a verificação do certificado TLS (use `\n` no lugar das quebras de linha). Sem ela a conexão é criptografada, mas o certificado não é verificado, e o backend registra um alerta. Não use `rejectUnauthorized: false` como solução. |
| `JWT_SECRET` | Render / local | sim | Segredo aleatório com 32 bytes ou mais. |
| `NODE_ENV` | Render | sim | `production` em produção. |
| `CORS_ORIGINS` | Render | não | Origens extras, separadas por vírgula. |
| `GAME_EMBED_URL`, `GAME_VIEWPORT_MODE`, `GAME_WIDTH`, `GAME_HEIGHT` | Render | não | Jogo no itch.io (ver *Jogo NEXA QUEST incorporado*). |

## Execução local
1. `npm install`
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `JWT_SECRET` com um banco **de desenvolvimento** (não use o de produção).
3. Aplique `db/schema.sql` nesse banco e rode `npm start` (http://localhost:3000).

## Testes
- `npm test`: testes automatizados de backend e do cliente (`tests/*.test.js`), sem banco real: o Sequelize é substituído por stubs. Cobrem emissão e revogação de sessão, cadastro e login, formulários, privacidade de projetos (`projetos-acesso.test.js`) e regras de solicitação/convite. O SQL em si não é executado nesses testes.
- `npm run test:e2e`: testes de navegador (Chromium) contra uma **API simulada com dados sintéticos** (`tests/e2e/mock-server.mjs`), que aplica os cabeçalhos do `vercel.json`. Requer `npm i -D playwright-core` e `npx playwright-core install chromium` (ou um Chromium instalado). Cobrem CSP, formulário de contato, filtros e buscas simultâneos, estados de erro e o jogo.
- `tests/session-live.cjs` usa o banco configurado no `.env`: **não rode contra produção**.
- Esses testes usam emulação de navegador; não substituem verificação em aparelhos reais (Android, iPhone).

## Regras de projetos (privacidade e participação)
- Projeto privado só é visível ao proprietário e a participantes **aceitos**. Solicitação pendente, recusada ou removida não dá acesso. Quem tem **convite pendente** vê apenas título, categoria, formato e proprietário, para aceitar ou recusar.
- Ao tornar um projeto público em privado, as solicitações pendentes são encerradas (removidas); equipe aceita e convites pendentes continuam valendo.
- Depois de uma recusa (do proprietário ou do convidado), uma nova solicitação ou convite só é aceita 24 horas depois (`REABERTURA_HORAS` em `src/services/projetoAcesso.js`). O backend responde com o código `reabertura_indisponivel` e o horário de liberação.

## Limitações atuais do jogo
- O jogo é um build Unity WebGL hospedado no itch.io e incorporado por iframe de outra origem: a plataforma não consegue ler nem alterar o canvas, os botões ou o conteúdo interno.
- A plataforma garante a caixa 16:9 e o botão único de tela cheia. Cortes dentro do canvas dependem de como o build foi exportado e das *Embed options* do itch.io (ver *Configurações externas*).
- Não há sincronização de XP, níveis ou conquistas entre o jogo, o backend e o perfil. As páginas públicas descrevem esses recursos como parte do jogo.

## Configurações externas
- **Vercel**: Root Directory na raiz do repositório (usa `vercel.json`) ou `public` (usa `public/vercel.json`); os dois arquivos devem permanecer iguais. Confira, após o deploy, os cabeçalhos dos documentos HTML (por exemplo com `curl -I`) e se o jogo carrega (`frame-src https://itch.io`).
- **Render**: defina `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET` e `DATABASE_SSL_CA`. Se ainda existir `GOOGLE_CLIENT_ID`, pode ser removida. No log de inicialização não deve aparecer o aviso de TLS sem verificação.
- **Supabase**: baixe o certificado raiz em *Project Settings → Database → SSL Configuration* para usar em `DATABASE_SSL_CA`. Rode `db/verificacoes/contas-google.sql` (somente leitura) para conhecer as contas criadas só pelo Google.
- **itch.io**: em *Embed options*, use o mesmo tamanho configurado em `GAME_WIDTH`/`GAME_HEIGHT` e, se quiser esconder o botão de tela cheia do itch.io, desmarque *Fullscreen button*.
- **Unity** (projeto original, fora deste repositório): veja *Pendências futuras*.

## Pendências futuras
- Sincronização de XP, níveis e conquistas entre Unity, backend e banco.
- Otimização do build Unity (os arquivos principais somam cerca de 64,6 MB): compressão Brotli/Gzip com os cabeçalhos corretos, remover assets, shaders e cenas não usados, texturas comprimidas, reduzir o tamanho do código com *Managed Stripping* e usar um template WebGL responsivo sem botão de tela cheia próprio.
- Refatoração e modularização do `main.js` e consolidação das camadas históricas de CSS e JS.
- Sistema de denúncias, bloqueios e moderação.
- Mudanças estruturais de grande porte no banco (por exemplo, remover as colunas do Google em uma migração planejada).
- Imagens possivelmente sem uso, a confirmar antes de remover: `estudante.png`, `parceiros.png`, `parceiros-orbita.png/.webp` (não são referenciadas por HTML, CSS ou JS).


## Comunidade e colaboração (27/11/2026)

A área logada usa o shell, feed, cartões e formulários compartilhados de `public/js/main.js` e os tokens de `public/css/social.css` / `theme.css`. O contrato está em `UX-CONTRACT.md` e a direção visual em `DESIGN.md`.

Antes de publicar este backend em outro banco, execute `db/migrations/20261127_colaboracao_social.sql` (ou o schema completo atualizado). A migração é aditiva e idempotente: adiciona `usuarios.area`, `usuarios.habilidades` (array de textos, vazio por padrão), `usuarios.portfolio_url`, `projetos.resumo`, `projetos.etapa` e `projetos.como_contribuir`, sem reescrever dados antigos. Ela foi aplicada ao banco conectado durante esta implementação; outros ambientes precisam recebê-la antes do backend.

A edição do perfil aceita até 12 habilidades de 40 caracteres e portfólio HTTPS; campos públicos respeitam a privacidade global do perfil. `GET /api/usuarios/buscar?q=Godot&area=Jogos%20Digitais` considera nome, usuário, área, habilidades e biografia visível. Também aceita filtro por área sem termo. Informações ocultas não entram no resultado nem na busca. As quatro áreas são Desenvolvimento de Sistemas, Design, Multimídia e Jogos Digitais.

Criação e edição de projetos aceitam resumo opcional (240 caracteres), como contribuir (1.500) e etapa opcional. Categorias antigas continuam válidas; filtros das novas áreas incluem Programação em Sistemas, Arte e design em Design, Música em Multimídia e Jogos em Jogos Digitais. Disponibilidade significa que um projeto público de equipe aceita solicitações, conforme o controle de participação existente.

O servidor de QA pode usar dados inteiramente fictícios: `SOCIAL_FIXTURES=1` com `tests/e2e/mock-server.mjs`. O servidor de produção nunca importa essas fixtures. Testes específicos: `node --test tests/social-colaboracao.test.js tests/projetos-acesso.test.js`. Evidências de navegador: `artifacts/social/`.
