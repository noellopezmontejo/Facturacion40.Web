import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Impuestos } from './pages/Impuestos';
import { Conceptos } from './pages/Conceptos';
import { ImpuestosLocales } from './pages/ImpuestosLocales';
import { Emisores } from './pages/Emisores';
import { NuevaFactura } from './pages/Facturacion';
import { Documentos } from './pages/Documentos';
import { Receptores } from './pages/Receptores';
import { DiseñadorFactura } from './pages/DiseñadorFactura';
import { ControlPagos } from './pages/Pagos';
import Vehiculos from './pages/Vehiculos';
import Choferes from './pages/Choferes';
import CartaPorteWizard from './pages/CartaPorteWizard';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';
import { Usuarios } from './pages/Usuarios';
import { Configuracion } from './pages/Configuracion';
import { CuentasPorPagar } from './pages/CuentasPorPagar';
import { Cotizaciones } from './pages/Cotizaciones';
import { NuevaCotizacion } from './pages/NuevaCotizacion';
import { OrdenesServicio } from './pages/OrdenesServicio';
import { NuevaOrdenServicio } from './pages/NuevaOrdenServicio';


function App() {
    return (
        <ToastProvider>
            <Router>
            <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Dashboard />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/impuestos" element={
                    <ProtectedRoute allowedRoles={['Administrador', 'Usuario Empresarial']}>
                        <DashboardLayout>
                            <Impuestos />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/impuestos-locales" element={
                    <ProtectedRoute allowedRoles={['Administrador', 'Usuario Empresarial']}>
                        <DashboardLayout>
                            <ImpuestosLocales />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/conceptos" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Conceptos />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/emisores" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Emisores />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/facturas/nueva" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <NuevaFactura />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/documentos" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Documentos />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/receptores" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Receptores />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/pagos" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <ControlPagos />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/cuentas-por-pagar" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <CuentasPorPagar />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/cotizaciones" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Cotizaciones />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/cotizaciones/nueva" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <NuevaCotizacion />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/ordenes-servicio" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <OrdenesServicio />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/ordenes-servicio/nueva" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <NuevaOrdenServicio />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/vehiculos" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Vehiculos />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/usuarios" element={
                    <ProtectedRoute allowedRoles={['Administrador', 'Usuario Empresarial']}>
                        <DashboardLayout>
                            <Usuarios />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/choferes" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <Choferes />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/carta-porte/nueva" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <CartaPorteWizard />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/configuracion/diseno" element={
                    <ProtectedRoute allowedRoles={['Administrador']}>
                        <DashboardLayout>
                            <DiseñadorFactura />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/configuracion" element={
                    <ProtectedRoute allowedRoles={['Administrador', 'Usuario Empresarial']}>
                        <DashboardLayout>
                            <Configuracion />
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
                <Route path="/*" element={
                    <ProtectedRoute>
                        <DashboardLayout>
                            <div className="flex items-center justify-center h-full">
                                <h2 className="text-2xl text-slate-400 font-medium">Módulo en construcción</h2>
                            </div>
                        </DashboardLayout>
                    </ProtectedRoute>
                } />
            </Routes>
        </Router>
    </ToastProvider>
    );
}

export default App;
