import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CartaPorte = sequelize.define('CartaPorte', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    documento_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    version: { type: DataTypes.STRING(5), defaultValue: '3.1' },
    idCCP: { type: DataTypes.STRING(36), allowNull: false },
    transp_internac: { type: DataTypes.STRING(2), defaultValue: 'No' }, // Sí/No
    total_dist_rec: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    peso_bruto_total: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
    peso_neto_total: { type: DataTypes.DECIMAL(18, 3), allowNull: true },
    unidad_peso: { type: DataTypes.STRING(3), allowNull: false }, // Ej. KGM
    num_total_mercancias: { type: DataTypes.INTEGER, allowNull: false }
}, {
    tableName: 'carta_porte',
    timestamps: true
});
