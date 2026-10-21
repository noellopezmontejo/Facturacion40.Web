import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Permiso = sequelize.define('Permiso', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    modulo: { type: DataTypes.STRING, allowNull: false }, // ej: emisores, documentos, reportes
    accion: { type: DataTypes.STRING, allowNull: false }, // ver, crear, editar, eliminar, timbrar, cancelar
    descripcion: { type: DataTypes.STRING }
}, {
    tableName: 'permisos',
    timestamps: true
});
