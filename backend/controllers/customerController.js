import { shopifyFetch, adminFetch } from "../services/shopifyService.js";

// Cache local temporal de clientes encontrados o creados en la sesión.
const localCustomers = [];

function normalizeCustomer(customer) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    source: customer.source || "local",
  };
}

export async function registerCustomer(req, res) {
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

    const data = await shopifyFetch(mutation, variables);

    if (data.customerCreate.customerUserErrors.length > 0) {
      return res.status(400).json({ error: data.customerCreate.customerUserErrors[0].message });
    }

    const customer = normalizeCustomer({
      ...data.customerCreate.customer,
      source: "shopify",
    });

    localCustomers.push(customer);

    res.json({ success: true, customer });
  } catch (error) {
    console.error("Error /api/register-customer:", error.message);
    res.status(500).json({ error: error.message });
  }
}

async function searchCustomerByEmail(email) {
  const customerQuery = `
    query customerQuery($query: String!) {
      customers(first: 1, query: $query) {
        edges {
          node {
            id
            email
            firstName
            lastName
          }
        }
      }
    }
  `;

  const queries = [`email:${email}`, `email:"${email}"`, email];

  for (const query of queries) {
    try {
      const searchData = await adminFetch(customerQuery, { query });
      const existing = searchData?.customers?.edges?.[0]?.node;
      if (existing) {
        return existing;
      }
    } catch (err) {
      // ignorar errores de búsqueda y continuar con el siguiente formato
    }
  }

  try {
    const fallbackQuery = `
      query getCustomers($first: Int!) {
        customers(first: $first) {
          edges {
            node {
              id
              email
              firstName
              lastName
            }
          }
        }
      }
    `;

    const allData = await adminFetch(fallbackQuery, { first: 50 });
    const match = (allData?.customers?.edges || []).find(
      ({ node }) => node.email && node.email.toLowerCase() === email.toLowerCase()
    );
    return match?.node || null;
  } catch (err) {
    return null;
  }
}

// Busca una orden en Shopify Admin API por número de orden.
async function searchCustomerByOrder(orderNumber) {
  const normalized = orderNumber.trim();
  if (!normalized) {
    return null;
  }

  const cleaned = normalized.replace(/^#/, "");
  const queries = [`name:${cleaned}`, `name:"${cleaned}"`, `name:"#${cleaned}"`];

  const orderQuery = `
    query orderQuery($query: String!) {
      orders(first: 1, query: $query) {
        edges {
          node {
            id
            name
            email
            customer {
              id
              email
              firstName
              lastName
            }
          }
        }
      }
    }
  `;

  for (const query of queries) {
    try {
      const data = await adminFetch(orderQuery, { query });
      const order = data?.orders?.edges?.[0]?.node;
      if (order) {
        return order;
      }
    } catch (err) {
      // ignore invalid query formats and continue
    }
  }

  return null;
}

export async function findCustomerByOrder(req, res) {
  try {
    const { orderNumber } = req.body;
    if (!orderNumber) {
      return res.status(400).json({ error: "orderNumber es requerido" });
    }

    const order = await searchCustomerByOrder(orderNumber);
    if (!order) {
      return res.status(404).json({ error: "No se encontró la orden" });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error /api/find-customer-by-order:", error.message);
    res.status(500).json({ error: error.message });
  }
}

// Busca o crea un cliente en Shopify. Primero revisa cache local y luego Shopify.
export async function findOrCreateCustomer(req, res) {
  try {
    const { email, firstName = "", lastName = "", password = "" } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email es requerido" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingLocal = localCustomers.find((customer) => customer.email?.toLowerCase() === normalizedEmail);
    if (existingLocal) {
      return res.json({ success: true, created: false, customer: existingLocal });
    }

    const existingShopifyCustomer = await searchCustomerByEmail(normalizedEmail);
    if (existingShopifyCustomer) {
      const customer = normalizeCustomer({ ...existingShopifyCustomer, source: "shopify" });
      localCustomers.push(customer);
      return res.json({ success: true, created: false, customer });
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
      input: {
        email: normalizedEmail,
        firstName: firstName || "Cliente",
        lastName: lastName || "Creado",
        password: password || "123456",
      },
    };

    const data = await adminFetch(mutation, variables);

    if (data.customerCreate.customerUserErrors.length > 0) {
      const errorMessage = data.customerCreate.customerUserErrors[0].message;
      const lowerError = errorMessage.toLowerCase();
      const shouldRetry =
        lowerError.includes("email has already been taken") ||
        lowerError.includes("email ya fue tomado") ||
        lowerError.includes("email already exists") ||
        lowerError.includes("verify your email address") ||
        lowerError.includes("verificar su dirección de correo electrónico") ||
        lowerError.includes("enviamos un correo electrónico");

      if (shouldRetry) {
        const existingRetry = await searchCustomerByEmail(normalizedEmail);
        if (existingRetry) {
          const customer = normalizeCustomer({ ...existingRetry, source: "shopify" });
          localCustomers.push(customer);
          return res.json({ success: true, created: false, customer });
        }
      }

      return res.status(400).json({ error: errorMessage });
    }

    const customer = normalizeCustomer({
      ...data.customerCreate.customer,
      source: "shopify",
    });

    localCustomers.push(customer);

    res.json({ success: true, created: true, customer });
  } catch (error) {
    console.error("Error /api/find-or-create-customer:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function getShopifyCustomers(req, res) {
  try {
    const first = Number(req.query.first || 250);
    const query = `
      query getCustomers($first: Int!) {
        customers(first: $first) {
          edges {
            node {
              id
              email
              firstName
              lastName
            }
          }
        }
      }
    `;

    const data = await adminFetch(query, { first: Number.isFinite(first) ? first : 250 });
    const customers = (data?.customers?.edges || []).map(({ node }) => normalizeCustomer(node));

    res.json(customers);
  } catch (error) {
    console.error("Error /api/shopify-customers:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export function getLocalCustomers(req, res) {
  res.json(localCustomers);
}
