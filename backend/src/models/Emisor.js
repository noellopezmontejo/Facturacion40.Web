import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Emisor = sequelize.define('Emisor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: true },
    rfc: { type: DataTypes.STRING(13), allowNull: false, unique: true },
    razon_social: { type: DataTypes.STRING, allowNull: false },
    regimen_fiscal: { type: DataTypes.STRING(3), allowNull: false }, // Catálogo SAT
    codigo_postal: { type: DataTypes.STRING(5), allowNull: false },
    estado: { type: DataTypes.STRING },
    municipio: { type: DataTypes.STRING },
    colonia: { type: DataTypes.STRING },
    calle: { type: DataTypes.STRING },
    no_exterior: { type: DataTypes.STRING },
    no_interior: { type: DataTypes.STRING },
    correo_emisor: { type: DataTypes.STRING },
    certificado_path: { type: DataTypes.STRING }, // CSD .cer (ruta relativa)
    llave_privada_path: { type: DataTypes.STRING }, // CSD .key (ruta relativa)
    password_csd: { type: DataTypes.STRING },
    modo_prueba: { type: DataTypes.BOOLEAN, defaultValue: true },
    es_agapes: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
    tableName: 'emisores',
    timestamps: true
});
