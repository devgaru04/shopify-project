import { adminFetch } from "../services/shopifyService.js";

async function createDiscountCode(payload) {
  const {
    code,
    title,
    type,
    value,
    minimumSubtotal,
    usageLimit,
    appliesOnEachItem,
    customerId,
    productId,
  } = payload;

  if (!code || !title || !type || value === undefined || value === "") {
    throw new Error("Faltan campos requeridos: code, title, type, value");
  }

  if (type !== "fixed" && type !== "percentage") {
    throw new Error("El tipo debe ser 'fixed' o 'percentage'");
  }

  const customerGetsValue =
    type === "percentage"
      ? { percentage: parseFloat(value) }
      : {
          discountAmount: {
            amount: parseFloat(value).toFixed(2),
            appliesOnEachItem: !!appliesOnEachItem,
          },
        };

  const variables = {
    basicCodeDiscount: {
      title,
      code,
      startsAt: new Date().toISOString(),
      customerSelection: customerId
        ? {
            customers: {
              add: [customerId],
            },
          }
        : {
            all: true,
          },
      customerGets: {
        items: productId ? { all: true } : { all: true },
        value: customerGetsValue,
      },
    },
  };

  if (minimumSubtotal && !isNaN(minimumSubtotal)) {
    variables.basicCodeDiscount.minimumSubtotal = {
      amount: parseFloat(minimumSubtotal).toFixed(2),
      currencyCode: "USD",
    };
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

  if (data.discountCodeBasicCreate.userErrors.length) {
    return {
      success: false,
      errors: data.discountCodeBasicCreate.userErrors,
    };
  }

  return {
    success: true,
    discountCode: code,
    discount: data.discountCodeBasicCreate,
  };
}

export async function createDiscount(req, res) {
  try {
    const result = await createDiscountCode(req.body);

    if (!result.success) {
      return res.status(400).json(result.errors);
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

export async function assignDiscountToCustomer(req, res) {
  try {
    const { customerEmail, customerId, ...payload } = req.body;

    if (!customerEmail && !customerId) {
      return res.status(400).json({ error: "customerEmail o customerId es requerido" });
    }

    let resolvedCustomerId = customerId;

    if (!resolvedCustomerId && customerEmail) {
      const looksLikeCustomerGid = typeof customerEmail === "string" && customerEmail.startsWith("gid://shopify/Customer/");
      if (looksLikeCustomerGid) {
        resolvedCustomerId = customerEmail;
      } else {
        return res.status(400).json({
          error: "Shopify no permite resolver clientes por email desde esta app sin aprobación para datos protegidos de clientes. Envía un customerId de Shopify (por ejemplo gid://shopify/Customer/123456789) para asignar el descuento.",
        });
      }
    }

    if (resolvedCustomerId && typeof resolvedCustomerId === "string" && !resolvedCustomerId.startsWith("gid://shopify/Customer/")) {
      resolvedCustomerId = `gid://shopify/Customer/${resolvedCustomerId}`;
    }

    const result = await createDiscountCode({ ...payload, customerId: resolvedCustomerId });

    if (!result.success) {
      return res.status(400).json(result.errors);
    }

    res.json({ ...result, customerEmail, customerId: resolvedCustomerId });
  } catch (error) {
    console.error("Error /api/assign-discount-to-customer:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function debugDiscountSchema(req, res) {
  try {
    /* const query = `
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
    `; */

    /* const query = `
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

  discountContextInput: __type(name: "DiscountContextInput") {
    name
    inputFields {
      name
      type {
        kind
        name
        ofType {
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
`; */
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

  discountContextInput: __type(name: "DiscountContextInput") {
    name
    inputFields {
      name
      type {
        kind
        name
        ofType {
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

  discountCustomersInput: __type(name: "DiscountCustomersInput") {
    name
    inputFields {
      name
      type {
        kind
        name
        ofType {
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

  discountCustomerSegmentsInput: __type(name: "DiscountCustomerSegmentsInput") {
    name
    inputFields {
      name
      type {
        kind
        name
        ofType {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
