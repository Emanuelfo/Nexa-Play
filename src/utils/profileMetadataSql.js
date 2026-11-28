// Read optional collaboration metadata without requiring the additive migration.
// PostgreSQL returns NULL for absent JSON keys, including on legacy schemas.
module.exports = function profileMetadataSql(alias) {
  if (!/^[a-z_]+$/.test(alias)) throw new Error('Invalid SQL alias');
  const row = `to_jsonb(${alias})`;
  return {
    area: `(${row}->>'area')`,
    habilidades: `(CASE WHEN jsonb_typeof(${row}->'habilidades') = 'array' THEN ${row}->'habilidades' ELSE '[]'::jsonb END)`,
    portfolio: `(${row}->>'portfolio_url')`,
  };
};
