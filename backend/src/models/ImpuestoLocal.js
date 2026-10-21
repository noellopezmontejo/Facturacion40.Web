import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const ImpuestoLocal = sequelize.define('ImpuestoLocal', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    tasa: { type: DataTypes.DECIMAL(10, 6), allowNull: false },
    tipo: { type: DataTypes.ENUM('traslado', 'retencion'), allowNull: false, defaultValue: 'retencion' },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'impuestos_locales',
    timestamps: true
});
