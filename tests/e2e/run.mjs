// Sobe a API simulada e executa os testes de navegador. Requer playwright-core e um Chromium instalado.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || '4173';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(dir, 'mock-server.mjs')], { env: { ...process.env, PORT: port }, stdio: 'inherit' });
const esperar = async () => { for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/__qa/log'); return; } catch { await new Promise(r => setTimeout(r, 100)); } } throw new Error('servidor de teste não iniciou'); };
let codigo = 0;
try {
  await esperar();
  for (const arquivo of ['csp.mjs', 'regressao.mjs', 'jogo.mjs']) {
    console.log(`\n== ${arquivo}`);
    const filho = spawn(process.execPath, [path.join(dir, arquivo)], { env: { ...process.env, BASE: base }, stdio: 'inherit' });
    const saida = await new Promise(resolve => filho.on('exit', resolve));
    if (saida !== 0) codigo = 1;
  }
} finally { server.kill(); }
process.exit(codigo);
