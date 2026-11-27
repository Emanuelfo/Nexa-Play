// Opt-in synthetic community for local UX verification. Never used by src/app.js.
export function createSocialFixtures() {
  const me = { id: '1', nome_usuario: 'ana_teste', nome_exibicao: 'Ana Teste', area: 'Desenvolvimento de Sistemas', habilidades: ['Python', 'Interfaces'], biografia: 'Estudante de sistemas. Criando ferramentas para aprender em comunidade.', portfolio_url: null, avatar_url: null, capa_url: null, criado_em: '2026-03-10', privacidade: { perfil_publico: true, mostrar_biografia: true, mostrar_pontos: true, mostrar_amigos: true, mostrar_conquistas: true, mostrar_progresso: true }, estatisticas: { pontos: 1250, amigos: 3, conquistas: 2, progresso: { concluidas: 8, em_andamento: 2, total: 20, percentual: 40, historico: [], evolucao: [], desempenho: [] } }, conquistas: [] };
  const people = [
    { id: '2', nome_exibicao: 'Bia Teste', nome_usuario: 'bia_teste', area: 'Jogos Digitais', habilidades: ['Godot', 'Pixel art'], biografia: 'Criando jogos sobre o oceano.', relacao: 'desconhecido' },
    { id: '3', nome_exibicao: 'Caio Teste', nome_usuario: 'caio_teste', area: 'Multimídia', habilidades: ['Edição de vídeo', 'Animação'], relacao: 'recebida' },
    { id: '4', nome_exibicao: 'Lia Teste', nome_usuario: 'lia_teste', area: 'Design', habilidades: ['Interfaces', 'Figma'], relacao: 'amigos' },
  ];
  const projects = [
    { id: '100', titulo: 'Maré: uma aventura em pixel art', categoria: 'Jogos Digitais', descricao: 'Um jogo de exploração sobre a vida marinha. Cada descoberta ajuda a entender o equilíbrio do oceano.', resumo: 'Explore o oceano em uma aventura feita em Godot.', como_contribuir: 'Procuramos alguém para criar cenários em pixel art e testar as primeiras fases. Compartilhe seu portfólio com a equipe ao se conectar.', etapa: 'Em desenvolvimento', proprietario: people[0] },
    { id: '99', titulo: 'Vozes do campus', categoria: 'Multimídia', descricao: 'Uma série de vídeos sobre os projetos criados pelos estudantes.', como_contribuir: 'Precisamos de ajuda com edição de vídeo e trilha sonora.', etapa: 'Ideia', proprietario: people[1] },
    { id: '98', titulo: 'Mapa de estudos', categoria: 'Desenvolvimento de Sistemas', descricao: 'Organize tarefas e compartilhe recursos de estudo com sua turma.', como_contribuir: 'Ajude a desenhar interfaces acessíveis e integrar a API Python.', etapa: 'Em testes', proprietario: me },
  ].map(p => ({ ...p, proprietario_id: p.proprietario.id, tipo: 'equipe', visibilidade: 'publico', total_participantes: 1, participacao: null, participantes: [p.proprietario], atualizacoes: [], criado_em: new Date().toISOString() }));
  const posts = [
    { id: '10', autor: people[0], texto: 'O primeiro cenário de Maré está pronto! 🌊\nEstou experimentando uma paleta azul e animações em pixel art. Alguém que usa Godot quer trocar ideias sobre a movimentação do personagem?', curtidas: 12, quantidade_comentarios: 1, criado_em: new Date(Date.now() - 20 * 60000).toISOString() },
    { id: '9', autor: people[1], texto: 'Como vocês contam a história de um projeto em um vídeo de um minuto? Estamos montando a primeira edição de Vozes do campus e procurando referências de edição.', curtidas: 5, quantidade_comentarios: 0, criado_em: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: '8', autor: people[2], texto: 'Compartilhando o que aprendi ao testar interfaces por teclado.\n' + 'Uma interface acessível ajuda toda a equipe a colaborar. '.repeat(12) + '\nhttps://example.invalid/' + 'referencia'.repeat(60), curtidas: 3, quantidade_comentarios: 0, criado_em: new Date(Date.now() - 5 * 3600000).toISOString() },
  ];
  const comments = new Map([['10', [{ id: '1', autor: me, texto: 'Quero conhecer os testes de movimento!', criado_em: new Date().toISOString() }]]]);
  let failNext = ''; let failGet = false;
  const jsonBody = async req => { let body = ''; for await (const chunk of req) body += chunk; return body ? JSON.parse(body) : {}; };
  return async (req, res, url, send) => {
    const p = url.pathname.replace(/^\/api/, '');
    const q = url.searchParams;
    if (p === '/__qa/fail-next') { failNext = q.get('path'); failGet = q.get('method') === 'GET'; send(res, 200, { ready: true }); return true; }
    if (failNext === p && (failGet || req.method !== 'GET')) { failNext = ''; send(res, 500, { mensagem: 'Falha simulada. Tente novamente; seu texto foi mantido.' }); return true; }
    if (p === '/me/perfil') {
      if (req.method === 'PUT') Object.assign(me, await jsonBody(req));
      send(res, 200, { usuario: me }); return true;
    }
    if (p === '/usuarios/buscar') {
      const term = (q.get('q') || '').toLocaleLowerCase('pt-BR');
      send(res, 200, { usuarios: people.filter(u => (!q.get('area') || u.area === q.get('area')) && (!term || [u.nome_exibicao, u.nome_usuario, u.biografia, ...u.habilidades].join(' ').toLocaleLowerCase('pt-BR').includes(term))) }); return true;
    }
    if (p === '/usuarios/sugestoes') { send(res, 200, { usuarios: people.filter(u => u.relacao === 'desconhecido') }); return true; }
    if (p === '/me/amizades') { send(res, 200, { amigos: people.filter(u => u.relacao === 'amigos'), recebidas: people.filter(u => u.relacao === 'recebida'), enviadas: people.filter(u => u.relacao === 'enviada') }); return true; }
    const userMatch = p.match(/^\/usuarios\/(\d+)\/(perfil|amizade)$/);
    if (userMatch) {
      const person = people.find(u => u.id === userMatch[1]);
      if (!person) { send(res, 404, { mensagem: 'Perfil não encontrado.' }); return true; }
      if (userMatch[2] === 'amizade') person.relacao = req.method === 'POST' ? 'enviada' : req.method === 'PUT' ? 'amigos' : 'desconhecido';
      send(res, 200, userMatch[2] === 'amizade' ? { amizade: { status: person.relacao } } : { usuario: { ...person, criado_em: '2026-04-01', estatisticas: { pontos: null, amigos: null, conquistas: null, progresso: null }, amizade: { status: person.relacao === 'desconhecido' ? 'nenhuma' : person.relacao }, conquistas: null } }); return true;
    }
    if (p === '/publicacoes') {
      if (req.method === 'POST') { const body = await jsonBody(req); const post = { id: String(Date.now()), autor: me, texto: body.texto, curtidas: 0, quantidade_comentarios: 0, criado_em: new Date().toISOString() }; posts.unshift(post); send(res, 201, { publicacao: post }); }
      else send(res, 200, { publicacoes: posts.filter(post => !q.get('usuario') || post.autor.id === q.get('usuario')), proximoCursor: null });
      return true;
    }
    const postMatch = p.match(/^\/publicacoes\/(\d+)(?:\/(curtida|comentarios))?$/);
    if (postMatch) {
      const post = posts.find(post => post.id === postMatch[1]);
      if (!post) { send(res, 404, { mensagem: 'Publicação não encontrada.' }); return true; }
      if (postMatch[2] === 'curtida') { const liked = req.method === 'PUT'; if (!!post.curtida_pelo_usuario !== liked) post.curtidas += liked ? 1 : -1; post.curtida_pelo_usuario = liked; send(res, 200, { curtida: liked, curtidas: post.curtidas }); }
      else if (postMatch[2] === 'comentarios') {
        const list = comments.get(post.id) || [];
        if (req.method === 'POST') { const body = await jsonBody(req); const comment = { id: String(Date.now()), autor: me, texto: body.texto, criado_em: new Date().toISOString() }; list.unshift(comment); comments.set(post.id, list); post.quantidade_comentarios++; send(res, 201, { comentario: comment }); }
        else send(res, 200, { comentarios: list, proximoCursor: null });
      } else send(res, 200, { publicacao: post });
      return true;
    }
    if (p === '/projetos' || p === '/me/projetos') {
      if (req.method === 'POST') { const body = await jsonBody(req); const project = { ...body, id: String(Date.now()), proprietario: me, proprietario_id: me.id, participantes: [me], atualizacoes: [] }; projects.unshift(project); send(res, 201, { projeto: project }); }
      else send(res, 200, { projetos: projects.filter(p => (url.pathname !== '/api/me/projetos' || p.proprietario_id === me.id || p.participacao) && (!q.get('usuario') || p.proprietario_id === q.get('usuario')) && (!q.get('categoria') || p.categoria === q.get('categoria')) && (!q.get('q') || p.titulo.toLowerCase().includes(q.get('q').toLowerCase()))).slice(0, Number(q.get('limite') || 12)), proximoCursor: null });
      return true;
    }
    const projectMatch = p.match(/^\/projetos\/(\d+)(?:\/(solicitacoes|atualizacoes|participantes\/1))?$/);
    if (projectMatch) {
      const project = projects.find(p => p.id === projectMatch[1]);
      if (!project) return false;
      if (projectMatch[2] === 'solicitacoes') project.participacao = { status: 'pendente', origem: 'solicitacao' };
      else if (projectMatch[2] === 'participantes/1') project.participacao = null;
      else if (projectMatch[2] === 'atualizacoes') { const body = await jsonBody(req); project.atualizacoes.unshift({ id: String(Date.now()), texto: body.texto, autor: me, criado_em: new Date().toISOString() }); }
      else if (req.method === 'PUT') Object.assign(project, await jsonBody(req));
      send(res, 200, { projeto: { ...project, sou_proprietario: project.proprietario_id === me.id, pode_atualizar: project.proprietario_id === me.id || project.participacao?.status === 'aceito' } }); return true;
    }
    return false;
  };
}
