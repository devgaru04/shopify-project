import express from "express";
import cors from "cors";
import https from "https";
import fs from "fs";
import { exec } from "child_process";
const TOKEN_FILE = new URL(".admin_token", import.meta.url);

const app = express();
app.use(cors());
app.use(express.json());

// const SHOP = "believe-capillus-test";
const SHOP = "books-d0nhy1ck";
// const STOREFRONT_ACCESS_TOKEN = "";
const STOREFRONT_ACCESS_TOKEN = "";

// OAuth 2.0 credentials (Admin API)
const CLIENT_ID = "";
const CLIENT_SECRET = "";
const SCOPES = "";
const OAUTH_REDIRECT_URI = "";
let adminToken = null;

try {
  adminToken = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  if (adminToken) console.log("Token de Admin API cargado desde archivo");
} catch { } // no existe el archivo, no importa

const API_URL = `https://${SHOP}.myshopify.com/api/2024-10/graphql.json`;
const ADMIN_API_URL = `https://${SHOP}.myshopify.com/admin/api/2024-10/graphql.json`;

function shopifyFetch(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL);
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: "POST",
        family: 4,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_ACCESS_TOKEN,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("error", reject);
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Shopify API respondió con status ${res.statusCode}: ${data || "sin cuerpo"}`));
          }
          try {
            const json = JSON.parse(data);
            if (json.errors) {
              console.error(json.errors);
              reject(new Error("Error en la Storefront API"));
            } else {
              resolve(json.data);
            }
          } catch (e) {
            reject(new Error("Error parseando respuesta de Shopify"));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function adminFetch(query, variables = {}) {
  return new Promise((resolve, reject) => {
    if (!adminToken) {
      return reject(new Error("No hay token de Admin API. Visita http://localhost:4000/api/auth para autenticar."));
    }
    const url = new URL(ADMIN_API_URL);
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: "POST",
        family: 4,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("error", reject);
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Admin API respondió con status ${res.statusCode}: ${data || "sin cuerpo"}`));
          }
          try {
            const json = JSON.parse(data);
            if (json.errors) {
              const msgs = json.errors.map(e => e.message).join("; ");
              console.error("Admin API errors:", msgs);
              reject(new Error("Admin API: " + msgs));
            } else {
              resolve(json.data);
            }
          } catch (e) {
            reject(new Error("Error parseando respuesta de Admin API"));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function oauthTokenRequest(body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${SHOP}.myshopify.com/admin/oauth/access_token`);
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: "POST",
        family: 4,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("error", reject);
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Error obteniendo token: ${res.statusCode} ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Error parseando respuesta de token"));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function exchangeCodeForToken(code) {
  return oauthTokenRequest({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
  });
}

async function getTokenClientCredentials() {
  const result = await oauthTokenRequest({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  return result.access_token;
}

app.get("/api/products", async (req, res) => {
  try {
    const query = `
      query Products($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              description
              handle
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              options {
                name
                values
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    price {
                      amount
                      currencyCode
                    }
                    selectedOptions {
                      name
                      value
                    }
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await shopifyFetch(query, { first: 20 });
    const products = data.products.edges.map((e) => e.node);
    res.json(products);
  } catch (error) {
    console.error("Error /api/products:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/products/:handle", async (req, res) => {
  try {
    const query = `
      query ProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          descriptionHtml
          handle
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 5) {
            edges {
              node {
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                availableForSale
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;
    const data = await shopifyFetch(query, { handle: req.params.handle });
    if (!data.productByHandle) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    res.json(data.productByHandle);
  } catch (error) {
    console.error("Error /api/products/:handle:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/checkout", async (req, res) => {
  try {
    const { lines } = req.body;
    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }

    const query = `
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        title
                        images(first: 1) {
                          edges {
                            node {
                              url
                              altText
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            cost {
              totalAmount {
                amount
                currencyCode
              }
              subtotalAmount {
                amount
                currencyCode
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await shopifyFetch(query, {
      input: {
        lines: lines.map((line) => ({
          merchandiseId: line.merchandiseId,
          quantity: line.quantity,
        })),
      },
    });

    if (!data || !data.cartCreate) {
      return res.status(500).json({ error: "Respuesta inválida de Shopify" });
    }

    if (data.cartCreate.userErrors && data.cartCreate.userErrors.length > 0) {
      return res.status(400).json({ error: data.cartCreate.userErrors[0].message });
    }

    if (!data.cartCreate.cart || !data.cartCreate.cart.checkoutUrl) {
      return res.status(500).json({ error: "No se pudo crear el carrito en Shopify" });
    }

    res.json(data.cartCreate.cart);
  } catch (error) {
    console.error("Error /api/checkout:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/create-discount", async (req, res) => {
  try {
    const {
      code,
      title,
      type,
      value,
      minimumSubtotal,
      usageLimit,
      appliesOnEachItem
    } = req.body;

    if (!code || !title || !type || value === undefined || value === "") {
      return res.status(400).json({ error: "Faltan campos requeridos: code, title, type, value" });
    }

    if (type !== "fixed" && type !== "percentage") {
      return res.status(400).json({ error: "El tipo debe ser 'fixed' o 'percentage'" });
    }

    const customerGetsValue = type === "percentage"
      ? { percentage: parseFloat(value) }
      : { discountAmount: { amount: parseFloat(value).toFixed(2), appliesOnEachItem: !!appliesOnEachItem } };

    const variables = {
      basicCodeDiscount: {
        title,
        code,
        startsAt: new Date().toISOString(),
        context: { all: "ALL" },
        customerGets: {
          items: { all: true },
          value: customerGetsValue
        }
      }
    };

    if (minimumSubtotal && !isNaN(minimumSubtotal)) {
      variables.basicCodeDiscount.minimumSubtotal = { amount: parseFloat(minimumSubtotal).toFixed(2), currencyCode: "USD" };
    }

    if (usageLimit && !isNaN(usageLimit)) {
      variables.basicCodeDiscount.usageLimit = parseInt(usageLimit);
    }

    const mutation = `
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                startsAt
                createdAt
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await adminFetch(mutation, variables);

    console.log(JSON.stringify(data, null, 2));

    if (data.discountCodeBasicCreate.userErrors.length) {
      return res
        .status(400)
        .json(data.discountCodeBasicCreate.userErrors);
    }

    res.json(data.discountCodeBasicCreate);

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: e.message
    });
  }
});

app.get("/api/debug-discount-schema", async (req, res) => {
  try {
    const query = `
      query {
        customerGetsValue: __type(name: "DiscountCustomerGetsValueInput") {
          name
          inputFields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }

        discountBasicInput: __type(name: "DiscountCodeBasicInput") {
          name
          inputFields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }

        discountNode: __type(name: "DiscountCodeBasic") {
          name
          fields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    `;

    const data = await adminFetch(query);

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

app.post("/api/register-customer", async (req, res) => {
  try {
    const { email, firstName, lastName, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email y password son requeridos" });
    }

    const mutation = `
      mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: { email, firstName, lastName, password },
    };
    console.log("Enviando a Storefront API:", JSON.stringify({ query: mutation, variables }));
    const data = await shopifyFetch(mutation, variables);

    if (data.customerCreate.customerUserErrors.length > 0) {
      return res.status(400).json({ error: data.customerCreate.customerUserErrors[0].message });
    }

    res.json({ success: true, customer: data.customerCreate.customer });
  } catch (error) {
    console.error("Error /api/register-customer:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth", (req, res) => {
  const authUrl = `https://${SHOP}.myshopify.com/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}`;
  res.redirect(authUrl);
});

app.get("/api/auth/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Falta el código de autorización");
    }
    const result = await exchangeCodeForToken(code);
    adminToken = result.access_token;
    fs.writeFileSync(TOKEN_FILE, adminToken);
    console.log("\n=== TOKEN DE ADMIN API ===");
    console.log(adminToken);
    console.log("==========================\n");
    res.send(`
      <h2>Autenticación exitosa</h2>
      <p><strong>Access Token (cópialo de aquí):</strong></p>
      <pre style="background:#1a1a2e;color:#2ecc71;padding:1rem;border-radius:6px;word-break:break-all;font-size:0.85rem">${adminToken}</pre>
      <p>El token también se ve en la terminal del backend.</p>
      <p><a href="/api/auth/token" target="_blank">Ver token como JSON</a></p>
    `);
  } catch (error) {
    console.error("Error en callback OAuth:", error.message);
    res.status(500).send("Error de autenticación: " + error.message);
  }
});

app.get("/api/auth/token", (req, res) => {
  if (!adminToken) {
    return res.status(401).json({ error: "No hay token. Visita /api/auth para autenticar." });
  }
  res.json({ access_token: adminToken });
});

app.post("/api/auth/token", (req, res) => {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: "access_token es requerido" });
  }
  adminToken = access_token;
  fs.writeFileSync(TOKEN_FILE, adminToken);
  console.log("Token de Admin API configurado manualmente");
  res.json({ success: true, message: "Token configurado correctamente" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  try {
    const token = await getTokenClientCredentials();
    adminToken = token;
    console.log(`Token de Admin API: ${token}`);
  } catch {
    console.log("Abriendo navegador para autenticación OAuth...");
    exec(`start http://localhost:${PORT}/api/auth`);
    console.log(`Si no se abre automáticamente, visita http://localhost:${PORT}/api/auth`);
  }
});
