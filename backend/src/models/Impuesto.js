import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Impuesto = sequelize.define('Impuesto', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    descripcion: { type: DataTypes.STRING, allowNull: false }, // IVA 16%, RET ISR, etc.
    tipo: { type: DataTypes.ENUM('traslado', 'retencion'), allowNull: false },
    impuesto_sat: { type: DataTypes.STRING(3), allowNull: false }, // 002 = IVA, 001 = ISR, 003 = IEPS
    tipo_factor: { type: DataTypes.STRING(10), allowNull: false }, // Tasa, Cuota, Exento
    tasa_cuota: { type: DataTypes.DECIMAL(10, 6), allowNull: false }, // ej: 0.160000
    empresa_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'impuestos',
    timestamps: true
});
