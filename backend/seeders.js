import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from './src/config/database.js';
import { Empresa, Rol, Usuario, Emisor } from './src/models/index.js';
import bcrypt from 'bcryptjs';

const seedDatabase = async () => {
    try {
        console.log('Iniciando carga de datos iniciales...');

        // 1. Asegurar sincronización de la base de datos
        await sequelize.sync({ alter: true });

        // 2. Crear Roles Base
        const [adminRol] = await Rol.findOrCreate({
            where: { nombre: 'Administrador' },
            defaults: { descripcion: 'Acceso total al sistema y gestión de usuarios.' }
        });

        const [usuarioEmpresarialRol] = await Rol.findOrCreate({
            where: { nombre: 'Usuario Empresarial' },
            defaults: { descripcion: 'Gestión de su empresa, receptores, emisores y documentos.' }
        });

        const [operadorRol] = await Rol.findOrCreate({
            where: { nombre: 'Operador' },
            defaults: { descripcion: 'Operación básica de facturación y consultas.' }
        });

        // 3. Crear Empresas de Prueba
        const [empresaDemo] = await Empresa.findOrCreate({
            where: { nombre: 'Corporativo Demo S.A. de C.V.' },
            defaults: { activo: true }
        });
        console.log('Empresa Demo creada/recuperada.');

        const [empresaSecundaria] = await Empresa.findOrCreate({
            where: { nombre: 'Servicios Industriales del Norte S.A.' },
            defaults: { activo: true }
        });
        console.log('Empresa Secundaria creada/recuperada.');

        // 4. Crear Emisores
        // Empresa Demo - Emisor 1 (Demo Principal)
        let emisorDemo1 = await Emisor.findOne({ where: { rfc: 'EKU9003173C9' } });
        if (!emisorDemo1) {
            emisorDemo1 = await Emisor.create({
                rfc: 'EKU9003173C9',
                razon_social: 'ESCUELA KEMPER URATE',
                regimen_fiscal: '601',
                codigo_postal: '26015',
                estado: 'Coahuila',
                municipio: 'Piedras Negras',
                empresa_id: empresaDemo.id
            });
            console.log('Emisor 1 para Empresa Demo creado: EKU9003173C9');
        } else {
            await emisorDemo1.update({ empresa_id: empresaDemo.id });
        }

        // Empresa Demo - Emisor 2 (Multi-emisor demo)
        let emisorDemo2 = await Emisor.findOne({ where: { rfc: 'SIA9003173C9' } });
        if (!emisorDemo2) {
            emisorDemo2 = await Emisor.create({
                rfc: 'SIA9003173C9',
                razon_social: 'SERVICIOS INTEGRALES ASOCIADOS S.A.',
                regimen_fiscal: '601',
                codigo_postal: '64000',
                estado: 'Nuevo León',
                municipio: 'Monterrey',
                empresa_id: empresaDemo.id
            });
            console.log('Emisor 2 para Empresa Demo creado: SIA9003173C9');
        } else {
            await emisorDemo2.update({ empresa_id: empresaDemo.id });
        }

        // Empresa Secundaria - Emisor 3
        let emisorSecundario = await Emisor.findOne({ where: { rfc: 'EKU9003173C8' } });
        if (!emisorSecundario) {
            emisorSecundario = await Emisor.create({
                rfc: 'EKU9003173C8',
                razon_social: 'ESCUELA KEMPER URATE SECUNDARIA',
                regimen_fiscal: '601',
                codigo_postal: '01000',
                estado: 'Ciudad de México',
                municipio: 'Álvaro Obregón',
                empresa_id: empresaSecundaria.id
            });
            console.log('Emisor para Empresa Secundaria creado: EKU9003173C8');
        } else {
            await emisorSecundario.update({ empresa_id: empresaSecundaria.id });
        }

        // 5. Crear Usuarios

        // A. Administrador Global (Sin empresa_id, gestiona todo)
        let adminUser = await Usuario.findOne({ where: { email: 'admin@cfdi4.mx' } });
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash('Admin*2026', 10);
            adminUser = await Usuario.create({
                nombre: 'Administrador Global',
                email: 'admin@cfdi4.mx',
                password_hash: hashedPassword,
                empresa_id: null
            });
            await adminUser.addRol(adminRol);
            console.log('Usuario Admin creado: admin@cfdi4.mx / Admin*2026');
        } else {
            await adminUser.update({ empresa_id: null });
        }
        // Vincular todos los emisores al Admin
        await adminUser.setEmisors([emisorDemo1, emisorDemo2, emisorSecundario]);

        // B. Usuario Empresarial - Empresa Demo
        let gerenteDemo = await Usuario.findOne({ where: { email: 'gerente@demo.com' } });
        if (!gerenteDemo) {
            const hashedPassword = await bcrypt.hash('Gerente*2026', 10);
            gerenteDemo = await Usuario.create({
                nombre: 'Gerente Demo S.A.',
                email: 'gerente@demo.com',
                password_hash: hashedPassword,
                empresa_id: empresaDemo.id
            });
            await gerenteDemo.addRol(usuarioEmpresarialRol);
            console.log('Gerente Empresa Demo creado: gerente@demo.com / Gerente*2026');
        } else {
            await gerenteDemo.update({ empresa_id: empresaDemo.id });
        }
        await gerenteDemo.setEmisors([emisorDemo1, emisorDemo2]);

        // C. Usuario Operador - Empresa Demo
        let operadorDemo = await Usuario.findOne({ where: { email: 'operador@demo.com' } });
        if (!operadorDemo) {
            const hashedPassword = await bcrypt.hash('Operador*2026', 10);
            operadorDemo = await Usuario.create({
                nombre: 'Operador Demo 1',
                email: 'operador@demo.com',
                password_hash: hashedPassword,
                empresa_id: empresaDemo.id
            });
            await operadorDemo.addRol(operadorRol);
            console.log('Operador Empresa Demo creado: operador@demo.com / Operador*2026');
        } else {
            await operadorDemo.update({ empresa_id: empresaDemo.id });
        }
        await operadorDemo.setEmisors([emisorDemo1, emisorDemo2]);

        // D. Usuario Empresarial - Empresa Secundaria
        let gerenteSecundario = await Usuario.findOne({ where: { email: 'gerente@secundario.com' } });
        if (!gerenteSecundario) {
            const hashedPassword = await bcrypt.hash('Gerente*2026', 10);
            gerenteSecundario = await Usuario.create({
                nombre: 'Gerente Secundaria S.A.',
                email: 'gerente@secundario.com',
                password_hash: hashedPassword,
                empresa_id: empresaSecundaria.id
            });
            await gerenteSecundario.addRol(usuarioEmpresarialRol);
            console.log('Gerente Empresa Secundaria creado: gerente@secundario.com / Gerente*2026');
        } else {
            await gerenteSecundario.update({ empresa_id: empresaSecundaria.id });
        }
        await gerenteSecundario.setEmisors([emisorSecundario]);

        // E. Usuario Operador - Empresa Secundaria
        let operadorSecundario = await Usuario.findOne({ where: { email: 'operador@secundario.com' } });
        if (!operadorSecundario) {
            const hashedPassword = await bcrypt.hash('Operador*2026', 10);
            operadorSecundario = await Usuario.create({
                nombre: 'Operador Secundario 1',
                email: 'operador@secundario.com',
                password_hash: hashedPassword,
                empresa_id: empresaSecundaria.id
            });
            await operadorSecundario.addRol(operadorRol);
            console.log('Operador Empresa Secundaria creado: operador@secundario.com / Operador*2026');
        } else {
            await operadorSecundario.update({ empresa_id: empresaSecundaria.id });
        }
        await operadorSecundario.setEmisors([emisorSecundario]);

        console.log('¡Seeding completado con éxito!');
        process.exit(0);
    } catch (error) {
        console.error('Error durante el seeding:', error);
        process.exit(1);
    }
};

seedDatabase();
