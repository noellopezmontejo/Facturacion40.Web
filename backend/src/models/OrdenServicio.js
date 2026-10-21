import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const OrdenServicio = sequelize.define('OrdenServicio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    receptor_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    folio: { type: DataTypes.STRING, allowNull: false },
    fecha_ingreso: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fecha_entrega_estimada: { type: DataTypes.DATE, allowNull: true },
    fecha_entrega_real: { type: DataTypes.DATE, allowNull: true },
    equipo: { type: DataTypes.STRING, allowNull: false }, // ej. Laptop Dell Inspiron, PC de escritorio
    marca: { type: DataTypes.STRING },
    modelo: { type: DataTypes.STRING },
    numero_serie: { type: DataTypes.STRING },
    contrasena_equipo: { type: DataTypes.STRING },
    accesorios_incluidos: { type: DataTypes.TEXT },
    falla_reportada: { type: DataTypes.TEXT, allowNull: false },
    diagnostico_tecnico: { type: DataTypes.TEXT },
    estado: {
        type: DataTypes.ENUM('Recibido', 'En Diagnóstico', 'Esperando Aprobación', 'En Reparación', 'Reparado', 'Entregado', 'Cancelado', 'Facturado'),
        defaultValue: 'Recibido'
    },
    moneda: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    subtotal: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_trasladados: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_retenidos: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    documento_id: { type: DataTypes.INTEGER, allowNull: true } // Factura asociada
}, {
    tableName: 'ordenes_servicio',
    timestamps: true
});
