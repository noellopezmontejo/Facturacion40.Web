import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { Theme } from '@/constants/Theme';
import api from '@/services/api';
import { getActiveEmisor } from '@/services/storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function FacturasScreen() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeEmisor, setActiveEmisor] = useState<any>(null);

    // Catalogs
    const [clientes, setClientes] = useState<any[]>([]);
    const [conceptos, setConceptos] = useState<any[]>([]);

    // Form Selection State
    const [selectedReceptorId, setSelectedReceptorId] = useState('');
    const [formaPago, setFormaPago] = useState('01'); // Efectivo
    const [metodoPago, setMetodoPago] = useState('PUE');
    const [usoCfdi, setUsoCfdi] = useState('G03');

    // Selected Invoice Line Items
    const [partidas, setPartidas] = useState<any[]>([]);

    // Stamped invoice results
    const [emittedDoc, setEmittedDoc] = useState<any>(null);

    const loadData = async () => {
        try {
            const emisor = await getActiveEmisor();
            setActiveEmisor(emisor);
            if (emisor) {
                const [resClientes, resConceptos] = await Promise.all([
                    api.get(`/receptores/emisor/${emisor.id}`),
                    api.get(`/conceptos/emisor/${emisor.id}`)
                ]);
                setClientes(resClientes.data);
                setConceptos(resConceptos.data);
            }
        } catch (error) {
            console.error('Error loading invoicing data on mobile:', error);
            Alert.alert('Error', 'No se pudieron precargar los catálogos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Calculate Totals Reactively
    const calculateTotals = () => {
        let subtotal = 0;
        let descuento = 0;
        let iva = 0;

        partidas.forEach(p => {
            const qty = p.cantidad || 0;
            const price = p.valor_unitario || 0;
            const desc = p.descuento || 0;
            const itemBase = (qty * price) - desc;

            subtotal += (qty * price);
            descuento += desc;
            iva += itemBase * 0.16; // Standard IVA 16%
        });

        return {
            subtotal,
            descuento,
            iva,
            total: subtotal - descuento + iva
        };
    };

    const totals = calculateTotals();

    const handleAddPartida = (concept: any) => {
        const exists = partidas.find(p => p.id === concept.id);
        if (exists) {
            Alert.alert('Concepto ya agregado', 'Puedes ajustar la cantidad directamente en el resumen.');
            return;
        }

        setPartidas([...partidas, {
            ...concept,
            cantidad: 1,
            descuento: 0
        }]);
        Alert.alert('Agregado', `${concept.descripcion.substring(0, 20)}... se agregó a la factura.`);
    };

    const handleRemovePartida = (id: number) => {
        setPartidas(partidas.filter(p => p.id !== id));
    };

    const handleUpdateQuantity = (id: number, val: string) => {
        const qty = parseFloat(val) || 0;
        setPartidas(partidas.map(p => p.id === id ? { ...p, cantidad: qty } : p));
    };

    const handleEmitirFactura = async () => {
        if (!selectedReceptorId) {
            Alert.alert('Falta cliente', 'Por favor selecciona un cliente en el Paso 1.');
            setStep(1);
            return;
        }
        if (partidas.length === 0) {
            Alert.alert('Falta conceptos', 'Agrega al menos un producto o servicio en el Paso 2.');
            setStep(2);
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                emisorId: activeEmisor.id,
                receptorId: selectedReceptorId,
                tipo_documento_id: 1, // Factura
                tipo_comprobante: 'I',
                forma_pago: formaPago,
                metodo_pago: metodoPago,
                uso_cfdi: usoCfdi,
                moneda: 'MXN',
                tipo_cambio: '1',
                fecha: new Date().toISOString(),
                subtotal: totals.subtotal,
                total: totals.total,
                soloGuardar: false, // Mandar a timbrar directamente al SAT
                detalles: partidas.map(p => ({
                    concepto_id: p.id,
                    cantidad: p.cantidad,
                    valor_unitario: p.valor_unitario,
                    descuento: p.descuento,
                    importe: (p.cantidad * p.valor_unitario) - p.descuento,
                    es_objeto_imp: p.es_objeto_imp || '02'
                })),
                impuestosLocales: { traslados: [], retenciones: [] }
            };

            const response = await api.post('/documentos/emitir', payload);
            Alert.alert('Timbrado Exitoso', 'El comprobante ha sido certificado por el SAT.');
            setEmittedDoc(response.data.documento);
            setStep(4); // Pantalla de éxito
        } catch (error: any) {
            console.error('Error emitting CFDI on mobile:', error);
            const msg = error.response?.data?.message || 'Error al emitir el documento.';
            Alert.alert('Error de Timbrado', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleShareFile = async (url: string, filename: string) => {
        if (!url) {
            Alert.alert('No disponible', 'El enlace al archivo no está disponible.');
            return;
        }

        try {
            const host = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
            const fileUrl = url.startsWith('http') ? url : `${host}${url}`;
            const localPath = `${FileSystem.documentDirectory}${filename}`;

            console.log(`Downloading ${fileUrl} to ${localPath}`);
            const downloadRes = await FileSystem.downloadAsync(fileUrl, localPath);

            if (downloadRes.status === 200) {
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    await Sharing.shareAsync(localPath);
                } else {
                    Alert.alert('Error', 'Compartir nativo no está disponible en este dispositivo.');
                }
            } else {
                Alert.alert('Error', 'No se pudo descargar el archivo.');
            }
        } catch (e) {
            console.error('File share failed:', e);
            Alert.alert('Error', 'Ocurrió un error al descargar/compartir el archivo.');
        }
    };

    const handleResetWizard = () => {
        setStep(1);
        setSelectedReceptorId('');
        setPartidas([]);
        setEmittedDoc(null);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.loadingText}>Cargando asistente...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Step Indicators */}
            {step < 4 && (
                <View style={styles.stepIndicator}>
                    <TouchableOpacity onPress={() => setStep(1)} style={[styles.stepDot, step === 1 ? styles.stepActive : null]}>
                        <Text style={[styles.stepDotText, step === 1 ? styles.stepActiveText : null]}>1</Text>
                    </TouchableOpacity>
                    <View style={styles.stepLine} />
                    <TouchableOpacity onPress={() => setStep(2)} style={[styles.stepDot, step === 2 ? styles.stepActive : null]}>
                        <Text style={[styles.stepDotText, step === 2 ? styles.stepActiveText : null]}>2</Text>
                    </TouchableOpacity>
                    <View style={styles.stepLine} />
                    <TouchableOpacity onPress={() => setStep(3)} style={[styles.stepDot, step === 3 ? styles.stepActive : null]}>
                        <Text style={[styles.stepDotText, step === 3 ? styles.stepActiveText : null]}>3</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Paso 1: Datos Generales */}
                {step === 1 && (
                    <View style={styles.stepCard}>
                        <Text style={styles.stepTitle}>Paso 1: Datos Generales</Text>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>SELECCIONAR RECEPTOR (CLIENTE) *</Text>
                            <View style={styles.selectWrapper}>
                                {clientes.map(c => (
                                    <TouchableOpacity 
                                        key={c.id} 
                                        style={[
                                            styles.selectOption,
                                            selectedReceptorId === c.id.toString() ? styles.selectOptionActive : null
                                        ]}
                                        onPress={() => setSelectedReceptorId(c.id.toString())}
                                    >
                                        <Text style={[
                                            styles.selectOptionText,
                                            selectedReceptorId === c.id.toString() ? styles.selectOptionActiveText : null
                                        ]}>
                                            {c.rfc} - {c.razon_social}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                {clientes.length === 0 && <Text style={styles.emptyOptionText}>Registra clientes primero.</Text>}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>MÉTODO DE PAGO</Text>
                            <View style={styles.flexRow}>
                                <TouchableOpacity 
                                    style={[styles.choiceBtn, metodoPago === 'PUE' ? styles.choiceBtnActive : null]}
                                    onPress={() => setMetodoPago('PUE')}
                                >
                                    <Text style={[styles.choiceText, metodoPago === 'PUE' ? styles.choiceTextActive : null]}>PUE (Una exhibición)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.choiceBtn, metodoPago === 'PPD' ? styles.choiceBtnActive : null]}
                                    onPress={() => setMetodoPago('PPD')}
                                >
                                    <Text style={[styles.choiceText, metodoPago === 'PPD' ? styles.choiceTextActive : null]}>PPD (Diferido)</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>FORMA DE PAGO</Text>
                            <TextInput 
                                style={styles.input} 
                                value={formaPago} 
                                onChangeText={setFormaPago}
                                placeholder="01"
                            />
                        </View>

                        <TouchableOpacity style={styles.nextButton} onPress={() => setStep(2)}>
                            <Text style={styles.nextButtonText}>Siguiente: Agregar Partidas</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Paso 2: Agregar Conceptos */}
                {step === 2 && (
                    <View style={styles.stepCard}>
                        <Text style={styles.stepTitle}>Paso 2: Conceptos del Catálogo</Text>
                        <Text style={styles.stepSubtitle}>Toca un concepto para agregarlo a la factura.</Text>
                        
                        <View style={styles.catalogList}>
                            {conceptos.map(c => (
                                <TouchableOpacity 
                                    key={c.id} 
                                    style={styles.catalogItem}
                                    onPress={() => handleAddPartida(c)}
                                >
                                    <View style={styles.catalogLeft}>
                                        <Text style={styles.catalogDesc}>{c.descripcion}</Text>
                                        <Text style={styles.catalogSat}>{c.clave_prod_serv} • {c.unidad}</Text>
                                    </View>
                                    <Text style={styles.catalogPrice}>${parseFloat(c.valor_unitario).toFixed(2)}</Text>
                                </TouchableOpacity>
                            ))}
                            {conceptos.length === 0 && <Text style={styles.emptyText}>Registra conceptos primero.</Text>}
                        </View>

                        <TouchableOpacity style={styles.nextButton} onPress={() => setStep(3)}>
                            <Text style={styles.nextButtonText}>Siguiente: Resumen e Importes</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Paso 3: Resumen e Importes */}
                {step === 3 && (
                    <View style={styles.stepCard}>
                        <Text style={styles.stepTitle}>Paso 3: Resumen de la Factura</Text>
                        
                        <View style={styles.invoiceLines}>
                            {partidas.map(p => (
                                <View key={p.id} style={styles.lineItem}>
                                    <View style={styles.lineMain}>
                                        <Text style={styles.lineDesc}>{p.descripcion}</Text>
                                        <Text style={styles.linePrice}>${parseFloat(p.valor_unitario).toFixed(2)} c/u</Text>
                                    </View>
                                    <View style={styles.lineControls}>
                                        <TextInput
                                            style={styles.qtyInput}
                                            keyboardType="numeric"
                                            value={p.cantidad.toString()}
                                            onChangeText={(val) => handleUpdateQuantity(p.id, val)}
                                        />
                                        <Text style={styles.lineSub}>${(p.cantidad * p.valor_unitario).toFixed(2)}</Text>
                                        <TouchableOpacity onPress={() => handleRemovePartida(p.id)} style={styles.removeBtn}>
                                            <Text style={styles.removeBtnText}>✖</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            {partidas.length === 0 && (
                                <Text style={styles.emptyText}>No has agregado partidas.</Text>
                            )}
                        </View>

                        {/* Totales Card */}
                        <View style={styles.totalsCard}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Subtotal</Text>
                                <Text style={styles.totalVal}>${totals.subtotal.toFixed(2)}</Text>
                            </View>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>IVA (16%)</Text>
                                <Text style={styles.totalVal}>${totals.iva.toFixed(2)}</Text>
                            </View>
                            <View style={[styles.totalRow, styles.grandTotalRow]}>
                                <Text style={styles.grandTotalLabel}>TOTAL</Text>
                                <Text style={styles.grandTotalVal}>${totals.total.toFixed(2)} MXN</Text>
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={styles.emitButton} 
                            onPress={handleEmitirFactura}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color={Theme.colors.white} />
                            ) : (
                                <Text style={styles.emitButtonText}>Generar y Timbrar Factura</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Paso 4: Éxito y Descarga */}
                {step === 4 && emittedDoc && (
                    <View style={styles.stepCard}>
                        <View style={styles.successIconCircle}>
                            <Text style={styles.successCheck}>✓</Text>
                        </View>
                        <Text style={styles.successTitle}>¡Factura Certificada!</Text>
                        <Text style={styles.successSubtitle}>El CFDI ha sido timbrado por el SAT exitosamente.</Text>

                        <View style={styles.docInfoBox}>
                            <Text style={styles.docInfoLabel}>FOLIO FISCAL (UUID):</Text>
                            <Text style={styles.docInfoUuid}>{emittedDoc.uuid}</Text>
                            <Text style={styles.docInfoLabel}>FOLIO COMPROBANTE:</Text>
                            <Text style={styles.docInfoValue}>{emittedDoc.serie}-{emittedDoc.folio}</Text>
                        </View>

                        <TouchableOpacity 
                            style={[styles.shareBtn, styles.sharePdf]} 
                            onPress={() => handleShareFile(emittedDoc.pdf_url, `Factura_${emittedDoc.serie}_${emittedDoc.folio}.pdf`)}
                        >
                            <Text style={styles.shareBtnText}>Compartir PDF Nativamente</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.shareBtn, styles.shareXml]} 
                            onPress={() => handleShareFile(emittedDoc.xml_url, `Factura_${emittedDoc.serie}_${emittedDoc.folio}.xml`)}
                        >
                            <Text style={styles.shareBtnText}>Compartir XML CFDI 4.0</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.resetBtn} onPress={handleResetWizard}>
                            <Text style={styles.resetBtnText}>Nueva Emisión</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Theme.spacing.md,
        backgroundColor: Theme.colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    stepDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Theme.colors.card,
    },
    stepActive: {
        backgroundColor: Theme.colors.primary,
        borderColor: Theme.colors.primary,
    },
    stepDotText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Theme.colors.textMuted,
    },
    stepActiveText: {
        color: Theme.colors.white,
    },
    stepLine: {
        width: 50,
        height: 2,
        backgroundColor: Theme.colors.border,
        mx: Theme.spacing.xs,
    },
    scrollContent: {
        padding: Theme.spacing.md,
    },
    stepCard: {
        backgroundColor: Theme.colors.card,
        borderRadius: Theme.radius.lg,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Theme.colors.text,
        marginBottom: Theme.spacing.md,
    },
    stepSubtitle: {
        fontSize: 12,
        color: Theme.colors.textMuted,
        marginBottom: Theme.spacing.sm,
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
    selectWrapper: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.radius.md,
        padding: 4,
        maxHeight: 180,
    },
    selectOption: {
        paddingVertical: 10,
        paddingHorizontal: Theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    selectOptionActive: {
        backgroundColor: Theme.colors.primaryLight,
    },
    selectOptionText: {
        fontSize: 12,
        color: Theme.colors.text,
    },
    selectOptionActiveText: {
        fontWeight: 'bold',
        color: Theme.colors.primary,
    },
    emptyOptionText: {
        textAlign: 'center',
        paddingVertical: Theme.spacing.md,
        color: Theme.colors.textMuted,
        fontSize: 12,
    },
    flexRow: {
        flexDirection: 'row',
        gap: 8,
    },
    choiceBtn: {
        flex: 1,
        height: 40,
        borderRadius: Theme.radius.sm,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Theme.colors.background,
    },
    choiceBtnActive: {
        backgroundColor: Theme.colors.primary,
        borderColor: Theme.colors.primary,
    },
    choiceText: {
        fontSize: 12,
        color: Theme.colors.text,
    },
    choiceTextActive: {
        color: Theme.colors.white,
        fontWeight: 'bold',
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
    nextButton: {
        backgroundColor: Theme.colors.primary,
        height: 46,
        borderRadius: Theme.radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Theme.spacing.md,
    },
    nextButtonText: {
        color: Theme.colors.white,
        fontSize: 14,
        fontWeight: 'bold',
    },
    catalogList: {
        marginBottom: Theme.spacing.md,
    },
    catalogItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.radius.md,
        marginBottom: Theme.spacing.sm,
    },
    catalogLeft: {
        flex: 1,
        paddingRight: Theme.spacing.sm,
    },
    catalogDesc: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    catalogSat: {
        fontSize: 10,
        color: Theme.colors.textMuted,
        marginTop: 2,
    },
    catalogPrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Theme.colors.primary,
    },
    emptyText: {
        textAlign: 'center',
        color: Theme.colors.textMuted,
        paddingVertical: Theme.spacing.xl,
        fontSize: 13,
    },
    invoiceLines: {
        marginBottom: Theme.spacing.md,
    },
    lineItem: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.radius.md,
        padding: Theme.spacing.md,
        marginBottom: Theme.spacing.sm,
    },
    lineMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Theme.spacing.sm,
    },
    lineDesc: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Theme.colors.text,
        flex: 1,
        paddingRight: Theme.spacing.sm,
    },
    linePrice: {
        fontSize: 12,
        color: Theme.colors.textMuted,
    },
    lineControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
    },
    qtyInput: {
        width: 50,
        height: 30,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.radius.sm,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 'bold',
        color: Theme.colors.text,
        backgroundColor: Theme.colors.background,
    },
    lineSub: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    removeBtn: {
        padding: 4,
    },
    removeBtnText: {
        color: Theme.colors.danger,
        fontSize: 14,
    },
    totalsCard: {
        backgroundColor: Theme.colors.background,
        borderRadius: Theme.radius.md,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        marginBottom: Theme.spacing.md,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
    },
    totalLabel: {
        fontSize: 12,
        color: Theme.colors.textMuted,
    },
    totalVal: {
        fontSize: 12,
        color: Theme.colors.text,
        fontWeight: 'semibold',
    },
    grandTotalRow: {
        borderTopWidth: 1,
        borderTopColor: Theme.colors.border,
        paddingTop: Theme.spacing.sm,
        marginTop: Theme.spacing.xs,
    },
    grandTotalLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    grandTotalVal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Theme.colors.primary,
    },
    emitButton: {
        backgroundColor: Theme.colors.primary,
        height: 48,
        borderRadius: Theme.radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
    },
    emitButtonText: {
        color: Theme.colors.white,
        fontSize: 15,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Theme.spacing.sm,
        color: Theme.colors.textMuted,
        fontSize: 13,
    },
    successIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Theme.colors.successLight,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginVertical: Theme.spacing.md,
    },
    successCheck: {
        color: Theme.colors.success,
        fontSize: 32,
        fontWeight: 'bold',
    },
    successTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Theme.colors.text,
        textAlign: 'center',
        marginBottom: 2,
    },
    successSubtitle: {
        fontSize: 12,
        color: Theme.colors.textMuted,
        textAlign: 'center',
        marginBottom: Theme.spacing.lg,
    },
    docInfoBox: {
        backgroundColor: Theme.colors.background,
        borderRadius: Theme.radius.md,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        marginBottom: Theme.spacing.lg,
    },
    docInfoLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: Theme.colors.textMuted,
        marginBottom: 2,
    },
    docInfoUuid: {
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: Theme.colors.text,
        marginBottom: Theme.spacing.sm,
        textTransform: 'uppercase',
    },
    docInfoValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    shareBtn: {
        height: 46,
        borderRadius: Theme.radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Theme.spacing.sm,
    },
    sharePdf: {
        backgroundColor: '#ef4444', // Red for PDF
    },
    shareXml: {
        backgroundColor: '#3b82f6', // Blue for XML
    },
    shareBtnText: {
        color: Theme.colors.white,
        fontSize: 14,
        fontWeight: 'bold',
    },
    resetBtn: {
        height: 46,
        borderRadius: Theme.radius.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Theme.spacing.sm,
    },
    resetBtnText: {
        color: Theme.colors.textMuted,
        fontSize: 14,
        fontWeight: 'bold',
    },
});
