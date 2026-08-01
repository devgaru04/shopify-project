import { adminFetch } from "../services/shopifyService.js";

export async function createDiscount(req, res) {
  try {
    const {
      code,
      title,
      type,
      value,
      minimumSubtotal,
      usageLimit,
      appliesOnEachItem,
    } = req.body;

    if (!code || !title || !type || value === undefined || value === "") {
      return res.status(400).json({ error: "Faltan campos requeridos: code, title, type, value" });
    }

    if (type !== "fixed" && type !== "percentage") {
      return res.status(400).json({ error: "El tipo debe ser 'fixed' o 'percentage'" });
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
        context: { all: "ALL" },
        customerGets: {
          items: { all: true },
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
      return res.status(400).json(data.discountCodeBasicCreate.userErrors);
    }

    res.json(data.discountCodeBasicCreate);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

export async function debugDiscountSchema(req, res) {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
