import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Theme';
import api from '@/services/api';
import { getActiveEmisor } from '@/services/storage';

const { width: screenWidth } = Dimensions.get('window');

function MetricItem({ title, value, change, trend, loading }: any) {
    return (
        <View style={styles.metricCard}>
            {loading ? (
                <View style={styles.skeleton}>
                    <ActivityIndicator size="small" color={Theme.colors.primary} />
                </View>
            ) : (
                <>
                    <View style={styles.metricHeader}>
                        <Text style={styles.metricTitle}>{title}</Text>
                        {trend && (
                            <View style={[
                                styles.trendBadge,
                                trend === 'up' ? styles.trendUp : styles.trendDown
                            ]}>
                                <Text style={[
                                    styles.trendText,
                                    trend === 'up' ? styles.trendTextUp : styles.trendTextDown
                                ]}>{change}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.metricValue}>{value}</Text>
                </>
            )}
        </View>
    );
}

export default function DashboardScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeEmisor, setActiveEmisor] = useState<any>(null);
    const [data, setData] = useState<any>(null);

    const loadData = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const emisor = await getActiveEmisor();
            setActiveEmisor(emisor);

            const url = emisor ? `/dashboard?emisorId=${emisor.id}` : '/dashboard';
            const res = await api.get(url);
            setData(res.data);
        } catch (error) {
            console.error('Error fetching dashboard data on mobile:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData(false);
    };

    // Chart scaling
    const maxVal = data?.chartData?.length > 0 
        ? Math.max(...data.chartData.map((d: any) => Math.max(d.facturado, d.cobrado)), 0) 
        : 0;

    return (
        <ScrollView 
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
            }
        >
            <View style={styles.emisorHeader}>
                <Text style={styles.emisorLabel}>EMISOR ACTIVO</Text>
                <Text style={styles.emisorName}>
                    {activeEmisor ? activeEmisor.razon_social : 'Cargando emisor...'}
                </Text>
                <Text style={styles.emisorRfc}>
                    {activeEmisor ? activeEmisor.rfc : ''}
                </Text>
            </View>

            {/* Metrics Section */}
            <View style={styles.metricsGrid}>
                <MetricItem 
                    title="Reventas del Mes" 
                    value={loading ? '...' : `$${(data?.metrics?.ingresos?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    change={data?.metrics?.ingresos?.change}
                    trend={data?.metrics?.ingresos?.trend}
                    loading={loading}
                />
                <MetricItem 
                    title="Facturas Emitidas" 
                    value={loading ? '...' : (data?.metrics?.facturas?.value || 0).toString()}
                    change={data?.metrics?.facturas?.change}
                    trend={data?.metrics?.facturas?.trend}
                    loading={loading}
                />
                <MetricItem 
                    title="Cartera Vencida" 
                    value={loading ? '...' : `$${(data?.metrics?.carteraVencida?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    change={data?.metrics?.carteraVencida?.change}
                    trend={data?.metrics?.carteraVencida?.trend}
                    loading={loading}
                />
                <MetricItem 
                    title="Nuevos Clientes" 
                    value={loading ? '...' : (data?.metrics?.clientes?.value || 0).toString()}
                    change={data?.metrics?.clientes?.change}
                    trend={data?.metrics?.clientes?.trend}
                    loading={loading}
                />
            </View>

            {/* Chart Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Historial 6 Meses (Facturado vs Cobrado)</Text>
                {loading ? (
                    <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.chartLoader} />
                ) : (
                    <View style={styles.chartContainer}>
                        <View style={styles.chartBarsArea}>
                            {data?.chartData?.map((item: any, idx: number) => {
                                const heightFacturado = maxVal > 0 ? (item.facturado / maxVal) * 120 : 0;
                                const heightCobrado = maxVal > 0 ? (item.cobrado / maxVal) * 120 : 0;

                                return (
                                    <View key={idx} style={styles.barGroup}>
                                        <View style={styles.barsRow}>
                                            <View style={[styles.bar, styles.barFacturado, { height: Math.max(heightFacturado, 4) }]} />
                                            <View style={[styles.bar, styles.barCobrado, { height: Math.max(heightCobrado, 4) }]} />
                                        </View>
                                        <Text style={styles.barLabel}>{item.name}</Text>
                                    </View>
                                );
                            })}
                        </View>
                        <View style={styles.chartLegend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: Theme.colors.primary }]} />
                                <Text style={styles.legendText}>Facturado</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#cbd5e1' }]} />
                                <Text style={styles.legendText}>Cobrado</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* Recent Documents Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Facturas Recientes</Text>
                {loading ? (
                    <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.chartLoader} />
                ) : data?.recentDocuments?.length === 0 ? (
                    <Text style={styles.emptyText}>Sin documentos recientes.</Text>
                ) : (
                    <View style={styles.recentList}>
                        {data?.recentDocuments?.map((doc: any, idx: number) => (
                            <View key={doc.id} style={[
                                styles.recentItem,
                                idx === data.recentDocuments.length - 1 ? styles.lastItem : null
                            ]}>
                                <View style={styles.recentMain}>
                                    <Text style={styles.recentFolio}>{doc.serie || 'F'}-{doc.folio || doc.id}</Text>
                                    <Text style={styles.recentClient} numberOfLines={1}>{doc.Receptor?.razon_social}</Text>
                                </View>
                                <View style={styles.recentRight}>
                                    <Text style={styles.recentTotal}>${parseFloat(doc.total).toFixed(2)}</Text>
                                    <View style={[
                                        styles.statusBadge,
                                        doc.estado_pago === 'Pagado' ? styles.statusPaid : styles.statusUnpaid
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            doc.estado_pago === 'Pagado' ? styles.statusTextPaid : styles.statusTextUnpaid
                                        ]}>{doc.estado_pago}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    content: {
        padding: Theme.spacing.md,
    },
    emisorHeader: {
        backgroundColor: Theme.colors.card,
        borderRadius: Theme.radius.lg,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        marginBottom: Theme.spacing.md,
    },
    emisorLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: Theme.colors.textMuted,
        letterSpacing: 1,
        marginBottom: 2,
    },
    emisorName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    emisorRfc: {
        fontSize: 12,
        color: Theme.colors.textMuted,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginTop: 2,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: Theme.spacing.md,
    },
    metricCard: {
        backgroundColor: Theme.colors.card,
        width: (screenWidth - Theme.spacing.md * 3) / 2,
        borderRadius: Theme.radius.md,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        marginBottom: Theme.spacing.md,
    },
    skeleton: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.xs,
    },
    metricTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: Theme.colors.textMuted,
    },
    trendBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Theme.radius.full,
        borderWidth: 1,
    },
    trendUp: {
        backgroundColor: Theme.colors.successLight,
        borderColor: '#a7f3d0',
    },
    trendDown: {
        backgroundColor: Theme.colors.dangerLight,
        borderColor: '#fecdd3',
    },
    trendText: {
        fontSize: 8,
        fontWeight: 'bold',
    },
    trendTextUp: {
        color: '#047857',
    },
    trendTextDown: {
        color: '#b91c1c',
    },
    metricValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    card: {
        backgroundColor: Theme.colors.card,
        borderRadius: Theme.radius.lg,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        marginBottom: Theme.spacing.md,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Theme.colors.text,
        marginBottom: Theme.spacing.md,
    },
    chartLoader: {
        paddingVertical: Theme.spacing.xl,
    },
    chartContainer: {
        alignItems: 'center',
    },
    chartBarsArea: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 160,
        width: '100%',
        paddingBottom: Theme.spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    barGroup: {
        alignItems: 'center',
        width: (screenWidth - Theme.spacing.lg * 4) / 6,
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height: 130,
    },
    bar: {
        width: 6,
        borderRadius: Theme.radius.sm,
    },
    barFacturado: {
        backgroundColor: Theme.colors.primary,
    },
    barCobrado: {
        backgroundColor: '#cbd5e1',
    },
    barLabel: {
        fontSize: 10,
        color: Theme.colors.textMuted,
        marginTop: 6,
    },
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Theme.spacing.md,
        marginTop: Theme.spacing.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    legendText: {
        fontSize: 11,
        color: Theme.colors.textMuted,
        fontWeight: 'semibold',
    },
    emptyText: {
        textAlign: 'center',
        color: Theme.colors.textMuted,
        paddingVertical: Theme.spacing.lg,
        fontSize: 14,
    },
    recentList: {
        marginTop: -Theme.spacing.sm,
    },
    recentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    lastItem: {
        borderBottomWidth: 0,
    },
    recentMain: {
        flex: 1,
        paddingRight: Theme.spacing.sm,
    },
    recentFolio: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    recentClient: {
        fontSize: 11,
        color: Theme.colors.textMuted,
        marginTop: 2,
    },
    recentRight: {
        alignItems: 'flex-end',
    },
    recentTotal: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: Theme.radius.sm,
        borderWidth: 1,
        marginTop: 3,
    },
    statusPaid: {
        backgroundColor: Theme.colors.successLight,
        borderColor: '#a7f3d0',
    },
    statusUnpaid: {
        backgroundColor: Theme.colors.dangerLight,
        borderColor: '#fecdd3',
    },
    statusText: {
        fontSize: 8,
        fontWeight: 'bold',
    },
    statusTextPaid: {
        color: '#047857',
    },
    statusTextUnpaid: {
        color: '#b91c1c',
    },
});
