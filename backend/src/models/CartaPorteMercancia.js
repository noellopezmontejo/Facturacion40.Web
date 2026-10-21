import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CartaPorteMercancia = sequelize.define('CartaPorteMercancia', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    carta_porte_id: { type: DataTypes.INTEGER, allowNull: false },
    bienes_transp: { type: DataTypes.STRING(8), allowNull: false },
    descripcion: { type: DataTypes.STRING(1000), allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    clave_unidad: { type: DataTypes.STRING(3), allowNull: false },
    unidad: { type: DataTypes.STRING, allowNull: true },
    peso_en_kg: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
    material_peligroso: { type: DataTypes.ENUM('Sí', 'No'), defaultValue: 'No' },
    cve_material_peligroso: { type: DataTypes.STRING(4), allowNull: true },
    embalaje: { type: DataTypes.STRING(4), allowNull: true },
    valor_mercancia: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    moneda: { type: DataTypes.STRING(3), allowNull: true }
}, {
    tableName: 'carta_porte_mercancias',
    timestamps: true
});
