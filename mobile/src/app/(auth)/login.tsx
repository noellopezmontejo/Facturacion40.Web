import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Theme } from '@/constants/Theme';
import api from '@/services/api';
import { saveToken, saveActiveEmisor } from '@/services/storage';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
            return;
        }

        setLoading(true);
        try {
            const resLogin = await api.post('/auth/login', {
                email: email.trim(),
                password: password
            });

            const { token, usuario } = resLogin.data;
            await saveToken(token);

            // Fetch emisores for this user
            const resEmisores = await api.get('/emisores', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (resEmisores.data && resEmisores.data.length > 0) {
                // Auto select the first emisor
                await saveActiveEmisor(resEmisores.data[0]);
            }

            // Redirect to dashboard
            router.replace('/(drawer)');
        } catch (error: any) {
            console.error('Login error:', error);
            const msg = error.response?.data?.message || 'Ocurrió un error al iniciar sesión. Inténtalo de nuevo.';
            Alert.alert('Error de acceso', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>CFDI</Text>
                    </View>
                    <Text style={styles.title}>Facturación 4.0</Text>
                    <Text style={styles.subtitle}>Ingresa a tu Espacio de Facturación Móvil</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="correo@ejemplo.com"
                            placeholderTextColor={Theme.colors.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>CONTRASEÑA</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor={Theme.colors.textMuted}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    <TouchableOpacity 
                        style={styles.button} 
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={Theme.colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>Iniciar Sesión</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <Text style={styles.footerText}>
                    Facturación Móvil Segura • PAC Autorizado
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: Theme.spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: Theme.spacing.xl,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        marginBottom: Theme.spacing.md,
    },
    logoText: {
        color: Theme.colors.white,
        fontSize: 22,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: Theme.colors.text,
        marginBottom: Theme.spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        color: Theme.colors.textMuted,
        textAlign: 'center',
    },
    card: {
        backgroundColor: Theme.colors.card,
        borderRadius: Theme.radius.lg,
        padding: Theme.spacing.lg,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: Theme.spacing.xl,
    },
    inputGroup: {
        marginBottom: Theme.spacing.md,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Theme.colors.textMuted,
        marginBottom: Theme.spacing.xs,
        letterSpacing: 1,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.radius.md,
        paddingHorizontal: Theme.spacing.md,
        fontSize: 14,
        color: Theme.colors.text,
        backgroundColor: Theme.colors.background,
    },
    button: {
        backgroundColor: Theme.colors.primary,
        height: 48,
        borderRadius: Theme.radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Theme.spacing.sm,
        shadowColor: Theme.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonText: {
        color: Theme.colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12,
        color: Theme.colors.textMuted,
    },
});
