import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CatTipoFactura = sequelize.define('CatTipoFactura', {
    CveTipoFactura: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    Descripcion: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
    },
    TipoComprobante: { 
        type: DataTypes.STRING(1), 
        allowNull: true 
    }
}, {
    tableName: 'cattipofactura',
    timestamps: false // Es una tabla de catálogo estática
});
