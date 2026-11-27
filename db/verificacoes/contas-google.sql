-- SOMENTE LEITURA. Nenhum comando abaixo altera dados.
-- Rode no SQL Editor do Supabase para saber como a remoção do login com Google afeta as contas existentes.
-- O login com Google foi removido do Nexa Quest; as colunas google_sub e google_vinculado_em continuam na tabela
-- (não houve migração destrutiva) e não são mais lidas pela aplicação.

-- 1) Quantas contas têm vínculo com Google e quantas possuem senha própria?
SELECT
  count(*) FILTER (WHERE google_sub IS NOT NULL)                              AS contas_com_google,
  count(*) FILTER (WHERE google_sub IS NOT NULL AND senha IS NOT NULL)        AS google_com_senha_local,
  count(*) FILTER (WHERE google_sub IS NOT NULL AND senha IS NULL)            AS google_sem_senha_local
FROM usuarios;

-- Como interpretar:
--  google_com_senha_local : continuam entrando normalmente com e-mail/usuário + senha.
--  google_sem_senha_local : NÃO conseguem mais entrar (não existe senha e não há recuperação de senha nesta versão).
--                           Decida com cada pessoa antes de qualquer ação; não altere essas contas sem autorização.

-- 2) (Opcional) Lista mínima das contas sem senha local, sem dados sensíveis.
SELECT id, nome_usuario, google_vinculado_em
FROM usuarios
WHERE google_sub IS NOT NULL AND senha IS NULL
ORDER BY id;
