import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const ConfiguracionEstilo = sequelize.define('ConfiguracionEstilo', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'emisores',
            key: 'id'
        }
    },
    logo_url: { type: DataTypes.STRING, allowNull: true },
    color_primario: { type: DataTypes.STRING(7), defaultValue: '#004481' },
    color_secundario: { type: DataTypes.STRING(7), defaultValue: '#123247' },
    tipo_letra: { type: DataTypes.STRING, defaultValue: 'Arial' },
    layout_id: { type: DataTypes.STRING, defaultValue: 'v1' },
    template_mapping: { type: DataTypes.JSON, allowNull: true },
    config_adicional: { type: DataTypes.JSON, allowNull: true }
}, {
    tableName: 'configuraciones_estilos',
    timestamps: true
});
