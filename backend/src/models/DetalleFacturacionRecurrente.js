import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const DetalleFacturacionRecurrente = sequelize.define('DetalleFacturacionRecurrente', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    facturacion_recurrente_id: { type: DataTypes.INTEGER, allowNull: false },
    concepto_id: { type: DataTypes.INTEGER, allowNull: true },
    clave_prod_serv: { type: DataTypes.STRING(8), allowNull: false, defaultValue: '84111500' },
    no_identificacion: { type: DataTypes.STRING(100), allowNull: true },
    cantidad: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 1 },
    clave_unidad: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'E48' },
    unidad: { type: DataTypes.STRING(50), defaultValue: 'Servicio' },
    descripcion: { type: DataTypes.STRING(1000), allowNull: false }, // Soporta variables {{MES}}, {{AÑO}}
    valor_unitario: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    importe: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    objeto_imp: { type: DataTypes.STRING(2), defaultValue: '02' },
    impuestos_trasladados: { type: DataTypes.JSON, allowNull: true },
    impuestos_retenidos: { type: DataTypes.JSON, allowNull: true }
}, {
    tableName: 'detalle_facturaciones_recurrentes',
    timestamps: true
});

