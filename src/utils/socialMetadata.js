// Vocabulário público da comunidade. Categorias antigas de projetos continuam válidas.
const AREAS = ['Desenvolvimento de Sistemas', 'Design', 'Multimídia', 'Jogos Digitais'];
const CATEGORIAS_LEGADAS = ['Jogos', 'Arte e design', 'Programação', 'Educação', 'Música', 'Outros'];
const ETAPAS = ['Ideia', 'Em desenvolvimento', 'Em testes', 'Concluído'];

function validarCompetencias(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 12 || value.some(s => typeof s !== 'string' || !s.trim() || s.trim().length > 40)) {
    throw new Error('Informe até 12 habilidades, com no máximo 40 caracteres cada.');
  }
  return [...new Map(value.map(s => [s.trim().toLocaleLowerCase('pt-BR'), s.trim()])).values()];
}

module.exports = { AREAS, CATEGORIAS_LEGADAS, ETAPAS, validarCompetencias };
