import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const DocumentoRecibido = sequelize.define('DocumentoRecibido', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false }, // Compañía que recibe la factura (nuestro Emisor en base de datos)
    proveedor_id: { type: DataTypes.INTEGER, allowNull: false }, // Proveedor que emitió la factura
    uuid: { type: DataTypes.STRING(36), allowNull: false, unique: true }, // Folio Fiscal SAT
    serie: { type: DataTypes.STRING },
    folio: { type: DataTypes.STRING },
    fecha: { type: DataTypes.DATE, allowNull: false },
    forma_pago: { type: DataTypes.STRING(2) }, // Catálogo SAT (01, 03, etc.)
    metodo_pago: { type: DataTypes.STRING(3) }, // PUE, PPD
    moneda: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    tipo_cambio: { type: DataTypes.DECIMAL(10, 4), defaultValue: 1 },
    subtotal: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    saldo_insoluto: { type: DataTypes.DECIMAL(18, 6) }, // Para facturas PPD
    estado_pago: {
        type: DataTypes.ENUM('Pendiente', 'Pago Parcial', 'Pagado', 'Cancelado'),
        defaultValue: 'Pendiente'
    },
    xml_url: { type: DataTypes.STRING },
    pdf_url: { type: DataTypes.STRING }
}, {
    tableName: 'documentos_recibidos',
    timestamps: true
});
