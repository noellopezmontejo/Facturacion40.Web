import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { sequelize } from './config/database.js';
import * as models from './models/index.js';
import { ensurePacColumns } from './utils/initPacColumns.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Routes
import authRoutes from './routes/authRoutes.js';
import emisorRoutes from './routes/emisorRoutes.js';
import receptorRoutes from './routes/receptorRoutes.js';
import conceptoRoutes from './routes/conceptoRoutes.js';
import impuestoRoutes from './routes/impuestoRoutes.js';
import documentoRoutes from './routes/documentoRoutes.js';
import pagoRoutes from './routes/pagoRoutes.js';
import sepomexRoutes from './routes/sepomexRoutes.js';
import catalogosRoutes from './routes/catalogosRoutes.js';
import estiloRoutes from './routes/estiloRoutes.js';
import vehiculoRoutes from './routes/vehiculoRoutes.js';
import choferRoutes from './routes/choferRoutes.js';
import cartaPorteRoutes from './routes/cartaPorteRoutes.js';
import impuestoLocalRoutes from './routes/impuestoLocalRoutes.js';
import usuarioRoutes from './routes/usuarioRoutes.js';
import empresaRoutes from './routes/empresaRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import documentoRecibidoRoutes from './routes/documentoRecibidoRoutes.js';
import cotizacionRoutes from './routes/cotizacionRoutes.js';
import ordenServicioRoutes from './routes/ordenServicioRoutes.js';



// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emisores', emisorRoutes);
app.use('/api/receptores', receptorRoutes);
app.use('/api/conceptos', conceptoRoutes);
app.use('/api/impuestos', impuestoRoutes);
app.use('/api/documentos', documentoRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/sepomex', sepomexRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/estilos', estiloRoutes);
app.use('/api/vehiculos', vehiculoRoutes);
app.use('/api/choferes', choferRoutes);
app.use('/api/carta-porte', cartaPorteRoutes);
app.use('/api/impuestos-locales', impuestoLocalRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documentos-recibidos', documentoRecibidoRoutes);
app.use('/api/cotizaciones', cotizacionRoutes);
app.use('/api/ordenes-servicio', ordenServicioRoutes);



// Basic health check & DB diagnostic
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    const [tables] = await sequelize.query('SHOW TABLES');
    const userCount = await models.Usuario.count().catch(() => 0);
    res.json({
      status: 'ok',
      message: 'Facturación CFDI 4.0 Backend Running',
      database: {
        connected: true,
        host: process.env.DB_HOST || 'localhost',
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        totalTables: tables.length,
        totalUsers: userCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error al conectar con la base de datos',
      error: error.message,
      code: error.original?.code || error.code,
      host: process.env.DB_HOST || 'localhost',
      name: process.env.DB_NAME,
      user: process.env.DB_USER
    });
  }
});

// Endpoint manual de sincronización e inicialización si se requiere
app.get('/api/db-init', async (req, res) => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: false });
    res.json({ status: 'ok', message: 'Tablas sincronizadas correctamente' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Serve frontend static files if present in public/
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/storage')) {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Facturación CFDI 4.0 Backend API activa',
      health: '/api/health'
    });
  });
}

// Server Initialization
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Auto-create missing tables
    await sequelize.sync({ alter: false });
    await ensurePacColumns();
    console.log('Database tables verified / synchronized.');

    // Auto-seed initial roles and admin user if fresh database
    const userCount = await models.Usuario.count().catch(() => 0);
    if (userCount === 0) {
      console.log('No users found in database. Initializing default data...');
      
      const [adminRol] = await models.Rol.findOrCreate({
        where: { nombre: 'Administrador' },
        defaults: { descripcion: 'Acceso total al sistema y gestión de usuarios.' }
      });
      await models.Rol.findOrCreate({
        where: { nombre: 'Usuario Empresarial' },
        defaults: { descripcion: 'Gestión de su empresa, receptores, emisores y documentos.' }
      });
      await models.Rol.findOrCreate({
        where: { nombre: 'Operador' },
        defaults: { descripcion: 'Operación básica de facturación y consultas.' }
      });

      const [empresaDemo] = await models.Empresa.findOrCreate({
        where: { nombre: 'Corporativo Demo S.A. de C.V.' },
        defaults: { activo: true }
      });

      const hashedPassword = await bcrypt.hash('Admin*2026', 10);
      const adminUser = await models.Usuario.create({
        nombre: 'Administrador Global',
        email: 'admin@cfdi4.mx',
        password_hash: hashedPassword,
        empresa_id: null
      });
      await adminUser.addRol(adminRol);

      // Seed default tipo factura if empty
      const tipoFacturaCount = await models.CatTipoFactura.count().catch(() => 0);
      if (tipoFacturaCount === 0) {
        await models.CatTipoFactura.bulkCreate([
          { CveTipoFactura: 1, Descripcion: 'Factura', TipoComprobante: 'I' },
          { CveTipoFactura: 2, Descripcion: 'Nota de Crédito', TipoComprobante: 'E' },
          { CveTipoFactura: 3, Descripcion: 'Complemento de Pago', TipoComprobante: 'P' },
          { CveTipoFactura: 4, Descripcion: 'Carta Porte (Ingreso)', TipoComprobante: 'I' },
          { CveTipoFactura: 5, Descripcion: 'Carta Porte (Traslado)', TipoComprobante: 'T' },
          { CveTipoFactura: 6, Descripcion: 'Nómina', TipoComprobante: 'N' },
          { CveTipoFactura: 7, Descripcion: 'Cotización', TipoComprobante: 'C' },
          { CveTipoFactura: 8, Descripcion: 'Orden de Servicio', TipoComprobante: 'O' }
        ]).catch(e => console.log('CatTipoFactura seed notice:', e.message));
      }

      console.log('Default admin created: admin@cfdi4.mx / Admin*2026');
    }

    // Ensure default standard taxes exist
    const impuestosCount = await models.Impuesto.count().catch(() => 0);
    if (impuestosCount === 0) {
      await models.Impuesto.bulkCreate([
        { descripcion: "IVA 16%", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.160000", empresa_id: null },
        { descripcion: "IVA 8% (Fronterizo)", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.080000", empresa_id: null },
        { descripcion: "IVA 0%", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.000000", empresa_id: null },
        { descripcion: "IVA Exento", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Exento", tasa_cuota: "0.000000", empresa_id: null },
        { descripcion: "Retención IVA 10.6667%", tipo: "retencion", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.106667", empresa_id: null },
        { descripcion: "Retención IVA 8%", tipo: "retencion", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.080000", empresa_id: null },
        { descripcion: "Retención ISR 10% (Honorarios)", tipo: "retencion", impuesto_sat: "001", tipo_factor: "Tasa", tasa_cuota: "0.100000", empresa_id: null },
        { descripcion: "Retención ISR 1.25% (RESICO)", tipo: "retencion", impuesto_sat: "001", tipo_factor: "Tasa", tasa_cuota: "0.012500", empresa_id: null },
        { descripcion: "IEPS 8% (Alimentos alto valor calórico)", tipo: "traslado", impuesto_sat: "003", tipo_factor: "Tasa", tasa_cuota: "0.080000", empresa_id: null }
      ]).catch(e => console.log('Impuesto seed notice:', e.message));
      console.log('Standard CFDI 4.0 taxes initialized.');
    }
  } catch (error) {
    console.error('Unable to connect to the database or sync:', error.message);
  }
});
