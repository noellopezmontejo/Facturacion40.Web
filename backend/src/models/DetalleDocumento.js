import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const DetalleDocumento = sequelize.define('DetalleDocumento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    documento_id: { type: DataTypes.INTEGER, allowNull: false },
    concepto_id: { type: DataTypes.INTEGER, allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    valor_unitario: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    importe: { type: DataTypes.DECIMAL(18, 6), allowNull: false }, // cantidad * valor_unitario - descuento
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    es_objeto_imp: { type: DataTypes.STRING(2), allowNull: false }, // 01, 02, 03... Catálogo SAT
    cuenta_predial: { type: DataTypes.STRING(150) }, // Requerido para Arrendamiento
    retencion_isr: { type: DataTypes.BOOLEAN, defaultValue: false },
    retencion_iva: { type: DataTypes.BOOLEAN, defaultValue: false },
    retencion_isr_tasa: { type: DataTypes.DECIMAL(10, 6), defaultValue: 0.10 }
}, {
    tableName: 'detalle_documentos',
    timestamps: true
});
