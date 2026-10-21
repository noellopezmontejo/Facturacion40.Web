import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Concepto = sequelize.define('Concepto', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    clave_prod_serv: { type: DataTypes.STRING(8), allowNull: false }, // Catálogo SAT
    clave_unidad: { type: DataTypes.STRING(5), allowNull: false }, // Catálogo SAT
    unidad: { type: DataTypes.STRING(50) }, // Descripción de la unidad (ej. PIEZA)
    no_identificacion: { type: DataTypes.STRING },
    descripcion: { type: DataTypes.STRING, allowNull: false },
    valor_unitario: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    descuento: { type: DataTypes.DECIMAL(18, 6), defaultValue: 0 },
    desglosar_impuestos: { type: DataTypes.BOOLEAN, defaultValue: false },
    permitir_editar_descripcion: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
    tableName: 'conceptos',
    timestamps: true
});
