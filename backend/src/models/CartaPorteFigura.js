import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CartaPorteFigura = sequelize.define('CartaPorteFigura', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    carta_porte_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo_figura: { type: DataTypes.STRING(2), defaultValue: '01' }, // 01: Operador, 02: Propietario, 03: Arrendador
    rfc_figura: { type: DataTypes.STRING(13), allowNull: false },
    num_licencia: { type: DataTypes.STRING(16), allowNull: false },
    nombre_figura: { type: DataTypes.STRING, allowNull: false },
    codigo_postal: { type: DataTypes.STRING(5), allowNull: true },
    estado: { type: DataTypes.STRING(3), allowNull: true },
    municipio: { type: DataTypes.STRING(3), allowNull: true },
    localidad: { type: DataTypes.STRING(2), allowNull: true },
    colonia: { type: DataTypes.STRING(4), allowNull: true },
    calle: { type: DataTypes.STRING, allowNull: true },
    numero_exterior: { type: DataTypes.STRING, allowNull: true },
    numero_interior: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'carta_porte_figuras',
    timestamps: true
});
