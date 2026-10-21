import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CartaPorteAutotransporte = sequelize.define('CartaPorteAutotransporte', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    carta_porte_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    permiso_sct: { type: DataTypes.STRING(6), allowNull: false },
    num_permiso_sct: { type: DataTypes.STRING(50), allowNull: false },
    config_vehicular: { type: DataTypes.STRING(6), allowNull: false },
    placa_vm: { type: DataTypes.STRING(7), allowNull: false },
    anio_modelo_vm: { type: DataTypes.INTEGER, allowNull: false },
    asegura_resp_civil: { type: DataTypes.STRING, allowNull: false },
    poliza_resp_civil: { type: DataTypes.STRING(30), allowNull: false },
    subtipo_remolque: { type: DataTypes.STRING(6), allowNull: true },
    placa_remolque: { type: DataTypes.STRING(7), allowNull: true }
}, {
    tableName: 'carta_porte_autotransporte',
    timestamps: true
});
