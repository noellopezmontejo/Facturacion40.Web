import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Empresa = sequelize.define('Empresa', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false, unique: true },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    tableName: 'empresas',
    timestamps: true
});
