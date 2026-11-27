-- Aplicar antes de publicar o backend. Aditiva, idempotente e sem alterar registros antigos.
BEGIN;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS area varchar(60);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS habilidades text[] NOT NULL DEFAULT '{}';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS portfolio_url text;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS como_contribuir text;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS etapa varchar(40);
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS resumo varchar(240);
COMMIT;
