import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const FolioHistorial = sequelize.define('FolioHistorial', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    emisor_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    empresa_id: { 
        type: DataTypes.INTEGER, 
        allowNull: true 
    },
    usuario_id: { 
        type: DataTypes.INTEGER, 
        allowNull: true 
    },
    cantidad: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    saldo_anterior: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    saldo_nuevo: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    tipo_movimiento: { 
        type: DataTypes.STRING(50), 
        defaultValue: 'ASIGNACION_PAC' 
    },
    notas: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    resultado_pac: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    }
}, {
    tableName: 'folios_historial',
    timestamps: true
});
