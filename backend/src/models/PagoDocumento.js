import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const PagoDocumento = sequelize.define('PagoDocumento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    pago_id: { type: DataTypes.INTEGER, allowNull: false },
    documento_id: { type: DataTypes.INTEGER, allowNull: false },
    num_parcialidad: { type: DataTypes.INTEGER, allowNull: false },
    imp_saldo_ant: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    imp_pagado: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    imp_saldo_insoluto: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    moneda_dr: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    equivalencia_dr: { type: DataTypes.DECIMAL(10, 4), defaultValue: 1 }
}, {
    tableName: 'pagos_documentos',
    timestamps: false
});
