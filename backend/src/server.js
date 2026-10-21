import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

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



// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Facturación CFDI 4.0 Backend Running' });
});

// Server Initialization
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
