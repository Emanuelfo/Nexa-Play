const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.JWT_SECRET = 'a'.repeat(48);
const { urlDoJogo, dimensaoDoJogo, modoDeExibicao } = require('../src/controllers/jogoController');
const jogoRoutes = require('../src/routes/jogoRoutes');

const PADRAO = 'https://itch.io/embed-upload/20479421?color=000000';

test('URL do jogo: usa o padrão e rejeita valores que não sejam embed do itch.io', () => {
  const original = process.env.GAME_EMBED_URL;
  try {
    delete process.env.GAME_EMBED_URL;
    assert.equal(urlDoJogo(), PADRAO);
    for (const invalida of ['http://itch.io/embed-upload/1', 'https://evil.example/embed-upload/1', 'https://itch.io/outra-rota', 'javascript:alert(1)', 'lixo']) {
      process.env.GAME_EMBED_URL = invalida;
      assert.equal(urlDoJogo(), PADRAO, invalida);
    }
    process.env.GAME_EMBED_URL = 'https://itch.io/embed-upload/999?color=111111';
    assert.equal(urlDoJogo(), 'https://itch.io/embed-upload/999?color=111111');
  } finally {
    if (original === undefined) delete process.env.GAME_EMBED_URL; else process.env.GAME_EMBED_URL = original;
  }
});

test('GET /api/jogo exige sessão: sem cookie/token responde 401 e não revela a URL', async () => {
  const app = express();
  app.use(jogoRoutes);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const resposta = await fetch(`http://127.0.0.1:${port}/api/jogo`);
    assert.equal(resposta.status, 401);
    assert.doesNotMatch(await resposta.text(), /itch\.io|20479421/);
  } finally {
    server.close();
  }
});

test('dimensões do jogo: aceita inteiros entre 320 e 7680 e cai no padrão para o resto', () => {
  assert.equal(dimensaoDoJogo('1280', 1920), 1280);
  assert.equal(dimensaoDoJogo(' 1080 ', 1080), 1080);
  for (const invalida of [undefined, '', 'abc', '12.5', '-1920', '100', '99999', '1e3', '0x780']) {
    assert.equal(dimensaoDoJogo(invalida, 1920), 1920, String(invalida));
  }
});

test('modo de exibição: "fluid" por padrão e "scaled" somente quando configurado', () => {
  const original = process.env.GAME_VIEWPORT_MODE;
  try {
    delete process.env.GAME_VIEWPORT_MODE;
    assert.equal(modoDeExibicao(), 'fluid');
    process.env.GAME_VIEWPORT_MODE = ' Scaled ';
    assert.equal(modoDeExibicao(), 'scaled');
    for (const outro of ['', 'fullscreen', 'SCALE', '1']) {
      process.env.GAME_VIEWPORT_MODE = outro;
      assert.equal(modoDeExibicao(), 'fluid', outro);
    }
  } finally {
    if (original === undefined) delete process.env.GAME_VIEWPORT_MODE; else process.env.GAME_VIEWPORT_MODE = original;
  }
});
