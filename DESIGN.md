---
version: alpha
name: Nexa Quest
description: Uma plataforma educacional de criação prática e colaborativa, apresentada com clareza e leveza.
colors:
  primary: "#2457eb"
  ink: "#091e5b"
  background: "#ffffff"
  paper: "#f4f7fd"
  border: "#dce3ef"
  muted: "#586781"
  pressed: "#1644bf"
typography:
  display:
    fontFamily: "Manrope, Inter, Segoe UI, sans-serif"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
rounded:
  DEFAULT: "12px"
  navigation: "999px"
spacing:
  page-max: "1120px"
  section: "64px"
components:
  button: {}
  navigation: {}
  footer: {}
  project-example: {}
---

# Nexa Quest

## Overview

A referência LikeLingo orienta a composição: fundo branco, ilustração expressiva
à esquerda, título e duas ações à direita, com bastante respiro. A assinatura
própria é o golfinho original cercado por quatro atalhos para as áreas de criação.
Sem redesenhar o mascote, mudar os logos ou copiar personagens e cores da referência.

Público: estudantes interessados em tecnologia e criação digital. Idioma pt-BR.
Registro: marketing educacional nas rotas públicas; produto nas rotas autenticadas.
O pedido atual substitui a direção anterior de mesa pontilhada e editor demonstrativo.

Fontes de contexto: briefing do usuário, README.md (API e limitações), schema de
projetos/progresso e perfilController.js. Projetos e equipes estão implementados;
XP, níveis e a integração de escrita do jogo não estão. Trilhas, missões e desafios
são apresentados como proposta educacional do jogo, com disponibilidade explícita.
A origem estudantil e a equipe vêm do briefing. Nenhum nome, foto, cargo ou parceria além dos informados é inferido.

## Colors

O CSS é a fonte canônica, modelo B. `public-header.css` define `--nx-ink`,
`--nx-white`, `--nx-ice` e a navegação. `public-pages.css` define a direção pública:
`primary` → `--nx-blue`; `paper` → `--nq-paper`; `border` → `--nq-border`;
`muted` → `--nq-muted`; `pressed` → `--nq-blue-pressed`.
`ink` e `background` correspondem a `--nx-ink` e `--nx-white`.

Branco para leitura, azul escuro para títulos, azul vibrante para ações e destaques.
Papel claro delimita apenas a seção de processo e as áreas de aprendizagem.
Foco em azul com afastamento visível. Scrollbars têm trilho, thumb e estados
explícitos; cores forçadas voltam à escolha do sistema.

## Typography

Manrope, peso 800, para títulos e ações públicas (`--nq-display`).
Inter para texto e campos (`--font`, de style.css). Títulos entre 28 e 64px,
corpo entre 14 e 17px, com entrelinha generosa. As fontes têm fallbacks locais.
Evitar texto em caixa alta, slogans vagos e etiquetas repetidas.
Login e Cadastro mantêm a tipografia e a composição existentes.

## Layout

`page-max` → `.nq-container`, 1120px com margens de 20–48px. Navegação branca,
arredondada, flutuante e em fluxo normal, com indicação discreta da página ativa.
Links centrais: Inicial, Nexa Quest, Sobre. Acessar plataforma sempre leva ao Login.
Até 800px, a navegação usa disclosure nativo com fechamento por Escape, clique
externo, saída de foco e troca para desktop.

Inicial: somente hero e processo em três etapas. No celular, texto e CTAs vêm
antes da ilustração para que as ações sejam alcançadas rapidamente.
Nexa Quest: introdução, lista editorial com exemplo de projeto, quatro áreas,
demonstração do jogo e CTA. Sobre: origem, equipe e propósito, mais contato expansível.
Sem alturas fixas em blocos de texto/formulários. Somente a composição ilustrada
possui dimensões reservadas. O documento controla a rolagem.

## Elevation & Depth

Bordas claras e sombras discretas. A navegação flutua suavemente; os atalhos da
ilustração e os botões têm uma pequena base que remete à linguagem de jogos.
Sem glow, glassmorphism, degradês generalizados ou animação ambiente.
A área de autenticação conserva o fundo azul escuro e formulário à direita.

## Shapes

Botões públicos com 12px e base de 4px; navegação em cápsula de 999px.
O golfinho e os logos são SVGs originais, sempre em proporção natural.
Ícones de área são vetores simples em learning.svg, sem personagens novos.

## Components

Cabeçalho e rodapé públicos reutilizam public-header.js e public-header.css.
public-pages.css compartilha botões, links, tipografia, containers, figuras,
áreas de aprendizagem e detalhes. landing-quest.css contém apenas a composição
específica da Inicial. O exemplo de projeto é estático e identificado como ilustração.
Não há formulário ou publicação simulada na apresentação pública atual.

O contato mantém os mesmos IDs, nomes e initContact de main.js. O detalhe abre
quando acessado pelo link #contato. A área de equipe apresenta os cinco integrantes informados
(nome, área de formação técnica, responsabilidades e foto em assets/imagens), em grade 3 + 2
e, em telas estreitas, em lista com foto ao lado do texto. Se uma foto não carregar, o quadro mostra a inicial.

auth-refinements.css é restrito a data-page=auth: rótulos visíveis, campos uniformes,
erros com espaço reservado, foco, alinhamento e rolagem natural em telas pequenas.
IDs, nomes, validações, APIs, autenticação e redirecionamentos permanecem existentes.
O botão Google, cuja integração já não estava configurada, indica indisponibilidade
e permanece desativado, com orientação para usar e-mail ou usuário.

Botões têm hover, foco, pressed e disabled. Links possuem destinos reais.
Movimento reduzido é respeitado; não usar motion.js nas novas páginas públicas.

## Do's and Don'ts

- Manter a primeira tela simples e dar protagonismo ao mascote original.
- Mostrar somente recursos implementados ou sinalizar a indisponibilidade.
- Usar as três páginas para separar começo, produto e equipe.
- Não inventar integrantes, resultados, parceiros ou funcionalidades.
- Não empilhar cards iguais, badges e grandes blocos de marketing.
- Não alterar o backend ou fluxos autenticados para justificar a apresentação.

## Área social (redesign)

Aplica-se às páginas autenticadas (`data-protected`): início, explorar, meus projetos, criar/detalhe de projeto, perfil, pessoas e atividade no jogo. Estilos em `public/css/social.css` e `theme.css`; estrutura montada por `renderSocialShell` em `public/js/main.js`.

- **Estrutura:** menu lateral azul (`#2457eb`, 256px; 76px só com ícones no tablet; barra inferior no celular), cabeçalho branco de 64px (título da página, busca de pessoas, tema, conta) e área principal cinza `#f4f6fa` com cards brancos.
- **Identidade herdada da landing:** azul `#2457eb`, azul pressionado `#1644bf`, tinta `#091e5b`, Fredoka em títulos e botões, Inter no texto (fontes hospedadas via `fontes.css`), botão primário com "base" de 3px, logo branco no menu e golfinho original.
- **Raios e sombras:** 12px em controles e cards comuns, 16px em cards grandes; sem gradientes, glow ou sombras decorativas (só o menu da conta e a busca têm sombra leve).
- **Cards diferenciados por função:** projeto (área, título, resumo, autoria), publicação (lista com divisores), equipe (lista), atualizações (linha do tempo), estatística (tile) e solicitações pendentes (bloco em tom suave).
- **Botões:** primário (`.btn`), secundário (`.btn-soft`), discreto (`.profile-text-button`), `:disabled` e carregando (`.is-loading`, via `setBusy()` em `main.js`).
- **Tokens de tema:** `--nq-heading` (títulos), `--nq-nav-*` (menu). Em modo escuro o menu usa `#1a3a82`.
- **Ação principal:** "Criar projeto" fica no topo do menu (e como "+" na barra inferior do celular). Publicar uma postagem continua no campo da Início.
- **Sem dados novos:** não há notificações, áreas de interesse, habilidades, nível ou XP no backend; a interface não finge essas informações.

