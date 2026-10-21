import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [activeEmisor, setActiveEmisor] = useState(null);
    const [activeEmpresa, setActiveEmpresa] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    setUser(decoded);

                    // Recuperar espacio de trabajo activo guardado
                    const savedEmpresa = localStorage.getItem('activeEmpresa');
                    if (savedEmpresa) {
                        try {
                            setActiveEmpresa(JSON.parse(savedEmpresa));
                        } catch (e) {
                            console.error("Error parsing savedEmpresa", e);
                        }
                    }

                    // Recuperar emisor activo guardado
                    const savedEmisor = localStorage.getItem('activeEmisor');
                    if (savedEmisor) {
                        try {
                            setActiveEmisor(JSON.parse(savedEmisor));
                        } catch (e) {
                            console.error("Error parsing savedEmisor", e);
                        }
                    }

                } catch (error) {
                    console.error("Invalid token on load", error);
                    localStorage.removeItem('token');
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { token, usuario } = response.data;

        localStorage.setItem('token', token);
        const decoded = jwtDecode(token);
        setUser(decoded);

        return usuario;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('activeEmisor');
        localStorage.removeItem('activeEmpresa');
        setUser(null);
        setActiveEmisor(null);
        setActiveEmpresa(null);
        window.location.href = '/login';
    };

    const changeActiveEmpresa = (empresa, emisorToSelect = null) => {
        setActiveEmpresa(empresa);
        if (empresa) {
            localStorage.setItem('activeEmpresa', JSON.stringify(empresa));
        } else {
            localStorage.removeItem('activeEmpresa');
        }

        if (emisorToSelect) {
            setActiveEmisor(emisorToSelect);
            localStorage.setItem('activeEmisor', JSON.stringify(emisorToSelect));
        } else if (empresa && empresa.Emisors && empresa.Emisors.length > 0) {
            const first = empresa.Emisors[0];
            setActiveEmisor(first);
            localStorage.setItem('activeEmisor', JSON.stringify(first));
        } else {
            setActiveEmisor(null);
            localStorage.removeItem('activeEmisor');
        }
    };

    const changeActiveEmisor = (emisor) => {
        setActiveEmisor(emisor);
        if (emisor) {
            localStorage.setItem('activeEmisor', JSON.stringify(emisor));
            if (emisor.Empresa) {
                setActiveEmpresa(emisor.Empresa);
                localStorage.setItem('activeEmpresa', JSON.stringify(emisor.Empresa));
            }
        } else {
            localStorage.removeItem('activeEmisor');
        }
    };

    const refreshActiveEmpresa = async () => {
        if (!activeEmpresa?.id) return;
        try {
            const { data } = await api.get('/empresas/mi-empresa', {
                params: { empresa_id: activeEmpresa.id }
            });
            setActiveEmpresa(data);
            localStorage.setItem('activeEmpresa', JSON.stringify(data));
            
            // Si el emisor actual ya no existe o es null, actualizarlo
            if (!activeEmisor && data.Emisors && data.Emisors.length > 0) {
                setActiveEmisor(data.Emisors[0]);
                localStorage.setItem('activeEmisor', JSON.stringify(data.Emisors[0]));
            }
        } catch (error) {
            console.error("Error refreshing active empresa", error);
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            activeEmisor, 
            activeEmpresa, 
            loading, 
            login, 
            logout, 
            changeActiveEmisor, 
            changeActiveEmpresa,
            refreshActiveEmpresa
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
