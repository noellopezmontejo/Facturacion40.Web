import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CartaPorteUbicacion = sequelize.define('CartaPorteUbicacion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    carta_porte_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo_ubicacion: { type: DataTypes.ENUM('Origen', 'Destino'), allowNull: false },
    rfc_remitente_destinatario: { type: DataTypes.STRING(13), allowNull: false },
    nombre_remitente_destinatario: { type: DataTypes.STRING, allowNull: true },
    fecha_hora_salida_llegada: { type: DataTypes.DATE, allowNull: false }, // Formato local
    distancia_recorrida: { type: DataTypes.DECIMAL(10, 2), allowNull: true }, // Requerido en Destinos
     // Domicilio
    calle: { type: DataTypes.STRING, allowNull: false },
    numero_exterior: { type: DataTypes.STRING, allowNull: true },
    colonia: { type: DataTypes.STRING, allowNull: true },
    localidad: { type: DataTypes.STRING, allowNull: true },
    municipio: { type: DataTypes.STRING, allowNull: true },
    estado: { type: DataTypes.STRING, allowNull: true },
    pais: { type: DataTypes.STRING(3), defaultValue: 'MEX' },
    codigo_postal: { type: DataTypes.STRING(12), allowNull: false }
}, {
    tableName: 'carta_porte_ubicaciones',
    timestamps: true
});
