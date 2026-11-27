// Servidor de teste: arquivos estáticos + cabeçalhos do vercel.json + API SIMULADA (dados sintéticos, sem banco real).
// Nunca aponta para produção. Usado apenas pelos testes de navegador (tests/e2e).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSocialFixtures } from './social-fixtures.mjs';
const socialFixtures = process.env.SOCIAL_FIXTURES === '1' ? createSocialFixtures() : null;
const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUB = path.join(ROOT, 'public');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.mp4':'video/mp4' };
const rules = (vercel.headers||[]).map(r => ({ re: new RegExp('^' + r.source.replace(/\(\.\*\)/g, '.*') + '$'), headers: r.headers }));
const log = { requests: [], mensagens: [] }; let logged = true;
const cats = ['Jogos','Arte e design','Programação','Educação'];
const U = { id:'1', nome_usuario:'ana_teste', nome_exibicao:'Ana Teste', email:'ana@exemplo.invalid', pontos:0 };
const projetos = Array.from({length:10}, (_,i) => ({ id:String(100-i), titulo:`Projeto ${cats[i%4]} ${i+1}`, descricao:'Descrição de teste do projeto.', imagem_url:null, categoria:cats[i%4], link_externo:null, visibilidade:'publico', tipo:'equipe', proprietario_id:'2', proprietario:{id:'2',nome_usuario:'bia_teste',nome_exibicao:'Bia Teste',avatar_url:null}, total_participantes:1, participacao:null, criado_em:'2026-11-01T10:00:00Z', atualizado_em:'2026-11-01T10:00:00Z' }));
const pessoas = ['abel','abigail','abraao','abc_dev','ana_lima'].map((n,i)=>({id:String(10+i),nome_usuario:n,nome_exibicao:n.toUpperCase(),avatar_url:null,amizade:null}));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const send = (res, code, obj, extra={}) => { res.writeHead(code, { 'content-type':'application/json', ...extra }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
async function api(req, res, url) {
  const p = url.pathname.replace(/^\/api/, ''); const q = url.searchParams;
  log.requests.push(req.method + ' ' + p + url.search);
  if (p === '/__qa/logged') { logged = q.get('v') === '1'; return send(res, 200, {logged}); }
  if (p === '/__qa/log') return send(res, 200, log);
  if (p === '/me') return logged ? send(res, 200, U) : send(res, 401, { mensagem: 'Não autenticado.' });
  if (p === '/login' && req.method === 'POST') { logged = true; return send(res, 200, { usuario: U }); }
  if (p === '/logout') { logged = false; return send(res, 204); }
  if (p === '/auth/session') return send(res, 204);
  if (socialFixtures && await socialFixtures(req, res, url, send)) return;
  if (p === '/mensagens' && req.method === 'POST') { let b=''; for await (const c of req) b+=c; log.mensagens.push(JSON.parse(b)); await sleep(Number(q.get('d')||400)); return send(res, 201, { mensagem: 'ok' }); }
  if (p === '/projetos') {
    const cat = q.get('categoria'); const busca = (q.get('q')||'').toLowerCase();
    await sleep(cat === 'Jogos' ? 900 : 80);   // categoria lenta: provoca corrida entre pedidos
    if (q.get('__falha')) return send(res, 500, { mensagem: 'Falha simulada.' });
    const lista = projetos.filter(x => (!cat || x.categoria === cat) && (!busca || x.titulo.toLowerCase().includes(busca)));
    return send(res, 200, { projetos: q.get('vazio') ? [] : lista, proximoCursor: null });
  }
  if (p === '/usuarios/buscar') { const t = (q.get('q')||'').toLowerCase(); await sleep(t === 'ab' ? 700 : 60); return send(res, 200, { usuarios: pessoas.filter(x => x.nome_usuario.startsWith(t)) }); }
  if (p === '/usuarios/sugestoes') return send(res, 200, { usuarios: [] });
  if (p === '/me/amizades') return send(res, 200, { amigos: [], recebidas: [], enviadas: [] });
  if (p === '/me/projetos') return send(res, 200, { projetos: projetos.slice(0,3), proximoCursor: null });
  if (p === '/publicacoes') return send(res, 200, { publicacoes: [], proximoCursor: null });
  if (p === '/me/perfil') return send(res, 200, { usuario: { ...U, bio:'', estatisticas:{ pontos:1250, conquistas:2, progresso:{ concluidas:8, em_andamento:2, percentual:40,
    evolucao:[{mes:'2026-09',atividades_concluidas:3,pontos_registrados:300},{mes:'2026-10',atividades_concluidas:5,pontos_registrados:950}],
    historico:[{titulo:'Missão de teste',tipo:'missao',trilha:'Trilha de teste',pontuacao:120,concluida_em:'2026-10-20T12:00:00Z'},{titulo:'Desafio de teste',tipo:'desafio',trilha:'Trilha de teste',pontuacao:80,concluida_em:'2026-10-25T12:00:00Z'}],
    desempenho:[{tipo:'missao',concluidas:4,em_andamento:1,pontos_registrados:600},{tipo:'desafio',concluidas:3,em_andamento:1,pontos_registrados:500},{tipo:'conteudo',concluidas:1,em_andamento:0,pontos_registrados:150}] } },
    conquistas:[{id:'1',titulo:'Primeiro passo',descricao:'Conquista de teste.',obtida_em:'2026-10-02T12:00:00Z'}] } });
  if (p === '/jogo') return send(res, 200, { jogo: { titulo:'Nexa Quest', url:'https://itch.io/embed-upload/0000000' }, url:'https://itch.io/embed-upload/0000000' });
  if (p === '/projetos/998') return send(res, 500, { mensagem: 'Falha simulada.' });
  if (p === '/projetos/997') return send(res, 200, { projeto: { id:'997', titulo:'Projeto privado de equipe', categoria:'Jogos', tipo:'equipe', visibilidade:'privado', proprietario_id:'2', proprietario:{id:'2',nome_usuario:'bia_teste',nome_exibicao:'Bia Teste',avatar_url:null}, participacao:{status:'pendente',origem:'convite'}, acesso:'convite', sou_proprietario:false, pode_atualizar:false } });
  if (p.startsWith('/projetos/')) { const x = projetos.find(z => z.id === p.split('/')[2]); return x ? send(res, 200, { projeto: { ...x, participantes: [], atualizacoes: [], sou_proprietario:false, pode_atualizar:false } }) : send(res, 404, { mensagem: 'Projeto não encontrado.' }); }
  return send(res, 404, { mensagem: 'Rota de QA não simulada: ' + p });
}
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  let f = path.join(PUB, decodeURIComponent(url.pathname)); if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  const h = { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' };
  for (const r of rules) if (r.re.test(url.pathname)) for (const x of r.headers) h[x.key] = x.value;
  delete h['Strict-Transport-Security']; // http local
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('QA server up'));
