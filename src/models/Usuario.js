const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Usuario = sequelize.define("Usuario", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  nome_usuario: { type: DataTypes.STRING, allowNull: false },
  nome_exibicao: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  senha: { type: DataTypes.STRING, allowNull: false },
  pontos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  biografia: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  avatar_url: { type: DataTypes.TEXT, allowNull: true },
  capa_url: { type: DataTypes.TEXT, allowNull: true },
  perfil_publico: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  mostrar_biografia: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  mostrar_pontos: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  mostrar_amigos: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  mostrar_conquistas: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  mostrar_progresso: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: "usuarios",
  underscored: true,
  createdAt: "criado_em",
  updatedAt: "atualizado_em",
});



module.exports = Usuario;
