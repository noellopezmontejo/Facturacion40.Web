import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CatVehiculo = sequelize.define('CatVehiculo', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre_interno: { type: DataTypes.STRING, allowNull: false },
    permiso_sct: { type: DataTypes.STRING(6), allowNull: false }, // ej. TPAF01
    num_permiso_sct: { type: DataTypes.STRING(50), allowNull: false },
    config_vehicular: { type: DataTypes.STRING(6), allowNull: false }, // ej. VL, C2
    placa: { type: DataTypes.STRING(7), allowNull: false }, // Sin guiones
    anio_modelo: { type: DataTypes.INTEGER, allowNull: false },
    asegura_resp_civil: { type: DataTypes.STRING, allowNull: false }, // Nombre Aseguradora
    poliza_resp_civil: { type: DataTypes.STRING(30), allowNull: false },
    subtipo_remolque: { type: DataTypes.STRING(6), allowNull: true },
    placa_remolque: { type: DataTypes.STRING(7), allowNull: true }
}, {
    tableName: 'cat_vehiculos',
    timestamps: true
});
