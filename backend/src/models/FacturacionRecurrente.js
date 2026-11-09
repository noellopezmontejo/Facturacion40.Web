import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const FacturacionRecurrente = sequelize.define('FacturacionRecurrente', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    receptor_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre_suscripcion: { type: DataTypes.STRING(255), allowNull: false }, // ej. Iguala Contable, Renta Oficina 102
    frecuencia: {
        type: DataTypes.ENUM('Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'),
        defaultValue: 'Mensual',
        allowNull: false
    },
    dia_ejecucion: { type: DataTypes.INTEGER, defaultValue: 1 }, // Día del mes (1 - 31)
    fecha_inicio: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    fecha_fin: { type: DataTypes.DATEONLY, allowNull: true },
    proxima_emision: { type: DataTypes.DATEONLY, allowNull: false },
    ultima_emision: { type: DataTypes.DATE, allowNull: true },
    estado: {
        type: DataTypes.ENUM('Activa', 'Pausada', 'Cancelada', 'Completada'),
        defaultValue: 'Activa',
        allowNull: false
    },
    auto_timbrar: { type: DataTypes.BOOLEAN, defaultValue: true }, // true: Timbra ante PAC, false: Genera borrador
    enviar_email: { type: DataTypes.BOOLEAN, defaultValue: true }, // true: Envía correo con XML + PDF
    tipo_comprobante: { type: DataTypes.STRING(1), defaultValue: 'I' },
    serie: { type: DataTypes.STRING(20), defaultValue: 'REC' },
    forma_pago: { type: DataTypes.STRING(2), defaultValue: '03' }, // 03 Transferencia
    metodo_pago: { type: DataTypes.STRING(3), defaultValue: 'PUE' }, // PUE o PPD
    uso_cfdi: { type: DataTypes.STRING(4), defaultValue: 'G03' },
    moneda: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    tipo_cambio: { type: DataTypes.DECIMAL(10, 4), defaultValue: 1 },
    subtotal: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0 },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_trasladados: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total_impuestos_retenidos: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0 },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    total_facturas_emitidas: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
    tableName: 'facturaciones_recurrentes',
    timestamps: true
});

