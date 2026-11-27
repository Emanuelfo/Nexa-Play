# Correções de layout e conexões

## Diagnóstico

Na versão publicada, a sessão e o feed responderam, mas Pessoas exibiu erro de sugestões e não carregou contagens. Isso foi reproduzido na sessão existente do navegador, sem alterar contas ou dados. O banco configurado no workspace respondeu normalmente às mesmas consultas; portanto, a configuração exata do backend publicado não foi confirmada.

O código novo referenciava diretamente `usuarios.area` e `usuarios.habilidades`. Um teste de PostgreSQL com tabelas temporárias sem essas colunas reproduziu **42703 (undefined_column)**. As leituras agora usam `profileMetadataSql` para extrair campos opcionais da representação JSON da linha. Perfis sem colunas ou sem valores continuam carregando com área nula e habilidades vazias, mantendo as regras de privacidade. Não foi removida autenticação nem escondida uma falha real como lista vazia. A gravação de novos campos ainda requer a migração documentada.

## Layout

- Cabeçalho em três tracks: largura da lateral, centro flexível e ações à direita. Busca oculta em Pessoas não desloca as ações.
- Logo centralizado: centro em 116px, correspondente à lateral de 232px. Ícones do menu alinhados em x=28px, inclusive o botão Criar projeto e o item ativo.
- Margem automática centralizada removida do corpo: conteúdo inicia a 28px da lateral no desktop.
- Títulos restaurados: a regra antiga escondia h1 porque o título ficava no antigo cabeçalho; o redesign havia ocultado ambos.
- Menu em grupos, botão Criar projeto compacto, espaçamento estável e Atividade acessível com rolagem em 480px de altura.
- Abas de Pessoas em duas linhas no celular, com rótulos completos e controles de 44px.

## Conexões e estados

Erros de sugestões, amizades e busca têm Tentar novamente; filtros e seleção de aba são preservados. Contagens só usam valores reais retornados pela API. Limpar filtros e buscas sem termo voltam à rede. Resultados vazios oferecem limpeza. Respostas antigas não sobrescrevem novas listas. O Início também permite repetir sugestões.

## Verificação executada

- `node tests/social-schema-live.cjs`: passou em PostgreSQL real, somente com tabelas temporárias e rollback; esquema antigo, relações aceitas/recebidas, nome, área sem termo, habilidades modernas e privacidade.
- `node --test tests/social-colaboracao.test.js tests/projetos-acesso.test.js`: 16/16.
- `npm test`: 51/52; permanece a falha preexistente que encontra referências a Google em arquivos legados não alterados.
- Navegador: quatro abas, adicionar/cancelar/aceitar/recusar, contagens atualizadas, buscar habilidade, filtro de área, nenhum resultado, limpar, falha e retry de sugestões, busca e amizades. Retry manteve Godot no campo.
- 40 combinações: Início, Pessoas, Projetos e Perfil × larguras 360/390/430/1366/1896 × claro/escuro; nenhuma rolagem horizontal. `correcao-layout-checks.json`.
- Sintaxe JS, lint DESIGN.md, auditoria premium estrita e git diff --check passaram.
- Capturas `correcao-pessoas-desktop.jpg` e `correcao-pessoas-celular.jpg` usam dados fictícios de QA.

## Limites e publicação

As correções estão no workspace. Não houve deploy; não é possível declarar restaurada a versão publicada antes de publicar o backend e o frontend corrigidos. O cenário de esquema antigo foi comprovado, mas a causa exata do erro do servidor publicado ainda depende de seus logs/configuração. Teste com teclado virtual em aparelho físico e suíte Playwright antiga (dependência ausente) continuam pendentes.
