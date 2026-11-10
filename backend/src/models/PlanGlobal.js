import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const PlanGlobal = sequelize.define('PlanGlobal', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo: { type: DataTypes.STRING(50), allowNull: false, unique: true }, // 'basico', 'negocio', 'corporativo'
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    precio_mensual: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 149.00 },
    precio_anual: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1490.00 },
    folios_mensuales: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    max_emisores: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    max_usuarios: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    permite_cotizaciones: { type: DataTypes.BOOLEAN, defaultValue: false },
    permite_ordenes_servicio: { type: DataTypes.BOOLEAN, defaultValue: false },
    permite_carta_porte: { type: DataTypes.BOOLEAN, defaultValue: false },
    permite_recurrentes: { type: DataTypes.BOOLEAN, defaultValue: false },
    permite_descarga_sat: { type: DataTypes.BOOLEAN, defaultValue: false },
    es_popular: { type: DataTypes.BOOLEAN, defaultValue: false },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
    orden: { type: DataTypes.INTEGER, defaultValue: 1 }
}, {
    tableName: 'planes_globales',
    timestamps: true
});

