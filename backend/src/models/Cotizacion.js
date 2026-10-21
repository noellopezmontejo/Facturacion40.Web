import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Cotizacion = sequelize.define('Cotizacion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    receptor_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    folio: { type: DataTypes.STRING, allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    vigencia_dias: { type: DataTypes.INTEGER, defaultValue: 15 },
    moneda: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    tipo_cambio: { type: DataTypes.DECIMAL(10, 4), defaultValue: 1 },
    subtotal: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_trasladados: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_retenidos: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    estado: {
        type: DataTypes.ENUM('Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Facturada', 'Cancelada'),
        defaultValue: 'Borrador'
    },
    notas: { type: DataTypes.TEXT },
    documento_id: { type: DataTypes.INTEGER, allowNull: true } // ID de la factura si fue facturada
}, {
    tableName: 'cotizaciones',
    timestamps: true
});
