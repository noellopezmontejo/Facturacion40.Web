import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Theme';
import api from '@/services/api';
import { getActiveEmisor } from '@/services/storage';

export default function ClientesScreen() {
    const [loading, setLoading] = useState(true);
    const [activeEmisor, setActiveEmisor] = useState<any>(null);
    const [clientes, setClientes] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form data
    const [rfc, setRfc] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [usoCfdi, setUsoCfdi] = useState('G03');
    const [regimenFiscal, setRegimenFiscal] = useState('601');
    const [codigoPostal, setCodigoPostal] = useState('');
    const [correo, setCorreo] = useState('');

    const loadClientes = async () => {
        try {
            const emisor = await getActiveEmisor();
            setActiveEmisor(emisor);
            if (emisor) {
                const res = await api.get(`/receptores/emisor/${emisor.id}`);
                setClientes(res.data);
            }
        } catch (error) {
            console.error('Error fetching clients on mobile:', error);
            Alert.alert('Error', 'No se pudieron cargar los clientes.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadClientes();
        }, [])
    );

    const handleAddClient = async () => {
        if (!rfc.trim() || !razonSocial.trim() || !codigoPostal.trim()) {
            Alert.alert('Campos requeridos', 'RFC, Razón Social y Código Postal son obligatorios.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                emisor_id: activeEmisor.id,
                rfc: rfc.trim().toUpperCase(),
                razon_social: razonSocial.trim().toUpperCase(),
                uso_cfdi: usoCfdi,
                regimen_fiscal: regimenFiscal,
                codigo_postal: codigoPostal.trim(),
                correo: correo.trim() || null
            };

            await api.post('/receptores', payload);
            Alert.alert('Éxito', 'Cliente guardado correctamente.');
            setModalVisible(false);
            
            // Clear form
            setRfc('');
            setRazonSocial('');
            setCodigoPostal('');
            setCorreo('');
            setUsoCfdi('G03');
            setRegimenFiscal('601');

            loadClientes();
        } catch (error: any) {
            console.error('Error saving client on mobile:', error);
            const msg = error.response?.data?.message || 'Error al guardar el cliente.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const filtered = clientes.filter(c => 
        c.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rfc.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchBarContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar cliente por nombre o RFC..."
                    placeholderTextColor={Theme.colors.textMuted}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Theme.colors.primary} />
                </View>
            ) : filtered.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>No se encontraron clientes.</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <View style={styles.clientCard}>
                            <View style={styles.clientMain}>
                                <Text style={styles.clientName}>{item.razon_social}</Text>
                                <Text style={styles.clientRfc}>{item.rfc}</Text>
                                <View style={styles.badgeRow}>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>USO: {item.uso_cfdi}</Text>
                                    </View>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>REG: {item.regimen_fiscal}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}

            <TouchableOpacity 
                style={styles.fab}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Modal de Alta de Clientes */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Agregar Cliente</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeText}>✖</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalForm}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>RFC *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="XAXX010101000"
                                    placeholderTextColor={Theme.colors.textMuted}
                                    autoCapitalize="characters"
                                    value={rfc}
                                    onChangeText={setRfc}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>RAZÓN SOCIAL *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="NOMBRE O RAZON SOCIAL S.A."
                                    placeholderTextColor={Theme.colors.textMuted}
                                    autoCapitalize="characters"
                                    value={razonSocial}
                                    onChangeText={setRazonSocial}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CÓDIGO POSTAL *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="64000"
                                    placeholderTextColor={Theme.colors.textMuted}
                                    keyboardType="number-pad"
                                    maxLength={5}
                                    value={codigoPostal}
                                    onChangeText={setCodigoPostal}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="cliente@ejemplo.com"
                                    placeholderTextColor={Theme.colors.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={correo}
                                    onChangeText={setCorreo}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>USO CFDI</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="G03"
                                    value={usoCfdi}
                                    onChangeText={setUsoCfdi}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>RÉGIMEN FISCAL</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="601"
                                    value={regimenFiscal}
                                    onChangeText={setRegimenFiscal}
                                />
                            </View>

                            <TouchableOpacity 
                                style={styles.saveButton}
                                onPress={handleAddClient}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color={Theme.colors.white} />
                                ) : (
                                    <Text style={styles.saveButtonText}>Guardar Cliente</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    searchBarContainer: {
        padding: Theme.spacing.md,
        backgroundColor: Theme.colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    searchInput: {
        height: 40,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.radius.md,
        paddingHorizontal: Theme.spacing.md,
        fontSize: 14,
        color: Theme.colors.text,
        backgroundColor: Theme.colors.background,
    },
    list: {
        padding: Theme.spacing.md,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: Theme.colors.textMuted,
        fontSize: 14,
    },
    clientCard: {
        backgroundColor: Theme.colors.card,
        borderRadius: Theme.radius.md,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        marginBottom: Theme.spacing.md,
    },
    clientMain: {
        flex: 1,
    },
    clientName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Theme.colors.text,
        marginBottom: 2,
    },
    clientRfc: {
        fontSize: 12,
        color: Theme.colors.textMuted,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: Theme.spacing.sm,
    },
    badge: {
        backgroundColor: Theme.colors.background,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Theme.radius.sm,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: Theme.colors.textMuted,
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    fabText: {
        color: Theme.colors.white,
        fontSize: 28,
        fontWeight: 'bold',
        lineHeight: 32,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Theme.colors.card,
        borderTopLeftRadius: Theme.radius.lg,
        borderTopRightRadius: Theme.radius.lg,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    closeText: {
        fontSize: 16,
        color: Theme.colors.textMuted,
        padding: 4,
    },
    modalForm: {
        padding: Theme.spacing.md,
        paddingBottom: Theme.spacing.xl,
    },
    inputGroup: {
        marginBottom: Theme.spacing.md,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Theme.colors.textMuted,
        marginBottom: 6,
        letterSpacing: 1,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.radius.md,
        paddingHorizontal: Theme.spacing.md,
        fontSize: 14,
        color: Theme.colors.text,
        backgroundColor: Theme.colors.background,
    },
    saveButton: {
        backgroundColor: Theme.colors.primary,
        height: 46,
        borderRadius: Theme.radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Theme.spacing.md,
    },
    saveButtonText: {
        color: Theme.colors.white,
        fontSize: 14,
        fontWeight: 'bold',
    },
});
