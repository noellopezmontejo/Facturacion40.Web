import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const PagoRecibido = sequelize.define('PagoRecibido', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false }, // Compañía que recibe el complemento (nuestro Emisor en base de datos)
    proveedor_id: { type: DataTypes.INTEGER, allowNull: false }, // Proveedor que emitió el pago
    uuid: { type: DataTypes.STRING(36), allowNull: false, unique: true }, // Folio Fiscal SAT del CRP
    fecha_pago: { type: DataTypes.DATE, allowNull: false },
    monto_total: { type: DataTypes.DECIMAL(18, 6), allowNull: false }, // Monto total del pago
    forma_pago_p: { type: DataTypes.STRING(2), allowNull: false }, // Forma de pago SAT (03 Transferencia, etc.)
    moneda_p: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    tipo_cambio_p: { type: DataTypes.DECIMAL(10, 4), defaultValue: 1 },
    xml_url: { type: DataTypes.STRING },
    pdf_url: { type: DataTypes.STRING }
}, {
    tableName: 'pagos_recibidos',
    timestamps: true
});
