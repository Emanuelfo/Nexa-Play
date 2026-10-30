const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Usuario = sequelize.define("Usuario", {
  nome: { type: DataTypes.STRING, allowNull: false },
  sobrenome: { type: DataTypes.STRING, allowNull: false },
  // E-mail (minúsculo) ou celular (somente dígitos). É o identificador de login.
  contato: { type: DataTypes.STRING, allowNull: false, unique: true },
  senha: { type: DataTypes.STRING, allowNull: false },
  nascimento: { type: DataTypes.DATEONLY, allowNull: false },
  genero: { type: DataTypes.ENUM("Feminino", "Masculino", "Outros"), allowNull: false },
  // Foto de perfil reduzida (data URL JPEG 128x128)
  avatar: { type: DataTypes.TEXT("medium"), allowNull: true },
  nivel: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  desafios: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  conquistas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = Usuario;
