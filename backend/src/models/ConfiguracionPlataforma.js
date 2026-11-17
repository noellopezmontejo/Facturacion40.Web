import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const ConfiguracionPlataforma = sequelize.define('ConfiguracionPlataforma', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    mp_activo: { type: DataTypes.BOOLEAN, defaultValue: true },
    mp_modo: { type: DataTypes.STRING(20), defaultValue: 'produccion' }, // 'produccion' | 'sandbox'
    mp_access_token: { type: DataTypes.TEXT, allowNull: true },
    mp_public_key: { type: DataTypes.STRING(255), allowNull: true },
    mp_webhook_secret: { type: DataTypes.STRING(255), allowNull: true },
    banorte_activo: { type: DataTypes.BOOLEAN, defaultValue: true },
    banco_nombre: { type: DataTypes.STRING(100), defaultValue: 'BANORTE' },
    banco_beneficiario: { type: DataTypes.STRING(255), defaultValue: 'Net Consultores' },
    banco_clabe: { type: DataTypes.STRING(50), defaultValue: '072 180 00000000000 0' },
    banco_cuenta: { type: DataTypes.STRING(50), defaultValue: '0458923412' }
}, {
    tableName: 'configuracion_plataforma',
    timestamps: true
});

