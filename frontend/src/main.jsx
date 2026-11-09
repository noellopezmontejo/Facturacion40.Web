import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'

// Desregistrar cualquier Service Worker residual y purgar cachés obsoletos en este origen
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
            registration.unregister().then(unregistered => {
                if (unregistered) console.log('[PWA] Service Worker residual eliminado:', registration.scope);
            });
        }
    }).catch(err => console.warn('[PWA] Error limpiando Service Workers:', err));
}

if (typeof window !== 'undefined' && 'caches' in window) {
    caches.keys().then(keys => {
        for (const key of keys) {
            caches.delete(key).then(() => console.log('[Cache] Caché purgada:', key));
        }
    }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </React.StrictMode>,
)
