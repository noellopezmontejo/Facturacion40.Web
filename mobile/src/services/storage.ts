import * as SecureStore from 'expo-secure-store';

export const saveToken = async (token: string) => {
    await SecureStore.setItemAsync('userToken', token);
};

export const getToken = async () => {
    return await SecureStore.getItemAsync('userToken');
};

export const deleteToken = async () => {
    await SecureStore.deleteItemAsync('userToken');
};

export const saveActiveEmisor = async (emisor: any) => {
    await SecureStore.setItemAsync('activeEmisor', JSON.stringify(emisor));
};

export const getActiveEmisor = async () => {
    const data = await SecureStore.getItemAsync('activeEmisor');
    return data ? JSON.parse(data) : null;
};

export const deleteActiveEmisor = async () => {
    await SecureStore.deleteItemAsync('activeEmisor');
};
