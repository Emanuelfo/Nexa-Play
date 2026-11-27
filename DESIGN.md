---
version: alpha
name: Nexa Quest
description: 'Uma plataforma educacional de criação prática e colaborativa, com identidade própria: ilustração autoral, cor sólida e botões adesivo.'
colors:
  primary: "#1f5eff"
  ink: "#091e5b"
  background: "#ffffff"
  ice: "#e3f0ff"
  muted: "#2f4472"
  sun: "#ffc233"
  coral: "#ff6b5b"
  cyan: "#4cc3ff"
typography:
  display:
    fontFamily: "Fredoka (Nexa Fredoka), Baloo 2, Trebuchet MS, sans-serif"
  body:
    fontFamily: "Nunito (Nexa Nunito), system-ui, sans-serif"
rounded:
  DEFAULT: "14px"
  panel: "28px"
  navigation: "999px"
spacing:
  page-max: "1200px"
  section: "clamp(64px, 9vw, 120px)"
---

# Nexa Quest

## Overview

A referência de estética é o uso de ilustração 2D própria, cenários completos, seções
com composições diferentes e botões com personalidade (EnxadaHost), **adaptado** à marca:
nada de cores, personagens ou componentes copiados. A assinatura do Nexa Quest é o
golfinho original num "mar de circuitos": terraços arredondados, sol âmbar, nuvens-pílula
e traços de circuito no lugar das algas.

O mascote e os logotipos são SVGs originais e nunca são redesenhados nem recortados:
a cena é um SVG de fundo e o mascote é o arquivo original, sobreposto por CSS (`.scene` /
`.scene-fig`). Público: estudantes de tecnologia e criação digital. Idioma pt-BR.
Os textos só descrevem o que existe; não há números, depoimentos nem funcionalidades inventadas.

## Colors

`public/css/publico.css` é a fonte canônica dos tokens. Azul `#1f5eff` e navy `#091e5b`
são a marca. Gelo `#e3f0ff` é o fundo de apoio. **Âmbar** (`--sun`), **coral** e **ciano**
são cores de apoio: aparecem em ilustrações, destaques e no botão principal sobre fundo
escuro, nunca como fundo de página.

Cor por área (usada em barras, marcadores e retratos): Sistemas = ciano, Design = coral,
Multimídia = âmbar, Jogos = azul. Sem degradês de fundo, sem glow, sem glassmorphism.
O único degradê é o brilho diagonal dos botões.

## Typography

Fredoka (já presente no logotipo) em títulos, botões e rótulos; Nunito (terminações
arredondadas, hospedada em `assets/fontes`) no texto. Títulos entre 30 e 60px, texto 17–19px,
texto secundário em azul-navy `#2f4472` (contraste acima de 9:1 sobre branco). Sem caixa alta.
Títulos alinhados à esquerda; nenhuma seção repete a mesma composição centralizada.

## Layout

Cada seção tem uma função e uma composição própria:

- **Hero**: bloco azul com circuito tom sobre tom, texto à esquerda, cena à direita, corte diagonal.
- **Duas partes**: dois blocos de cor de ponta a ponta (rede social em azul, jogo em navy), cada um com padrão próprio.
- **Quatro áreas**: ilustração central e uma área em cada canto, em zigue-zague.
- **Como funciona**: faixa clara com cortes diagonais, ilustração à esquerda e lista numerada.
- **Convite final**: o golfinho emerge da onda que abre o rodapé.

Nexa Quest e Sobre variam: painel ilustrado, capturas reais inclinadas, bloco navy do jogo,
linhas editoriais com pictograma, retratos escalonados e contato em bloco azul.
O menu flutua em cápsula e o hero entra por baixo dele (`--header-space`).

Até 900px as composições são reorganizadas: o texto vem antes da ilustração, as áreas viram
lista com a cor ao lado, a equipe vira lista com foto ao lado e o menu usa disclosure nativo.

## Elevation & Depth

Linguagem "adesivo": o mascote tem contorno branco, então botões, molduras, painéis e menu
usam **borda navy de 3px e base rígida** (`box-shadow: 0 6px 0`), sem sombra difusa.
Ao pressionar, o botão desce até a base.

## Shapes

Botões 14px, painéis 28px, menu em cápsula. Terraços, nuvens e objetos das ilustrações são
formas simples e arredondadas, sem contorno. Cortes de seção são diagonais (`--slant`).

## Components

- Botões: `.pq-btn` (azul, em fundo claro), `.pq-btn--sun` (âmbar, em fundo escuro), `.pq-btn--ghost` (branco). Link: `.pq-link` com sublinhado âmbar.
- Cena: `.scene` + `.scene-bg` (SVG) + `.scene-fig` (mascote original).
- Blocos: `.block`, `.panel`, `.area-item`, `.area`, `.member`, `.contact`.
- Botões "Acessar plataforma" (menu e hero) usam `data-enter-platform` e o mesmo fluxo de sessão (`NP.enterPlatform`).
- Rodapé montado por `renderFooter` (main.js); a onda vem de `.site-footer::before`.
- Contato: IDs, nomes e `initContact` de main.js inalterados.

### Ilustrações (`public/assets/ilustracoes/`)

`cena-hero`, `cena-areas`, `cena-trilha`, `cena-ponte`, `cena-dupla` (cenas); `objeto-social`,
`objeto-jogo`, `area-*` (objetos e pictogramas); `padrao-circuito`, `padrao-rede`, `padrao-jogo`
(padrões tom sobre tom); `onda`. São SVGs editáveis com a mesma paleta. Novas ilustrações devem
seguir a mesma gramática (formas simples, cor sólida, sem degradê) e ser feitas por quem desenha a marca.

### Login e Cadastro

Mantêm estrutura e composição. `auth-refino.css` apenas alinha os botões à borda e base navy do resto do site.

## Área social (redesign)

Aplica-se às páginas autenticadas (`data-protected`): início, explorar, meus projetos, criar/detalhe de projeto, perfil, pessoas e atividade no jogo. Estilos em `public/css/social.css` e `theme.css`; estrutura montada por `renderSocialShell` em `public/js/main.js`.

- **Estrutura:** menu lateral neutro (superfície do tema, 232px; 76px só com ícones no tablet; barra inferior no celular), cabeçalho branco de 64px (título da página, busca de pessoas, tema, conta) e área principal cinza `#f4f6fa` com cards brancos.
- **Identidade herdada da landing:** azul `#2457eb`, azul pressionado `#1644bf`, tinta `#091e5b`, Fredoka em títulos e botões, Inter no texto (fontes hospedadas via `fontes.css`), botão primário com "base" de 3px, logo branco no menu e golfinho original.
- **Raios e sombras:** 12px em controles e cards comuns, 16px em cards grandes; sem gradientes, glow ou sombras decorativas (só o menu da conta e a busca têm sombra leve).
- **Cards diferenciados por função:** projeto (área, título, resumo, autoria), publicação (lista com divisores), equipe (lista), atualizações (linha do tempo), estatística (tile) e solicitações pendentes (bloco em tom suave).
- **Botões:** primário (`.btn`), secundário (`.btn-soft`), discreto (`.profile-text-button`), `:disabled` e carregando (`.is-loading`, via `setBusy()` em `main.js`).
- **Tokens de tema:** `--nq-heading` (títulos), `--nq-nav-*` (menu). Em modo escuro o menu usa `#1a3a82`.
- **Ação principal:** "Criar projeto" fica no topo do menu lateral. No celular, cinco destinos com a mesma largura: Início, Projetos, Jogo, Pessoas e Perfil. O destino ativo usa fundo, ícone e texto; a criação aparece na área de projetos. Publicar continua no campo da Início.
- **Comunidade primeiro:** saudação de uma linha, compositor e feed no desktop. Coluna direita de 300px: projetos recentes (três itens), pessoas com habilidades, progresso compacto e acesso ao jogo com o SVG original inteiro. No celular não há saudação; os projetos entram depois de duas publicações (até dois itens), pessoas ficam em Pessoas e progresso no Perfil.
- **Dados:** área, habilidades e portfólio são opcionais e respeitam a visibilidade do perfil. Projetos têm resumo, etapa e como contribuir opcionais. As quatro áreas são prioritárias; categorias antigas permanecem em um disclosure. Não há notificações, nível ou XP inventados.
- **Proporção e leitura:** feed limitado a 720px, texto de 16px, ações de 44px; rótulos de compartilhamento podem ser omitidos a 360px, mantendo nome acessível. Sem malha de pontos ou elevação dos cartões. Cartões de apoio usam divisores e fundo transparente.
- **Perfil:** identidade, biografia, área, habilidades e portfólio no topo; publicações e projetos nas primeiras abas. Pontos e jornada ficam em Atividade. Conquistas mantêm a aba existente.

### Fonte e mapeamento de tokens sociais

O modelo de propriedade é runtime canônico: `public/css/social.css :root` define cores, tipografia, raios e dimensões; `theme.css` adapta os papéis semânticos aos temas. Este documento registra a intenção. A landing continua com `publico.css`.

| Papel | Token / proprietário | Consumidores |
|---|---|---|
| Marca e ação | `--nq-blue`, `--nq-blue-dark` / social.css + theme.css | `.btn`, links e estado ativo |
| Texto / apoio | `--nq-ink`, `--nq-heading`, `--nq-muted` | feed, projetos, pessoas, formulários |
| Superfícies | `--nq-surface`, `--nq-soft`, `--nq-canvas`, `--nq-border` | shell, listas e divisores |
| Estado | `--nq-ok`, `--nq-bad`, `--nq-like` | disponibilidade, erros e curtida |
| Tipografia | `--nq-font` Inter, `--nq-display` Fredoka | corpo / títulos e controles |
| Geometria | `--nq-nav-w` 232px, `--nq-r` 12px, `--nq-r-lg` 16px | shell e componentes compartilhados |

Comportamentos canônicos e evidências: [UX-CONTRACT.md](UX-CONTRACT.md).

### Reconciliação desta alteração

| Regra | Evidência anterior | Resolução |
|---|---|---|
| Sem sombras decorativas | theme.css acrescentava sombras, pontos e elevação no hover | Removido o bloco decorativo, mantidos foco e sombras dos menus |
| Criação global e comunidade em destaque | CTA repetido e projetos antes do compositor | Reorganizado conforme o fluxo da comunidade |
| Apenas dados disponíveis | Habilidades e contribuição inexistentes | Migração aditiva; campos opcionais, sem preencher perfis antigos |


## Motion

Aplica-se às páginas públicas (Inicial, Nexa Quest e Sobre). O movimento é **opcional e desligável**:
remova `public/css/animacoes.css` e `public/js/motion-publico.js` (e as duas linhas que os carregam) e o
site volta ao estático idêntico, sem tocar em mais nada. As ilustrações inline e o `data-reveal` ficam inertes.
`motion.js` é das páginas de login e não é usado aqui.

**Princípios.** Movimento serve a algo: feedback de ação, atenção a uma ilustração-chave ou vida discreta
no universo da marca (mar de circuitos, golfinho, jogo). Deslocamentos pequenos (8–20px). Só `transform` e
`opacity`. Sem dependências. Com `prefers-reduced-motion: reduce` ou sem JavaScript o site é idêntico ao
estático e tudo fica visível: todo o CSS de movimento está dentro de `(prefers-reduced-motion: no-preference)`.
Quando em dúvida, não anime.

**Catálogo permitido (quatro tipos, e só estes).**

1. *Feedback de interação (160–250ms):* brilho diagonal do `.pq-btn` desliza uma vez no hover; seta do
   `.pq-link` desloca 4px por `transform`; painel do menu mobile abre com opacidade e `scale(.96 → 1)`;
   barra de cor sob o título do `.area-item` cresce por `scaleX` (desktop); âncora `.area:target` acende o
   fundo e o apaga em 600ms (a faixa lateral colorida permanece); mensagens `.err`/`.status` entram com fade
   e 4px; campo inválido faz um único movimento lateral de 3px.
2. *Entrada de cenas ao rolar (um padrão):* `opacity 0 → 1` + `translateY(16px → 0)`, 500ms, uma única vez.
   Só em ilustrações: `.block-art`, `.panel--dupla`, `.panel--logo`, `.scene--ponte`, as molduras
   `.gallery .shot-frame` (parte de 1,5° a mais de rotação; a legenda não se move) e `.member-photo`.
   Itens do mesmo grupo (`data-reveal="grupo"`): 80ms entre eles, no máximo 3 por vez. Nunca em texto,
   botões, cabeçalhos, rodapé ou seção inteira.
3. *Vida discreta (ambiente, lenta):* golfinho do hero respira (`-4px`, 4s); nuvens (±24px, 44–60s) e
   brilhos (3–4s, defasados) dentro de `cena-hero-animada.svg`; onda do rodapé desliza 180px em 14s, linear
   e sem emenda; golfinho do convite final flutua (`-5px`, 3,5s). Pausam fora da tela
   (`[data-motion-paused]`) e com a aba oculta. No celular ficam só o golfinho do hero e a onda.
4. *Montagem das cenas-chave:* `cena-areas` (monitor, paleta, claquete, controle, golfinho por último, 120ms
   entre eles, total 0,9s) e `cena-trilha` (livro, alvo, bandeira, 150ms entre eles, total 0,7s), uma vez,
   com leve overshoot (`--ease-pop`). Essas duas cenas são SVG **inline** no HTML (`aria-hidden`, mesmo visual)
   com cada objeto em `.nq-obj`; os arquivos `cena-areas.svg` e `cena-trilha.svg` seguem no repositório.

**Tokens** (bloco "movimento" em `:root` de `publico.css`): `--dur-micro` 160ms, `--dur-ui` 240ms,
`--dur-reveal` 500ms, `--ease-out`, `--ease-pop`, `--dist-reveal` 16px, mais `--dur-shine`, `--dur-bar`,
`--dur-msg`, `--dur-target`, `--dur-pop` e `--stagger-*`. Não use valores soltos em `animacoes.css`
(exceção: os laços ambientes de 3,5s a 60s, que são específicos de cada elemento, e o `<style>` do SVG do
hero, que é outro documento e não enxerga os tokens da página).

**Como funciona.** `motion-publico.js` (com `defer`) só marca `.rv-wait` nos `[data-reveal]` que estão
*abaixo* da dobra e os revela com `IntersectionObserver`; o que já está na tela nunca é ocultado, então não há
"piscada" nem atraso no hero. Se o observer falhar ou não responder em 3s, tudo é mostrado. `will-change` só
existe durante a transição. O hero usa `<picture>`: a versão animada só é servida em telas largas e sem
preferência por movimento reduzido; caso contrário vale o `cena-hero.svg` original, que não é alterado.
O SVG do mascote nunca é editado.

**Proibido.** Fade-up em texto, títulos, parágrafos, listas, botões e seções; *typing*, letras separadas,
contadores, *blur-in*; parallax, *scroll-jacking*, cursor customizado; cards que levantam, brilham ou
inclinam (hover só em botões, links e itens de área); glow, brilho pulsante, degradê giratório, partículas,
orbes; botões ou ícones que pulsam ou balançam em loop; transição de página, confete; interações
acima de 700ms; animar `width`, `height`, `top/left`, `box-shadow`, `filter` ou `clip-path`;
`will-change` amplo; `!important` fora do bloco de movimento reduzido.

## Tela de carregamento (preloader)

Única exceção ao catálogo de movimento, aprovada de forma explícita: serve a **todas** as páginas (públicas, login/cadastro e área logada) e existe só para que ninguém veja a interface incompleta.

**Visual.** Fundo sólido navy `#091e5b`, o golfinho original `golfinho-fone.svg` centralizado e um anel de 26px em âmbar (`--sun`) girando em 0,9s. Sem degradê, brilho ou texto de marca. O anel só aparece após ~250ms (não pisca em cargas rápidas) e, depois de 6s, surge o aviso "Isso está demorando mais que o normal…". Com `prefers-reduced-motion: reduce` o anel fica parado e o fade vira troca imediata. Revelação por opacidade (240ms), sem atraso artificial.

**Contrato por página.**
1. `<html class="np-loading">`.
2. `css/preloader.css` é a **única** folha no `<head>` (e `preloader-off.css` dentro de `<noscript>`). As demais folhas ficam no início do `<body>`, **depois** do `#np-preloader`: assim o preloader é pintado antes delas (um `<link>` no `<head>` bloqueia o primeiro paint).
3. O `#np-preloader` é o primeiro filho do `<body>`.
4. `js/preloader.js` é o primeiro script `defer`; `js/session-boot.js` (área logada e login) vem entre `functions.js` e `main.js`.
Não há `<style>`, `<script>` ou `style=""` inline: a CSP `script-src 'self'; style-src 'self'` continua intacta.

**Quando revela** (`NPLoader`, em `preloader.js`): boot do `main.js` concluído (sessão verificada e shell/rodapé montados; páginas públicas **não** esperam a sessão) + folhas carregadas + fontes e imagens essenciais do 1º viewport (nada com `loading="lazy"`; espera limitada a 2,5s e 3s) + perfil próprio (limitado a 1,5s). Listas e feeds **não** seguram o preloader: têm *skeleton* próprio. Interações pequenas nunca o exibem novamente.

**Segurança contra travamento.** Revela após 12s no máximo; revela na hora se um script/folha falhar; e, se o JavaScript não rodar, o próprio CSS o remove em 14s. Com redirecionamento em curso (login com sessão, 401), o preloader permanece até a troca de página para não vazar a tela errada.

**Ao criar uma página nova**, copie o cabeçalho e o início do `<body>` de uma página existente da mesma família; `tests/preloader.test.js` valida o contrato.



### Composição social orientada a conversas

Referências consultadas: Reddit (busca central, navegação simples e divisores) e Nexa Quest publicado (identidade oficial). Composição própria: cabeçalho transversal de 64px com logo, busca de pessoas/habilidades (até 700px), Publicar e conta. Sidebar neutra de 232px sob o cabeçalho; Criar projeto fica depois de Meus projetos. O feed tem superfície uniforme, sem caixa externa, com divisores e ações em cápsulas. Pessoas usa lista compacta. A seleção usa fundo suave e acento azul; `theme.css` adapta `--nq-nav-*` aos tokens semânticos existentes. No celular, publicar continua no compositor e a navegação inferior é preservada.

Esta decisão substitui o painel azul lateral anterior; azul intenso fica nas ações. Backend, rotas e modelo social permanecem os mesmos. Evidências desta revisão: `artifacts/social/redesign-checks.json`, `rede-desktop.jpg`, `rede-celular.jpg` e `rede-desktop-escuro.jpg`.


### Correção de alinhamento e estados de conexões

O cabeçalho social usa três tracks explícitos: `--nq-nav-w`, centro flexível e ações. O logo é centralizado no primeiro track; ações permanecem no terceiro mesmo quando Pessoas usa apenas a busca local. O corpo usa margem inicial zero e largura máxima de 1440px (Início 1108px para preservar a medida do feed). Títulos `.nq-pagehead h1` são visíveis: o título oculto do antigo shell havia ficado sem correspondente no novo cabeçalho. Menu reserva borda transparente para não deslocar o item ativo; ícones e rótulos mantêm eixos iguais. Criação usa controle compacto de 172px junto de Meus projetos; grupos com respiro uniforme e Atividade acessível por rolagem interna em telas baixas. Pessoas usa abas em duas linhas no celular, contagens reais e estados de erro com nova tentativa. Evidências: `artifacts/social/correcao-layout-checks.json` e capturas `correcao-pessoas-*.jpg`.


### Restauração seletiva dos temas

A paleta hexadecimal permanece idêntica à versão `44e956b` (comparação automatizada com Git), mantendo a navegação neutra de `735a575`. Escuro: canvas `#101722`, superfície `#182230`, apoio `#222e3e`, borda `#2d3b4e`, texto `#e6edf8`, texto secundário/placeholder `#a7b3c8`, ação `#3a68d1`, link `#91b2ff` e ciano `#70dcff`. Sem preferência salva, o padrão e o fallback HTML são escuros; escolhas explícitas claras continuam válidas. `theme.css` é dono tanto da paleta quanto de color-scheme; o script não aplica estilo inline paralelo. Regras de hover primário excluem variantes secundárias; abas usam o token de seleção. Alteração restrita a cores e persistência de tema, sem reverter estrutura ou consultas de conexões.
