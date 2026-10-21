import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Proveedor = sequelize.define('Proveedor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false }, // Compañía que lo registra/recibe la factura
    rfc: { type: DataTypes.STRING(13), allowNull: false },
    razon_social: { type: DataTypes.STRING, allowNull: false },
    regimen_fiscal: { type: DataTypes.STRING(3), allowNull: true }, // Catálogo SAT
    codigo_postal: { type: DataTypes.STRING(5), allowNull: true },
    estado: { type: DataTypes.STRING },
    municipio: { type: DataTypes.STRING },
    colonia: { type: DataTypes.STRING },
    calle: { type: DataTypes.STRING },
    no_exterior: { type: DataTypes.STRING },
    no_interior: { type: DataTypes.STRING },
    correo: { type: DataTypes.STRING }
}, {
    tableName: 'proveedores',
    timestamps: true
});
