import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const HistorialFacturacionRecurrente = sequelize.define('HistorialFacturacionRecurrente', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    facturacion_recurrente_id: { type: DataTypes.INTEGER, allowNull: false },
    documento_id: { type: DataTypes.INTEGER, allowNull: true },
    fecha_ejecucion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    folio_generado: { type: DataTypes.STRING(100), allowNull: true },
    uuid: { type: DataTypes.STRING(36), allowNull: true },
    estado: {
        type: DataTypes.ENUM('Timbrado', 'Borrador', 'Error'),
        defaultValue: 'Timbrado',
        allowNull: false
    },
    total: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0 },
    mensaje: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'historial_facturaciones_recurrentes',
    timestamps: true
});

