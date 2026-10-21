import dotenv from 'dotenv';
dotenv.config();

import { login } from './src/controllers/authController.js';

const req = {
    body: { email: 'admin@cfdi4.mx', password: 'Admin*2026' }
};

const res = {
    status: function (code) { console.log("Status:", code); return this; },
    json: function (data) { console.log("JSON:", data); return this; }
};

async function run() {
    try {
        console.log("Starting test...");
        await login(req, res);
    } catch (e) {
        console.error("Unhandled error in test:", e);
    } finally {
        process.exit();
    }
}

run();
