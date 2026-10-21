import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Documento = sequelize.define('Documento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    receptor_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo_documento_id: { type: DataTypes.INTEGER, allowNull: true }, // Referencia a cattipofactura
    tipo_comprobante: { type: DataTypes.STRING(1), allowNull: false }, // I, E, T, N, P
    serie: { type: DataTypes.STRING },
    folio: { type: DataTypes.STRING },
    fecha: { type: DataTypes.DATE, allowNull: false },
    forma_pago: { type: DataTypes.STRING(2) }, // Catálogo SAT
    metodo_pago: { type: DataTypes.STRING(3) }, // PUE, PPD
    uso_cfdi: { type: DataTypes.STRING(3) }, // G01, G03, etc.
    condiciones_pago: { type: DataTypes.STRING },
    moneda: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    tipo_cambio: { type: DataTypes.DECIMAL(10, 4), defaultValue: 1 },
    subtotal: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_trasladados: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_retenidos: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    estado_pago: {
        type: DataTypes.ENUM('Pendiente', 'Pago Parcial', 'Pagado', 'Vencido', 'Cancelado'),
        defaultValue: 'Pendiente'
    },
    saldo_insoluto: { type: DataTypes.DECIMAL(18, 6) },
    fecha_vencimiento: { type: DataTypes.DATE },
    uuid: { type: DataTypes.STRING(36) }, // Folio Fiscal SAT
    estado_sat: { type: DataTypes.STRING }, // Timbrado, Cancelado, No Timbrado
    xml_url: { type: DataTypes.STRING },
    pdf_url: { type: DataTypes.STRING },

    // --- Facturación Global (CFDI 4.0) ---
    es_global: { type: DataTypes.BOOLEAN, defaultValue: false },
    periodicidad: { type: DataTypes.STRING(2) }, // 01-05
    meses: { type: DataTypes.STRING(2) }, // 01-18
    anio: { type: DataTypes.INTEGER }, // Año (cuatro dígitos)

    // --- CFDI Relacionados ---
    tipo_relacion: { type: DataTypes.STRING(2) },
    uuids_relacionados: { type: DataTypes.TEXT }, // Almacenados como texto o JSON string

    // --- Datos Técnicos de Certificación (SAT) ---
    no_certificado_emisor: { type: DataTypes.STRING(20) },
    no_certificado_sat: { type: DataTypes.STRING(20) },
    fecha_timbrado: { type: DataTypes.DATE },
    sello_cfdi: { type: DataTypes.TEXT },
    sello_sat: { type: DataTypes.TEXT },
    cadena_original_tfd: { type: DataTypes.TEXT },
    impuestos_locales: { type: DataTypes.JSON, allowNull: true },
    ajuste_manual: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'documentos',
    timestamps: true
});
