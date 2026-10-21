import { Drawer } from 'expo-router/drawer';
import { Theme } from '@/constants/Theme';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { deleteToken, deleteActiveEmisor } from '@/services/storage';
import { Text, View, StyleSheet } from 'react-native';

function CustomDrawerContent(props: any) {
    const router = useRouter();
    const handleLogout = async () => {
        await deleteToken();
        await deleteActiveEmisor();
        router.replace('/(auth)/login');
    };

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
            <View style={styles.drawerHeader}>
                <Text style={styles.headerTitle}>Facturación</Text>
                <Text style={styles.headerSubtitle}>Móvil CFDI 4.0</Text>
            </View>
            <View style={{ flex: 1 }}>
                <DrawerItemList {...props} />
            </View>
            <View style={styles.drawerFooter}>
                <DrawerItem 
                    label="Cerrar Sesión" 
                    onPress={handleLogout}
                    labelStyle={{ color: Theme.colors.danger, fontWeight: 'bold' }}
                />
            </View>
        </DrawerContentScrollView>
    );
}

export default function DrawerLayout() {
    return (
        <Drawer 
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerTintColor: Theme.colors.text,
                headerStyle: {
                    backgroundColor: Theme.colors.card,
                    borderBottomWidth: 1,
                    borderBottomColor: Theme.colors.border,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                drawerActiveTintColor: Theme.colors.primary,
                drawerInactiveTintColor: Theme.colors.textMuted,
                drawerLabelStyle: {
                    fontWeight: 'bold',
                }
            }}
        >
            <Drawer.Screen 
                name="index" 
                options={{ 
                    title: 'Dashboard',
                }} 
            />
            <Drawer.Screen 
                name="clientes" 
                options={{ 
                    title: 'Clientes',
                }} 
            />
            <Drawer.Screen 
                name="conceptos" 
                options={{ 
                    title: 'Conceptos',
                }} 
            />
            <Drawer.Screen 
                name="facturas" 
                options={{ 
                    title: 'Nueva Factura',
                }} 
            />
        </Drawer>
    );
}

const styles = StyleSheet.create({
    drawerHeader: {
        padding: Theme.spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
        backgroundColor: Theme.colors.background,
        marginBottom: Theme.spacing.sm,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: Theme.colors.textMuted,
        marginTop: 2,
    },
    drawerFooter: {
        borderTopWidth: 1,
        borderTopColor: Theme.colors.border,
        paddingBottom: Theme.spacing.lg,
    }
});
