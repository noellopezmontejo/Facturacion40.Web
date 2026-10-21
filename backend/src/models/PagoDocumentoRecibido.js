import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const PagoDocumentoRecibido = sequelize.define('PagoDocumentoRecibido', {
    pago_recibido_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'pagos_recibidos', key: 'id' }
    },
    documento_recibido_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'documentos_recibidos', key: 'id' }
    },
    imp_pagado: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    imp_saldo_insoluto: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    num_parcialidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
}, {
    tableName: 'pagos_docs_recibidos',
    timestamps: false
});
