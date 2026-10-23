import { CatTipoFactura } from '../models/index.js';
import { sequelize } from '../config/database.js';

const FALLBACK_FORMAS_PAGO = [
    { clave: "01", descripcion: "Efectivo" },
    { clave: "02", descripcion: "Cheque nominativo" },
    { clave: "03", descripcion: "Transferencia electrónica de fondos" },
    { clave: "04", descripcion: "Tarjeta de crédito" },
    { clave: "05", descripcion: "Monedero electrónico" },
    { clave: "06", descripcion: "Dinero electrónico" },
    { clave: "08", descripcion: "Vales de despensa" },
    { clave: "12", descripcion: "Dación en pago" },
    { clave: "13", descripcion: "Pago por subrogación" },
    { clave: "14", descripcion: "Pago por consignación" },
    { clave: "15", descripcion: "Condonación" },
    { clave: "17", descripcion: "Compensación" },
    { clave: "23", descripcion: "Novación" },
    { clave: "24", descripcion: "Confusión" },
    { clave: "25", descripcion: "Remisión de deuda" },
    { clave: "26", descripcion: "Prescripción o caducidad" },
    { clave: "27", descripcion: "A satisfacción del acreedor" },
    { clave: "28", descripcion: "Tarjeta de débito" },
    { clave: "29", descripcion: "Tarjeta de servicios" },
    { clave: "30", descripcion: "Aplicación de anticipos" },
    { clave: "99", descripcion: "Por definir" }
];

const FALLBACK_METODOS_PAGO = [
    { clave: "PPD", descripcion: "Pago en parcialidades o diferido" },
    { clave: "PUE", descripcion: "Pago en una sola exhibición" }
];

const FALLBACK_REGIMENES = [
    { clave: "601", descripcion: "General de Ley Personas Morales", fisica: "No", moral: "SI" },
    { clave: "603", descripcion: "Personas Morales con Fines no Lucrativos", fisica: "No", moral: "SI" },
    { clave: "605", descripcion: "Sueldos y Salarios e Ingresos Asimilados a Salarios", fisica: "SI", moral: "No" },
    { clave: "606", descripcion: "Arrendamiento", fisica: "SI", moral: "No" },
    { clave: "607", descripcion: "Régimen de Enajenación o Adquisición de Bienes", fisica: "No", moral: "SI" },
    { clave: "608", descripcion: "Demás ingresos", fisica: "SI", moral: "No" },
    { clave: "609", descripcion: "Consolidación", fisica: "No", moral: "SI" },
    { clave: "610", descripcion: "Residentes en el Extranjero sin Establecimiento Permanente en México", fisica: "SI", moral: "SI" },
    { clave: "611", descripcion: "Ingresos por Dividendos (socios y accionistas)", fisica: "SI", moral: "No" },
    { clave: "612", descripcion: "Personas Físicas con Actividades Empresariales y Profesionales", fisica: "SI", moral: "No" },
    { clave: "614", descripcion: "Ingresos por intereses", fisica: "SI", moral: "No" },
    { clave: "615", descripcion: "Régimen de los ingresos por obtención de premios", fisica: "SI", moral: "No" },
    { clave: "616", descripcion: "Sin obligaciones fiscales", fisica: "SI", moral: "No" },
    { clave: "620", descripcion: "Sociedades Cooperativas de Producción que optan por diferir sus ingresos", fisica: "No", moral: "SI" },
    { clave: "621", descripcion: "Incorporación Fiscal", fisica: "SI", moral: "No" },
    { clave: "622", descripcion: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras", fisica: "SI", moral: "SI" },
    { clave: "623", descripcion: "Opcional para Grupos de Sociedades", fisica: "No", moral: "SI" },
    { clave: "624", descripcion: "Coordinados", fisica: "No", moral: "SI" },
    { clave: "625", descripcion: "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas", fisica: "No", moral: "SI" },
    { clave: "626", descripcion: "Régimen Simplificado de Confianza", fisica: "SI", moral: "No" }
];

const FALLBACK_USOS_CFDI = [
    { clave: "D01", descripcion: "Honorarios médicos, dentales y gastos hospitalarios.", persona: "F" },
    { clave: "D02", descripcion: "Gastos médicos por incapacidad o discapacidad", persona: "F" },
    { clave: "D03", descripcion: "Gastos funerales.", persona: "F" },
    { clave: "D04", descripcion: "Donativos.", persona: "F" },
    { clave: "D05", descripcion: "Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación).", persona: "F" },
    { clave: "D06", descripcion: "Aportaciones voluntarias al SAR.", persona: "F" },
    { clave: "D07", descripcion: "Primas por seguros de gastos médicos.", persona: "F" },
    { clave: "D08", descripcion: "Gastos de transportación escolar obligatoria.", persona: "F" },
    { clave: "D09", descripcion: "Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones.", persona: "F" },
    { clave: "D10", descripcion: "Pagos por servicios educativos (colegiaturas)", persona: "F" },
    { clave: "G01", descripcion: "Adquisición de mercancias", persona: "FM" },
    { clave: "G02", descripcion: "Devoluciones, descuentos o bonificaciones", persona: "FM" },
    { clave: "G03", descripcion: "Gastos en general", persona: "FM" },
    { clave: "I01", descripcion: "Construcciones", persona: "FM" },
    { clave: "I02", descripcion: "Mobilario y equipo de oficina por inversiones", persona: "FM" },
    { clave: "I03", descripcion: "Equipo de transporte", persona: "FM" },
    { clave: "I04", descripcion: "Equipo de computo y accesorios", persona: "FM" },
    { clave: "I05", descripcion: "Dados, troqueles, moldes, matrices y herramental", persona: "FM" },
    { clave: "I06", descripcion: "Comunicaciones telefónicas", persona: "FM" },
    { clave: "I07", descripcion: "Comunicaciones satelitales", persona: "FM" },
    { clave: "I08", descripcion: "Otra maquinaria y equipo", persona: "FM" },
    { clave: "S01", descripcion: "Sin efectos fiscales", persona: "FM" },
    { clave: "CP01", descripcion: "Pagos", persona: "FM" },
    { clave: "CN01", descripcion: "Nómina", persona: "F" }
];

export const getFormasPago = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT c_FormaPago as clave, Descripcion as descripcion FROM CatFormaPagoSat ORDER BY c_FormaPago ASC");
        if (rows && rows.length > 0) return res.json(rows);
    } catch (error) {
        console.warn("CatFormaPagoSat query failed, using static catalog:", error.message);
    }
    res.json(FALLBACK_FORMAS_PAGO);
};

export const getMetodosPago = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT c_metodopago as clave, Descripcion as descripcion FROM CatMetodoPagoSat ORDER BY c_metodopago ASC");
        if (rows && rows.length > 0) return res.json(rows);
    } catch (error) {
        console.warn("CatMetodoPagoSat query failed, using static catalog:", error.message);
    }
    res.json(FALLBACK_METODOS_PAGO);
};

export const getRegimenesFiscales = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT Regimen as clave, Descripcion as descripcion, Fisica as fisica, Moral as moral FROM CatRegimenSat ORDER BY Regimen ASC");
        if (rows && rows.length > 0) return res.json(rows);
    } catch (error) {
        console.warn("CatRegimenSat query failed, using static catalog:", error.message);
    }
    res.json(FALLBACK_REGIMENES);
};

export const getUsosCfdi = async (req, res) => {
    try {
        const [rows] = await sequelize.query("SELECT c_UsoCFDI as clave, Descripcion as descripcion, Persona as persona FROM CatUsoCfdiSat ORDER BY c_UsoCFDI ASC");
        if (rows && rows.length > 0) return res.json(rows);
    } catch (error) {
        console.warn("CatUsoCfdiSat query failed, using static catalog:", error.message);
    }
    res.json(FALLBACK_USOS_CFDI);
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
        if (rows && rows.length > 0) return res.json(rows);
    } catch (error) {
        console.warn("CatTipoFactura query failed, using static catalog:", error.message);
    }
    res.json([
        { clave: 1, descripcion: 'Factura', tipo: 'I' },
        { clave: 2, descripcion: 'Nota de Crédito', tipo: 'E' },
        { clave: 3, descripcion: 'Complemento de Pago', tipo: 'P' },
        { clave: 4, descripcion: 'Carta Porte (Ingreso)', tipo: 'I' },
        { clave: 5, descripcion: 'Carta Porte (Traslado)', tipo: 'T' },
        { clave: 6, descripcion: 'Nómina', tipo: 'N' },
        { clave: 7, descripcion: 'Cotización', tipo: 'C' },
        { clave: 8, descripcion: 'Orden de Servicio', tipo: 'O' }
    ]);
};
