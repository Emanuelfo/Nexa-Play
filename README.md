# Nexa Play — site + API com banco de dados PostgreSQL

Site em HTML5/CSS3/JavaScript puro com backend **Node.js + Express + Sequelize + PostgreSQL**:
contas, login com JWT e mensagens de contato ficam no banco.

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
  config/database.js           Conexão Sequelize/MySQL (lê o .env)
  models/Usuario.js            Contas, identidade e preferências de privacidade
  models/Mensagem.js           Mensagens do formulário de contato (ligada ao usuário, se logado)
  controllers/                 usuario (cadastro, /me, redefinir senha), auth (login), mensagem
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
- Helmet aplica cabeçalhos HTTP e uma CSP compatível com os scripts locais, fontes Google, imagens HTTPS e o vídeo do YouTube. Os limites de requisição são compartilhados entre instâncias por `api_rate_limit_windows` no PostgreSQL; o servidor cria a tabela de forma idempotente e limpa janelas expiradas.
- Limites atuais: API 1.200 req/min/IP; login 10 req/15 min/IP e 20 por identificador; cadastro 5/h/IP; mensagens 5/h/IP; publicações 10/h/usuário; comentários 30/min/usuário; curtidas 60/min/usuário; solicitações de amizade 20/h/usuário. Escritas de perfil e projetos também têm limites próprios e retornam HTTP 429 com `Retry-After`.
- Configure `JWT_SECRET` com pelo menos 32 bytes aleatórios, `CORS_ORIGINS` para domínios adicionais e `DATABASE_SSL_CA` com o certificado raiz PEM do projeto Supabase (substitua quebras de linha por `\n` se necessário). A CA ativa a validação do certificado TLS; sem ela, a conexão mantém criptografia mas não valida o certificado e o backend em produção emite um alerta. O Render deve ser o único proxy confiável à frente do Express; os logs JSON registram IDs de requisição e eventos de abuso sem gravar tokens, senhas, corpos ou IPs em texto claro.
- A API valida JWT HS256, expiração e revogação, usa consultas parametrizadas e exige autorização no servidor. Cookies SameSite=Lax, origens autorizadas e cabeçalho de escrita protegem as requisições do navegador contra CSRF.
- O backend conecta ao PostgreSQL/Supabase pelo `DATABASE_URL` de servidor e, conforme o schema atual, essa role pode ignorar RLS. As tabelas seguem com RLS habilitado e sem policies para acesso público, mas RLS não substitui as verificações de identidade/autoria da API quando a role do backend tem bypass. Aplicar RLS por usuário exigiria migrar a autenticação customizada para Supabase Auth e criar policies; esta implementação não altera as policies/tabelas sociais.
- A CSP aplicada pelo Helmet vale para páginas servidas diretamente pelo Express. Como produção publica o frontend no Netlify, configure também os headers CSP no Netlify para obter a mesma proteção nos documentos hospedados lá.

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

## O que mudou no front-end
- `js/functions.js`: `NP.api()` envia o cookie HttpOnly para a API da própria origem. JWTs antigos no armazenamento do navegador são migrados para cookie.
- `js/main.js`: cadastro, login, redefinição de senha e contato agora chamam a API. Ao abrir cada página,
  o usuário é confirmado no servidor (`NP.loadUser()`).
- `paginas/login.html`: o modal "Redefinir senha" ganhou o campo de data de nascimento.

## Pendências
- **Redefinição de senha**: confirma a identidade por contato + data de nascimento por não haver envio de e-mail/SMS.
  Antes de produção, troque por link/código enviado ao usuário.
- Considere limitar tentativas de login (ex.: `express-rate-limit`) e usar HTTPS em produção.
- Login com Google, URL do jogo (`GAME_URL` em `js/main.js`) e redes sociais seguem como antes.

## Redesign visual
- `public/css/style.css`: estilos compartilhados (no fim do arquivo estão as seções do redesign: palco escuro, faixa em movimento, manifesto, páginas internas, autenticação, rodapé).
- `public/css/responsive.css`: ajustes para tablet e celular.
- `public/js/motion.js`: animações (revelação na rolagem, parallax, inclinação 3D com o mouse, botões magnéticos, barra de progresso). Respeita "movimento reduzido" do sistema.
- `public/assets/imagens/mascote-palco.png`: a mesma mascote de `mascote-destaque.png`, apenas sem o fundo claro embutido (o original foi mantido).


## Sessão do navegador — Vercel e Render

O frontend usa `/api` na própria origem. O `vercel.json` da raiz encaminha essas
rotas ao Render. Configure na Vercel **Root Directory = raiz do repositório**,
framework **Other**, sem comando de build, com saída `public`. Publique também
o backend atualizado no Render, com `NODE_ENV=production`, `JWT_SECRET` existente,
`DATABASE_URL` existente e `GOOGLE_CLIENT_ID` existente para o Google.
`CORS_ORIGINS` recebe origens adicionais exatas, separadas por vírgula.
A origem Vercel de produção e a origem Render já são permitidas.

O JWT existente passa a ser enviado em `nexa_session`, cookie HttpOnly, Secure
em HTTPS/produção, SameSite=Lax, Path=/api e sem Domain. A Vercel encaminha
Cookie e Set-Cookie pelo proxy. O navegador mantém a comunicação na própria
origem, sem depender de cookies de terceiros. As sessões de Vercel e Render
são independentes por domínio. Use o frontend Vercel para entrar e acessar
pela landing Vercel. Abrir HTML por `file://` não suporta esse fluxo.

Os prazos permanecem 8 horas e 30 dias com **Lembrar de mim**. Somente a opção
persistente emite Max-Age. Senha, cadastro e Google usam o mesmo mecanismo.
Tokens antigos são trocados por cookie sem renovar a validade e removidos de
localStorage/sessionStorage após a troca. Novos JWTs não são retornados no JSON
nem gravados no armazenamento JavaScript. O token temporário de vínculo Google
continua limitado à confirmação já existente.

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

Execute `node --test tests/session.test.js tests/session-client.test.js tests/auth-issuance.test.js` para os
testes isolados de JWT, cookie, revogação, migração e encaminhamento do cliente.
Fechar/reabrir navegador, GIS com conta real e o proxy publicado exigem verificação
após o deploy, com os domínios autorizados também no Google Cloud Console.

Para o teste integrado local com PostgreSQL, inicie `npm start` e execute
`node tests/session-live.cjs`. O teste cria e remove uma conta temporária própria.
A migração existente `db/migrations/20261114_login_google.sql` deve estar aplicada
em cada banco antes de publicar o backend. Ela foi necessária no banco deste
ambiente, onde faltavam google_sub e google_vinculado_em, e foi aplicada durante
esta implementação. O login Google real ainda precisa de uma conta Google e
Client ID com as origens autorizadas para validação após publicação.
