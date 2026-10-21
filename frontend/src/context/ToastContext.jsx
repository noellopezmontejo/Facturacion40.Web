import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 5 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            
            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl min-w-[320px] max-w-md animate-in slide-in-from-right duration-300 ${
                            toast.type === 'success' ? 'bg-emerald-600 text-white' : 
                            toast.type === 'error' ? 'bg-rose-600 text-white' : 
                            'bg-slate-800 text-white'
                        }`}
                    >
                        <div className="flex-shrink-0">
                            {toast.type === 'success' ? <CheckCircle className="w-6 h-6" /> : 
                             toast.type === 'error' ? <AlertCircle className="w-6 h-6" /> : 
                             <Info className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-black tracking-tight leading-tight">
                                {toast.message}
                            </p>
                        </div>
                        <button 
                            onClick={() => removeToast(toast.id)}
                            className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
