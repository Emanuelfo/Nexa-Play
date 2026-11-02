const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Usuario = sequelize.define("Usuario", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  nome_usuario: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  senha: { type: DataTypes.STRING, allowNull: false },
  pontos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: "usuarios",
  underscored: true,
  createdAt: "criado_em",
  updatedAt: "atualizado_em",
});



module.exports = Usuario;
