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
  models/Usuario.js            Contas (nome, contato, senha com bcrypt, nascimento, gênero, avatar, nível...)
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
| POST | `/api/login` | público | Login por e-mail, celular, nome ou nome completo |
| GET | `/api/me` | token | Dados do usuário logado |
| POST | `/api/redefinir-senha` | público | Nova senha (contato + data de nascimento) |
| POST | `/api/mensagens` | público (token opcional) | Salva mensagem de contato |

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
