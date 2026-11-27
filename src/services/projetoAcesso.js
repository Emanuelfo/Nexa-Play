// Regras centrais de acesso a projetos (A01) e de reabertura de participação (A11).
// Tudo que decide "quem pode ver o quê" passa por aqui; o frontend só reflete a resposta do servidor.
//
// Níveis de acesso de um usuário a um projeto:
//   proprietario  dono do projeto: vê tudo e gerencia a equipe
//   participante  participação ACEITA: vê tudo (inclusive se o projeto for privado)
//   publico       projeto público: qualquer usuário autenticado vê a visão completa
//   convite       projeto PRIVADO com convite pendente: vê só o necessário para decidir (visão mínima)
//   nenhum        sem acesso: a API responde 404, igual a um projeto inexistente
//
// Solicitação pendente, recusada ou removida NÃO dá acesso a projeto privado.

const REABERTURA_HORAS = 24;

function ehProprietario(projeto, usuarioId) {
  return projeto?.proprietario_id !== undefined && projeto?.proprietario_id !== null
    && String(projeto.proprietario_id) === String(usuarioId);
}

function nivelAcesso(projeto, usuarioId) {
  if (!projeto) return "nenhum";
  if (ehProprietario(projeto, usuarioId)) return "proprietario";
  const participacao = projeto.participacao || null;
  if (participacao?.status === "aceito") return "participante";
  if (projeto.visibilidade === "publico") return "publico";
  if (participacao?.status === "pendente" && participacao.origem === "convite") return "convite";
  return "nenhum";
}

// Visão mínima de um convite para projeto privado: sem descrição, imagem, link, equipe ou atualizações.
function visaoConvite(projeto) {
  const proprietario = projeto.proprietario || {};
  return {
    id: projeto.id,
    titulo: projeto.titulo,
    categoria: projeto.categoria,
    tipo: projeto.tipo,
    visibilidade: projeto.visibilidade,
    proprietario_id: projeto.proprietario_id,
    proprietario: {
      id: proprietario.id,
      nome_usuario: proprietario.nome_usuario,
      nome_exibicao: proprietario.nome_exibicao,
      avatar_url: proprietario.avatar_url ?? null,
    },
    participacao: projeto.participacao,
    acesso: "convite",
  };
}

// Aplica o nível de acesso a um projeto já carregado. Retorna null quando o usuário não pode vê-lo.
function aplicarAcesso(projeto, usuarioId) {
  const acesso = nivelAcesso(projeto, usuarioId);
  if (acesso === "nenhum") return null;
  if (acesso === "convite") return visaoConvite(projeto);
  return { ...projeto, acesso };
}

// Condição SQL da listagem "Meus projetos": dono, participação aceita, convite pendente
// ou solicitação pendente de projeto que continua público.
function condicaoMeusProjetos(alias = "p") {
  return `(
    ${alias}.proprietario_id = :usuarioId
    OR EXISTS (
      SELECT 1 FROM projeto_participantes membro
      WHERE membro.projeto_id = ${alias}.id
        AND membro.usuario_id = :usuarioId
        AND (
          membro.status = 'aceito'
          OR (membro.status = 'pendente' AND (membro.origem = 'convite' OR ${alias}.visibilidade = 'publico'))
        )
    )
  )`;
}

module.exports = {
  REABERTURA_HORAS,
  ehProprietario,
  nivelAcesso,
  aplicarAcesso,
  visaoConvite,
  condicaoMeusProjetos,
};
