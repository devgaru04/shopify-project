import { env } from "../config/env.js";
import {
  exchangeCodeForToken,
  getAdminToken,
  getTokenClientCredentials,
  getAuthUrl,
  openAuthInBrowser,
  setAdminToken,
} from "../services/shopifyService.js";

// Redirige al usuario a la URL de autorización de Shopify para obtener permisos.
export function redirectToAuth(req, res) {
  res.redirect(getAuthUrl());
}

// Callback OAuth. Intercambia el código recibido por un token de Admin API.
export async function authCallback(req, res) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Falta el código de autorización");
    }

    const result = await exchangeCodeForToken(code);
    const token = result.access_token;
    setAdminToken(token);

    console.log("\n=== TOKEN DE ADMIN API ===");
    console.log(token);
    console.log("==========================\n");

    res.send(`
      <h2>Autenticación exitosa</h2>
      <p><strong>Access Token (cópialo de aquí):</strong></p>
      <pre style="background:#1a1a2e;color:#2ecc71;padding:1rem;border-radius:6px;word-break:break-all;font-size:0.85rem">${token}</pre>
      <p>El token también se ve en la terminal del backend.</p>
      <p><a href="/api/auth/token" target="_blank">Ver token como JSON</a></p>
    `);
  } catch (error) {
    console.error("Error en callback OAuth:", error.message);
    res.status(500).send("Error de autenticación: " + error.message);
  }
}

// Devuelve el token de Admin API cargado en memoria, si existe.
export function getAuthToken(req, res) {
  const token = getAdminToken();
  if (!token) {
    return res.status(401).json({ error: "No hay token. Visita /api/auth para autenticar." });
  }
  res.json({ access_token: token });
}

export function setAuthToken(req, res) {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: "access_token es requerido" });
  }

  setAdminToken(access_token);
  console.log("Token de Admin API configurado manualmente");
  res.json({ success: true, message: "Token configurado correctamente" });
}

export async function bootstrapAdminToken() {
  try {
    const token = await getTokenClientCredentials();
    setAdminToken(token);
    console.log(`Token de Admin API: ${token}`);
    return token;
  } catch {
    console.log("Abriendo navegador para autenticación OAuth...");
    openAuthInBrowser(env.port);
    console.log(`Si no se abre automáticamente, visita http://localhost:${env.port}/api/auth`);
    return null;
  }
}
