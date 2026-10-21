import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const DetalleCotizacion = sequelize.define('DetalleCotizacion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cotizacion_id: { type: DataTypes.INTEGER, allowNull: false },
    concepto_id: { type: DataTypes.INTEGER, allowNull: true },
    clave_prod_serv: { type: DataTypes.STRING(8) },
    no_identificacion: { type: DataTypes.STRING },
    cantidad: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    clave_unidad: { type: DataTypes.STRING(3) },
    unidad: { type: DataTypes.STRING },
    descripcion: { type: DataTypes.STRING(1000), allowNull: false },
    valor_unitario: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    importe: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    impuestos_trasladados: { type: DataTypes.JSON },
    impuestos_retenidos: { type: DataTypes.JSON },
    objeto_imp: { type: DataTypes.STRING(2), defaultValue: '02' }
}, {
    tableName: 'detalle_cotizaciones',
    timestamps: true
});
