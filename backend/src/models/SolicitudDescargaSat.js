import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const SolicitudDescargaSat = sequelize.define('SolicitudDescargaSat', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    id_solicitud_sat: { type: DataTypes.STRING(80), allowNull: false },
    rfc_solicitante: { type: DataTypes.STRING(13), allowNull: false },
    rfc_receptor: { type: DataTypes.STRING(13), allowNull: true },
    fecha_inicio: { type: DataTypes.STRING(30), allowNull: false },
    fecha_fin: { type: DataTypes.STRING(30), allowNull: false },
    tipo_solicitud: { type: DataTypes.STRING(20), defaultValue: 'CFDI' },
    tipo_descarga: { type: DataTypes.STRING(20), defaultValue: 'Recibidos' },
    estado_sat: { type: DataTypes.STRING(50), defaultValue: 'Aceptada' }, // Aceptada, En proceso, Terminada, Descargada, Rechazada, Error
    codigo_estado: { type: DataTypes.STRING(20), allowNull: true },
    mensaje_sat: { type: DataTypes.TEXT, allowNull: true },
    numero_cfdis: { type: DataTypes.INTEGER, defaultValue: 0 },
    paquetes_ids: { type: DataTypes.JSON, allowNull: true },
    paquetes_descargados: { type: DataTypes.JSON, allowNull: true },
    error_detalle: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'solicitudes_descarga_sat',
    timestamps: true
});

