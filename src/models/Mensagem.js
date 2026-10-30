const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Usuario = require("./Usuario");

// Mensagens enviadas pelo formulário de contato
const Mensagem = sequelize.define("Mensagem", {
  nome: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  assunto: { type: DataTypes.STRING, allowNull: false },
  texto: { type: DataTypes.TEXT, allowNull: false },
});

// usuario_id é opcional: visitantes sem login também podem enviar mensagem
Usuario.hasMany(Mensagem, { foreignKey: "usuario_id" });
Mensagem.belongsTo(Usuario, { foreignKey: "usuario_id" });

module.exports = Mensagem;
