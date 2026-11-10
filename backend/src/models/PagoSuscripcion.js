import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const PagoSuscripcion = sequelize.define('PagoSuscripcion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true },
    plan_codigo: { type: DataTypes.STRING(50), allowNull: false },
    periodo: { type: DataTypes.STRING(20), defaultValue: 'mensual' }, // 'mensual' o 'anual'
    monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    metodo_pago: { type: DataTypes.STRING(50), allowNull: false }, // 'mercadopago', 'transferencia_banorte'
    estado: { type: DataTypes.STRING(30), defaultValue: 'pendiente' }, // 'pendiente', 'aprobado', 'rechazado'
    referencia_pago: { type: DataTypes.STRING(255), allowNull: true },
    comprobante_url: { type: DataTypes.STRING(500), allowNull: true },
    notas_admin: { type: DataTypes.TEXT, allowNull: true },
    fecha_pago: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    fecha_aprobacion: { type: DataTypes.DATE, allowNull: true },
    dias_extendidos: { type: DataTypes.INTEGER, defaultValue: 30 }
}, {
    tableName: 'pagos_suscripciones',
    timestamps: true
});
