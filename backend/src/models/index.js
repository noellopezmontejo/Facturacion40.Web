import { sequelize } from '../config/database.js';
import { Empresa } from './Empresa.js';
import { Usuario } from './Usuario.js';
import { Rol } from './Rol.js';
import { Permiso } from './Permiso.js';
import { Emisor } from './Emisor.js';
import { Receptor } from './Receptor.js';
import { Concepto } from './Concepto.js';
import { Impuesto } from './Impuesto.js';
import { Documento } from './Documento.js';
import { DetalleDocumento } from './DetalleDocumento.js';
import { Pago } from './Pago.js';
import { PagoDocumento } from './PagoDocumento.js';
import { SerieFolio } from './SerieFolio.js';
import { CatTipoFactura } from './CatTipoFactura.js';
import { ConfiguracionEstilo } from './ConfiguracionEstilo.js';
import { ImpuestoLocal } from './ImpuestoLocal.js';
import { Cotizacion } from './Cotizacion.js';
import { DetalleCotizacion } from './DetalleCotizacion.js';
import { OrdenServicio } from './OrdenServicio.js';
import { DetalleOrdenServicio } from './DetalleOrdenServicio.js';

import { CatVehiculo } from './CatVehiculo.js';
import { CatChofer } from './CatChofer.js';
import { CartaPorte } from './CartaPorte.js';
import { CartaPorteUbicacion } from './CartaPorteUbicacion.js';
import { CartaPorteMercancia } from './CartaPorteMercancia.js';
import { CartaPorteAutotransporte } from './CartaPorteAutotransporte.js';
import { CartaPorteFigura } from './CartaPorteFigura.js';

import { Proveedor } from './Proveedor.js';
import { DocumentoRecibido } from './DocumentoRecibido.js';
import { PagoRecibido } from './PagoRecibido.js';
import { PagoDocumentoRecibido } from './PagoDocumentoRecibido.js';


// Junction models
const UsuarioRol = sequelize.define('UsuarioRol', {}, { tableName: 'usuarios_roles', timestamps: false });
const UsuarioEmisor = sequelize.define('UsuarioEmisor', {}, { tableName: 'usuarios_emisores', timestamps: false });
const ConceptoImpuesto = sequelize.define('ConceptoImpuesto', {}, { tableName: 'conceptos_impuestos', timestamps: false });

// Relationships

// Empresa associations
Empresa.hasMany(Usuario, { foreignKey: 'empresa_id' });
Usuario.belongsTo(Empresa, { foreignKey: 'empresa_id' });

Empresa.hasMany(Emisor, { foreignKey: 'empresa_id' });
Emisor.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Usuario <-> Rol
Usuario.belongsToMany(Rol, { through: UsuarioRol, foreignKey: 'usuario_id', otherKey: 'rol_id' });
Rol.belongsToMany(Usuario, { through: UsuarioRol, foreignKey: 'rol_id', otherKey: 'usuario_id' });

// Usuario <-> Emisor (Un usuario puede gestionar multiples emisores)
Usuario.belongsToMany(Emisor, { through: UsuarioEmisor, foreignKey: 'usuario_id', otherKey: 'emisor_id' });
Emisor.belongsToMany(Usuario, { through: UsuarioEmisor, foreignKey: 'emisor_id', otherKey: 'usuario_id' });
// Alias para métodos mágicos genéricos de sequelize (addEmisor)
Usuario.hasMany(UsuarioEmisor, { foreignKey: 'usuario_id' });
Emisor.hasMany(UsuarioEmisor, { foreignKey: 'emisor_id' });

// Emisor associations
Emisor.hasMany(Receptor, { foreignKey: 'emisor_id' });
Receptor.belongsTo(Emisor, { foreignKey: 'emisor_id' });

Emisor.hasMany(Concepto, { foreignKey: 'emisor_id' });
Concepto.belongsTo(Emisor, { foreignKey: 'emisor_id' });

Emisor.hasMany(Documento, { foreignKey: 'emisor_id' });
Documento.belongsTo(Emisor, { foreignKey: 'emisor_id' });

Emisor.hasMany(SerieFolio, { foreignKey: 'emisor_id', as: 'series' });
SerieFolio.belongsTo(Emisor, { foreignKey: 'emisor_id' });

Emisor.hasOne(ConfiguracionEstilo, { foreignKey: 'emisor_id', as: 'estilo' });
ConfiguracionEstilo.belongsTo(Emisor, { foreignKey: 'emisor_id' });

// Concepto <-> Impuesto
Concepto.belongsToMany(Impuesto, { through: ConceptoImpuesto, foreignKey: 'concepto_id', otherKey: 'impuesto_id' });
Impuesto.belongsToMany(Concepto, { through: ConceptoImpuesto, foreignKey: 'impuesto_id', otherKey: 'concepto_id' });

// Documento -> DetalleDocumento
Documento.hasMany(DetalleDocumento, { foreignKey: 'documento_id', as: 'detalles' });
DetalleDocumento.belongsTo(Documento, { foreignKey: 'documento_id' });

// DetalleDocumento -> Concepto (referencia)
DetalleDocumento.belongsTo(Concepto, { foreignKey: 'concepto_id' });

// Documento -> Receptor
Documento.belongsTo(Receptor, { foreignKey: 'receptor_id' });
Receptor.hasMany(Documento, { foreignKey: 'receptor_id' });

// Pago <-> Documento (Parcialidades)
Pago.belongsToMany(Documento, { through: PagoDocumento, foreignKey: 'pago_id', otherKey: 'documento_id' });
Documento.belongsToMany(Pago, { through: PagoDocumento, foreignKey: 'documento_id', otherKey: 'pago_id' });

// Pago -> Documento (El propio comprobante REP)
Pago.belongsTo(Documento, { foreignKey: 'documento_rep_id', as: 'DocumentoREP' });
Documento.hasOne(Pago, { foreignKey: 'documento_rep_id', as: 'PagoBase' });

// Pago -> Receptor / Emisor
Pago.belongsTo(Receptor, { foreignKey: 'receptor_id' });
Receptor.hasMany(Pago, { foreignKey: 'receptor_id' });
Pago.belongsTo(Emisor, { foreignKey: 'emisor_id' });
Emisor.hasMany(Pago, { foreignKey: 'emisor_id' });

// --- Relaciones para Facturas Recibidas (Cuentas por Pagar) ---
Emisor.hasMany(Proveedor, { foreignKey: 'emisor_id' });
Proveedor.belongsTo(Emisor, { foreignKey: 'emisor_id' });

Proveedor.hasMany(DocumentoRecibido, { foreignKey: 'proveedor_id' });
DocumentoRecibido.belongsTo(Proveedor, { foreignKey: 'proveedor_id' });

Emisor.hasMany(DocumentoRecibido, { foreignKey: 'emisor_id' });
DocumentoRecibido.belongsTo(Emisor, { foreignKey: 'emisor_id' });

Emisor.hasMany(PagoRecibido, { foreignKey: 'emisor_id' });
PagoRecibido.belongsTo(Emisor, { foreignKey: 'emisor_id' });

Proveedor.hasMany(PagoRecibido, { foreignKey: 'proveedor_id' });
PagoRecibido.belongsTo(Proveedor, { foreignKey: 'proveedor_id' });

PagoRecibido.belongsToMany(DocumentoRecibido, { through: PagoDocumentoRecibido, foreignKey: 'pago_recibido_id', otherKey: 'documento_recibido_id', uniqueKey: 'pago_doc_rec_uq' });
DocumentoRecibido.belongsToMany(PagoRecibido, { through: PagoDocumentoRecibido, foreignKey: 'documento_recibido_id', otherKey: 'pago_recibido_id', uniqueKey: 'pago_doc_rec_uq' });

PagoDocumentoRecibido.belongsTo(PagoRecibido, { foreignKey: 'pago_recibido_id' });
PagoRecibido.hasMany(PagoDocumentoRecibido, { foreignKey: 'pago_recibido_id' });
PagoDocumentoRecibido.belongsTo(DocumentoRecibido, { foreignKey: 'documento_recibido_id' });
DocumentoRecibido.hasMany(PagoDocumentoRecibido, { foreignKey: 'documento_recibido_id' });


// Empresa <-> ImpuestoLocal
Empresa.hasMany(ImpuestoLocal, { foreignKey: 'empresa_id' });
ImpuestoLocal.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Empresa <-> Impuesto
Empresa.hasMany(Impuesto, { foreignKey: 'empresa_id' });
Impuesto.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// PagoDocumento associations for direct queries
PagoDocumento.belongsTo(Pago, { foreignKey: 'pago_id' });
Pago.hasMany(PagoDocumento, { foreignKey: 'pago_id' });
PagoDocumento.belongsTo(Documento, { foreignKey: 'documento_id' });
Documento.hasMany(PagoDocumento, { foreignKey: 'documento_id' });

// Cotizacion associations
Emisor.hasMany(Cotizacion, { foreignKey: 'emisor_id' });
Cotizacion.belongsTo(Emisor, { foreignKey: 'emisor_id' });
Receptor.hasMany(Cotizacion, { foreignKey: 'receptor_id' });
Cotizacion.belongsTo(Receptor, { foreignKey: 'receptor_id' });
Cotizacion.hasMany(DetalleCotizacion, { foreignKey: 'cotizacion_id', as: 'detalles' });
DetalleCotizacion.belongsTo(Cotizacion, { foreignKey: 'cotizacion_id' });
DetalleCotizacion.belongsTo(Concepto, { foreignKey: 'concepto_id' });

// OrdenServicio associations
Emisor.hasMany(OrdenServicio, { foreignKey: 'emisor_id' });
OrdenServicio.belongsTo(Emisor, { foreignKey: 'emisor_id' });
Receptor.hasMany(OrdenServicio, { foreignKey: 'receptor_id' });
OrdenServicio.belongsTo(Receptor, { foreignKey: 'receptor_id' });
OrdenServicio.hasMany(DetalleOrdenServicio, { foreignKey: 'orden_servicio_id', as: 'detalles' });
DetalleOrdenServicio.belongsTo(OrdenServicio, { foreignKey: 'orden_servicio_id' });
DetalleOrdenServicio.belongsTo(Concepto, { foreignKey: 'concepto_id' });

// Documento <-> CatTipoFactura
Documento.belongsTo(CatTipoFactura, { foreignKey: 'tipo_documento_id', targetKey: 'CveTipoFactura' });
CatTipoFactura.hasMany(Documento, { foreignKey: 'tipo_documento_id' });

// SerieFolio <-> CatTipoFactura
SerieFolio.belongsTo(CatTipoFactura, { foreignKey: 'tipo_documento_id', targetKey: 'CveTipoFactura' });
CatTipoFactura.hasMany(SerieFolio, { foreignKey: 'tipo_documento_id' });

// --- CARTA PORTE ---
// Catálogos
CatVehiculo.belongsTo(Emisor, { foreignKey: 'emisor_id' });
Emisor.hasMany(CatVehiculo, { foreignKey: 'emisor_id' });

CatChofer.belongsTo(Emisor, { foreignKey: 'emisor_id' });
Emisor.hasMany(CatChofer, { foreignKey: 'emisor_id' });

// CartaPorte <-> Documento
Documento.hasOne(CartaPorte, { foreignKey: 'documento_id', as: 'cartaPorte' });
CartaPorte.belongsTo(Documento, { foreignKey: 'documento_id' });

// CartaPorte <-> Sub-nodos
CartaPorte.hasMany(CartaPorteUbicacion, { foreignKey: 'carta_porte_id', as: 'ubicaciones' });
CartaPorteUbicacion.belongsTo(CartaPorte, { foreignKey: 'carta_porte_id' });

CartaPorte.hasMany(CartaPorteMercancia, { foreignKey: 'carta_porte_id', as: 'mercancias' });
CartaPorteMercancia.belongsTo(CartaPorte, { foreignKey: 'carta_porte_id' });

CartaPorte.hasOne(CartaPorteAutotransporte, { foreignKey: 'carta_porte_id', as: 'autotransporte' });
CartaPorteAutotransporte.belongsTo(CartaPorte, { foreignKey: 'carta_porte_id' });

CartaPorte.hasMany(CartaPorteFigura, { foreignKey: 'carta_porte_id', as: 'figuras' });
CartaPorteFigura.belongsTo(CartaPorte, { foreignKey: 'carta_porte_id' });

export {
    Empresa,
    Usuario,
    Rol,
    Permiso,
    Emisor,
    Receptor,
    Concepto,
    Impuesto,
    Documento,
    DetalleDocumento,
    Pago,
    PagoDocumento,
    SerieFolio,
    CatTipoFactura,
    ConfiguracionEstilo,
    UsuarioRol,
    UsuarioEmisor,
    ConceptoImpuesto,
    CatVehiculo,
    CatChofer,
    CartaPorte,
    CartaPorteUbicacion,
    CartaPorteMercancia,
    CartaPorteAutotransporte,
    CartaPorteFigura,
    ImpuestoLocal,
    Proveedor,
    DocumentoRecibido,
    PagoRecibido,
    PagoDocumentoRecibido,
    Cotizacion,
    DetalleCotizacion,
    OrdenServicio,
    DetalleOrdenServicio,
    sequelize
};

