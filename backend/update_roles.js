import { sequelize } from './src/config/database.js';
import { Rol, Usuario } from './src/models/index.js';

async function migrateRoles() {
    try {
        console.log('Migrando roles antiguos a nuevos nombres...');

        // Buscar roles antiguos y nuevos
        const oldSuperAdmin = await Rol.findOne({ where: { nombre: 'Super Administrador' } });
        const oldAdminEmpresa = await Rol.findOne({ where: { nombre: 'Administrador de Empresa' } });

        const newAdmin = await Rol.findOne({ where: { nombre: 'Administrador' } });
        const newEmpresa = await Rol.findOne({ where: { nombre: 'Usuario Empresarial' } });

        if (oldSuperAdmin && newAdmin) {
            const users = await oldSuperAdmin.getUsuarios();
            for (const user of users) {
                await user.addRol(newAdmin);
                await user.removeRol(oldSuperAdmin);
                console.log(`Usuario actualizado: ${user.email} -> Rol: Administrador`);
            }
            await oldSuperAdmin.destroy();
            console.log('Rol antiguo "Super Administrador" eliminado.');
        }

        if (oldAdminEmpresa && newEmpresa) {
            const users = await oldAdminEmpresa.getUsuarios();
            for (const user of users) {
                await user.addRol(newEmpresa);
                await user.removeRol(oldAdminEmpresa);
                console.log(`Usuario actualizado: ${user.email} -> Rol: Usuario Empresarial`);
            }
            await oldAdminEmpresa.destroy();
            console.log('Rol antiguo "Administrador de Empresa" eliminado.');
        }

        console.log('Migración de roles completada con éxito.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración de roles:', err);
        process.exit(1);
    }
}

migrateRoles();
