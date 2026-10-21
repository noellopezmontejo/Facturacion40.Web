import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const DetalleOrdenServicio = sequelize.define('DetalleOrdenServicio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orden_servicio_id: { type: DataTypes.INTEGER, allowNull: false },
    concepto_id: { type: DataTypes.INTEGER, allowNull: true },
    tipo_detalle: { type: DataTypes.ENUM('Refaccion', 'Mano de Obra', 'Servicio'), allowNull: false, defaultValue: 'Servicio' },
    descripcion: { type: DataTypes.STRING(1000), allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 1 },
    valor_unitario: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    importe: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    clave_prod_serv: { type: DataTypes.STRING(8) }, // Para facturación posterior
    clave_unidad: { type: DataTypes.STRING(3) },
    impuestos_trasladados: { type: DataTypes.JSON },
    impuestos_retenidos: { type: DataTypes.JSON }
}, {
    tableName: 'detalle_ordenes_servicio',
    timestamps: true
});
