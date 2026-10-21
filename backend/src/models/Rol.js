import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Rol = sequelize.define('Rol', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false, unique: true }, // Administrador, Usuario Empresarial, Operador
    descripcion: { type: DataTypes.STRING }
}, {
    tableName: 'roles',
    timestamps: true
});
