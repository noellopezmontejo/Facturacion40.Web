import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from './storage';

const getBaseUrl = () => {
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:4000/api';
    }
    return 'http://localhost:4000/api'; // iOS Simulator or Web development
};

const api = axios.create({
    baseURL: getBaseUrl(),
    timeout: 15000,
});

api.interceptors.request.use(
    async (config) => {
        const token = await getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
