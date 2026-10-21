import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Theme';
import api from '@/services/api';
import { getActiveEmisor } from '@/services/storage';

export default function ConceptosScreen() {
    const [loading, setLoading] = useState(true);
    const [activeEmisor, setActiveEmisor] = useState<any>(null);
    const [conceptos, setConceptos] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form data
    const [claveProdServ, setClaveProdServ] = useState('');
    const [claveUnidad, setClaveUnidad] = useState('H87');
    const [unidad, setUnidad] = useState('Pieza');
    const [descripcion, setDescripcion] = useState('');
    const [valorUnitario, setValorUnitario] = useState('');
    const [esObjetoImp, setEsObjetoImp] = useState('02'); // Sí objeto de impuesto

    const loadConceptos = async () => {
        try {
            const emisor = await getActiveEmisor();
            setActiveEmisor(emisor);
            if (emisor) {
                const res = await api.get(`/conceptos/emisor/${emisor.id}`);
                setConceptos(res.data);
            }
        } catch (error) {
            console.error('Error fetching concepts on mobile:', error);
            Alert.alert('Error', 'No se pudieron cargar los conceptos.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadConceptos();
        }, [])
    );

    const handleAddConcepto = async () => {
        if (!claveProdServ.trim() || !descripcion.trim() || !valorUnitario.trim()) {
            Alert.alert('Campos requeridos', 'Clave SAT, Descripción y Precio son obligatorios.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                emisor_id: activeEmisor.id,
                clave_prod_serv: claveProdServ.trim(),
                clave_unidad: claveUnidad.trim(),
                unidad: unidad.trim(),
                descripcion: descripcion.trim(),
                valor_unitario: parseFloat(valorUnitario),
                es_objeto_imp: esObjetoImp
            };

            await api.post('/conceptos', payload);
            Alert.alert('Éxito', 'Concepto guardado correctamente.');
            setModalVisible(false);
            
            // Clear form
            setClaveProdServ('');
            setClaveUnidad('H87');
            setUnidad('Pieza');
            setDescripcion('');
            setValorUnitario('');
            setEsObjetoImp('02');

            loadConceptos();
        } catch (error: any) {
            console.error('Error saving concept on mobile:', error);
            const msg = error.response?.data?.message || 'Error al guardar el concepto.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const filtered = conceptos.filter(c => 
        c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.clave_prod_serv.includes(searchTerm)
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchBarContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por descripción o clave SAT..."
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
                    <Text style={styles.emptyText}>No se encontraron productos o servicios.</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <View style={styles.conceptCard}>
                            <View style={styles.conceptMain}>
                                <Text style={styles.conceptName}>{item.descripcion}</Text>
                                <View style={styles.detailsRow}>
                                    <Text style={styles.conceptSat}>SAT: {item.clave_prod_serv}</Text>
                                    <Text style={styles.conceptUnit}>UNIDAD: {item.clave_unidad} ({item.unidad})</Text>
                                </View>
                            </View>
                            <View style={styles.conceptPriceContainer}>
                                <Text style={styles.conceptPrice}>${parseFloat(item.valor_unitario).toFixed(2)}</Text>
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

            {/* Modal de Alta de Conceptos */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Agregar Concepto</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeText}>✖</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalForm}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CLAVE SAT (PRODUCTO/SERVICIO) *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="84111506"
                                    placeholderTextColor={Theme.colors.textMuted}
                                    keyboardType="number-pad"
                                    value={claveProdServ}
                                    onChangeText={setClaveProdServ}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>DESCRIPCIÓN DEL CONCEPTO *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="SERVICIOS DE FACTURACION O SOFTWARE"
                                    placeholderTextColor={Theme.colors.textMuted}
                                    value={descripcion}
                                    onChangeText={setDescripcion}
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                                    <Text style={styles.label}>CLAVE UNIDAD *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="H87"
                                        value={claveUnidad}
                                        onChangeText={setClaveUnidad}
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                                    <Text style={styles.label}>UNIDAD *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Pieza"
                                        value={unidad}
                                        onChangeText={setUnidad}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>PRECIO UNITARIO *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="150.00"
                                    placeholderTextColor={Theme.colors.textMuted}
                                    keyboardType="numeric"
                                    value={valorUnitario}
                                    onChangeText={setValorUnitario}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>OBJETO DE IMPUESTO</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="02"
                                    value={esObjetoImp}
                                    onChangeText={setEsObjetoImp}
                                />
                            </View>

                            <TouchableOpacity 
                                style={styles.saveButton}
                                onPress={handleAddConcepto}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color={Theme.colors.white} />
                                ) : (
                                    <Text style={styles.saveButtonText}>Guardar Concepto</Text>
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
    conceptCard: {
        backgroundColor: Theme.colors.card,
        borderRadius: Theme.radius.md,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    conceptMain: {
        flex: 1,
        paddingRight: Theme.spacing.sm,
    },
    conceptName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Theme.colors.text,
        marginBottom: 4,
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    conceptSat: {
        fontSize: 11,
        color: Theme.colors.textMuted,
        fontWeight: 'semibold',
    },
    conceptUnit: {
        fontSize: 11,
        color: Theme.colors.textMuted,
    },
    conceptPriceContainer: {
        alignItems: 'flex-end',
    },
    conceptPrice: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Theme.colors.primary,
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
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
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
