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
    smtp_from_email: { type: DataTypes.STRING, allowNull: true },

    // Esquema de Suscripción y Licenciamiento
    plan_codigo: { type: DataTypes.STRING(50), defaultValue: 'negocio' }, // 'basico', 'negocio', 'corporativo'
    periodo_suscripcion: { type: DataTypes.STRING(20), defaultValue: 'mensual' }, // 'mensual' o 'anual'
    precio_personalizado: { type: DataTypes.DECIMAL(10, 2), allowNull: true }, // null = toma el precio del catálogo global
    folios_incluidos: { type: DataTypes.INTEGER, defaultValue: 200 },
    fecha_inicio: { type: DataTypes.DATE, allowNull: true },
    fecha_vencimiento: { type: DataTypes.DATE, allowNull: true },
    estado_suscripcion: { type: DataTypes.STRING(30), defaultValue: 'activa' }, // 'activa', 'periodo_gracia', 'vencida', 'suspendida'
    notas_suscripcion: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'empresas',
    timestamps: true
});
