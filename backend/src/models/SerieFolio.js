import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const SerieFolio = sequelize.define('SerieFolio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo_documento_id: { type: DataTypes.INTEGER, allowNull: true }, // Asocia la serie con un tipo (Factura, Honorarios, etc.)
    serie: { type: DataTypes.STRING(10), allowNull: false },
    ultimo_folio: { type: DataTypes.INTEGER, defaultValue: 0 },
    es_predeterminada: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'series_folios',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['emisor_id', 'serie', 'tipo_documento_id'] }
    ]
});
