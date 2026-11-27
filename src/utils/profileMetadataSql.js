// Optional columns may not yet exist during a rolling schema deployment.
// Reading the row as JSON keeps legacy profiles usable without inventing metadata.
function profileMetadataSql(alias) {
  if (!/^[a-z_]+$/.test(alias)) throw new Error('Invalid static SQL alias');
  const row = `to_jsonb(${alias})`;
  return {
    area: `${row}->>'area'`,
    habilidades: `(CASE WHEN jsonb_typeof(${row}->'habilidades') = 'array' THEN ${row}->'habilidades' ELSE '[]'::jsonb END)`,
    portfolio: `${row}->>'portfolio_url'`,
  };
}
module.exports = profileMetadataSql;
