import { CatTipoFactura } from '../models/index.js';
import { sequelize } from '../config/database.js';

export const getFormasPago = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT c_FormaPago as clave, Descripcion as descripcion FROM CatFormaPagoSat ORDER BY c_FormaPago ASC");
        res.json(rows);
    } catch (error) {
        console.error("Error fetching formas pago:", error);
        res.status(500).json({ message: 'Error interno del servidor al consultar catálogos' });
    }
};

export const getMetodosPago = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT c_metodopago as clave, Descripcion as descripcion FROM CatMetodoPagoSat ORDER BY c_metodopago ASC");
        res.json(rows);
    } catch (error) {
        console.error("Error fetching metodos pago:", error);
        res.status(500).json({ message: 'Error interno del servidor al consultar catálogos' });
    }
};

export const getRegimenesFiscales = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT Regimen as clave, Descripcion as descripcion, Fisica as fisica, Moral as moral FROM CatRegimenSat ORDER BY Regimen ASC");
        res.json(rows);
    } catch (error) {
        console.error("Error fetching regimenes fiscales:", error);
        res.status(500).json({ message: 'Error interno del servidor al consultar catálogos' });
    }
};

export const getUsosCfdi = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT c_UsoCFDI as clave, Descripcion as descripcion, Persona as persona FROM CatUsoCfdiSat ORDER BY c_UsoCFDI ASC");
        res.json(rows);
    } catch (error) {
        console.error("Error fetching usos cfdi:", error);
        res.status(500).json({ message: 'Error interno del servidor al consultar catálogos' });
    }
};

export const getTiposDocumento = async (req, res) => {
    try {
        const rows = await CatTipoFactura.findAll({
            attributes: [
                ['CveTipoFactura', 'clave'],
                ['Descripcion', 'descripcion'],
                ['TipoComprobante', 'tipo']
            ],
            order: [['CveTipoFactura', 'ASC']]
        });
        res.json(rows);
    } catch (error) {
        console.error("Error fetching tipos documento:", error);
        res.status(500).json({ message: 'Error interno del servidor al consultar catálogos' });
    }
};
