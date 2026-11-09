import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Empresa = sequelize.define('Empresa', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false, unique: true },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
    smtp_host: { type: DataTypes.STRING, allowNull: true },
    smtp_port: { type: DataTypes.INTEGER, defaultValue: 587 },
    smtp_secure: { type: DataTypes.BOOLEAN, defaultValue: false },
    smtp_user: { type: DataTypes.STRING, allowNull: true },
    smtp_pass: { type: DataTypes.STRING, allowNull: true },
    smtp_from_name: { type: DataTypes.STRING, allowNull: true },
    smtp_from_email: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'empresas',
    timestamps: true
});
