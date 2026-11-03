# Nexa Play — site + API com banco de dados PostgreSQL

Site em HTML5/CSS3/JavaScript puro com backend **Node.js + Express + Sequelize + PostgreSQL**:
contas, login com JWT e mensagens de contato ficam no banco.

## Como rodar
1. Configure `DATABASE_URL` e `JWT_SECRET` no arquivo `.env`.
2. Execute o schema de `db/schema.sql` no PostgreSQL.
3. Execute `npm install` e depois `npm start`.
4. Acesse **http://localhost:3000**. Não abra as páginas por `file://` ou por um servidor estático (como Live Server), pois o cadastro precisa da API Express na mesma origem.

O servidor Express serve os arquivos do site e a API na mesma origem. A aplicação não cria as tabelas automaticamente.

## Deploy Netlify + Render
- O frontend envia as chamadas da API para `https://nexaplay-prod.onrender.com`, configurado centralmente em `public/js/functions.js`.
- O backend permite CORS para `https://nexaquest.netlify.app`, incluindo o header `Authorization` e credenciais para cookies.
- Se o domínio do frontend ou da API mudar, atualize esses valores em `src/app.js` e `public/js/functions.js`, respectivamente.

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
- `js/functions.js`: removido o armazenamento de contas no `localStorage`; entrou `NP.api()` e o token JWT
  (`localStorage` com "Lembrar de mim", senão `sessionStorage`).
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
