import { shopifyFetch } from "../services/shopifyService.js";

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

export async function findOrCreateCustomer(req, res) {
  try {
    const { email, firstName = "", lastName = "", password = "" } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email es requerido" });
    }

    const existingLocal = localCustomers.find((customer) => customer.email?.toLowerCase() === email.toLowerCase());
    if (existingLocal) {
      return res.json({ success: true, created: false, customer: existingLocal });
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
      input: { email, firstName, lastName, password: password || "Temp123456!" },
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

    res.json({ success: true, created: true, customer });
  } catch (error) {
    console.error("Error /api/find-or-create-customer:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export function getLocalCustomers(req, res) {
  res.json(localCustomers);
}
