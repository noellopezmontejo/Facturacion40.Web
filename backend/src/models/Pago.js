import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Pago = sequelize.define('Pago', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: { type: DataTypes.INTEGER, allowNull: false },
    receptor_id: { type: DataTypes.INTEGER, allowNull: false },
    fecha_pago: { type: DataTypes.DATE, allowNull: false },
    monto: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    forma_pago: { type: DataTypes.STRING(2), allowNull: false }, // Catálogo SAT
    moneda: { type: DataTypes.STRING(3), defaultValue: 'MXN' },
    tipo_cambio: { type: DataTypes.DECIMAL(10, 4), defaultValue: 1 },
    no_operacion: { type: DataTypes.STRING },
    rfc_emisor_cta_ord: { type: DataTypes.STRING(13) },
    nom_banco_ord_ext: { type: DataTypes.STRING },
    cta_ordenante: { type: DataTypes.STRING },
    rfc_emisor_cta_ben: { type: DataTypes.STRING(13) },
    cta_beneficiario: { type: DataTypes.STRING },
    documento_rep_id: { type: DataTypes.INTEGER }, 
}, {
    tableName: 'pagos',
    timestamps: true
});
