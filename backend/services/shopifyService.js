import https from "https";
import { exec } from "child_process";
import { env } from "../config/env.js";

let adminToken = null;

function requestJson(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: options.method || "POST",
        family: 4,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...options.headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("error", reject);
        res.on("end", () => {
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            return reject(
              new Error(`${options.label || "Request"} respondió con status ${res.statusCode}: ${data || "sin cuerpo"}`)
            );
          }

          try {
            const json = data ? JSON.parse(data) : {};
            resolve(json);
          } catch (error) {
            reject(new Error(`Error parseando respuesta de ${options.label || "Shopify"}`));
          }
        });
      }
    );

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

export function loadAdminToken() {
  const token = env.adminAccessToken;
  if (token) {
    adminToken = token;
    console.log("Token de Admin API cargado desde variables de entorno");
    return token;
  }

  return null;
}

export function setAdminToken(token) {
  adminToken = token;
}

export function getAdminToken() {
  return adminToken;
}

export async function shopifyFetch(query, variables = {}) {
  const url = new URL(`https://${env.shop}.myshopify.com/api/${env.apiVersion}/graphql.json`);
  const body = { query, variables };

  const json = await requestJson(
    url,
    {
      method: "POST",
      label: "Storefront API",
      headers: {
        "X-Shopify-Storefront-Access-Token": env.storefrontAccessToken,
      },
    },
    body
  );

  if (json.errors) {
    console.error(json.errors);
    throw new Error("Error en la Storefront API");
  }

  return json.data;
}

export async function adminFetch(query, variables = {}) {
  if (!adminToken) {
    throw new Error("No hay token de Admin API. Visita http://localhost:4000/api/auth para autenticar.");
  }

  const url = new URL(`https://${env.shop}.myshopify.com/admin/api/${env.apiVersion}/graphql.json`);
  const body = { query, variables };

  const json = await requestJson(
    url,
    {
      method: "POST",
      label: "Admin API",
      headers: {
        "X-Shopify-Access-Token": adminToken,
      },
    },
    body
  );

  if (json.errors) {
    const msgs = json.errors.map((error) => error.message).join("; ");
    console.error("Admin API errors:", msgs);
    throw new Error("Admin API: " + msgs);
  }

  return json.data;
}

export async function oauthTokenRequest(body) {
  const url = new URL(`https://${env.shop}.myshopify.com/admin/oauth/access_token`);
  return requestJson(url, { method: "POST", label: "OAuth Token" }, body);
}

export function exchangeCodeForToken(code) {
  return oauthTokenRequest({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    code,
  });
}

export async function getTokenClientCredentials() {
  const result = await oauthTokenRequest({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: "client_credentials",
  });

  return result.access_token;
}

export function getAuthUrl() {
  return `https://${env.shop}.myshopify.com/admin/oauth/authorize?client_id=${env.clientId}&scope=${encodeURIComponent(env.scopes)}&redirect_uri=${encodeURIComponent(env.oauthRedirectUri)}`;
}

export function openAuthInBrowser(port = env.port) {
  exec(`start http://localhost:${port}/api/auth`);
  console.log(`Si no se abre automáticamente, visita http://localhost:${port}/api/auth`);
}
