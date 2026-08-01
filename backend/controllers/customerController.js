import { shopifyFetch } from "../services/shopifyService.js";

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

    res.json({ success: true, customer: data.customerCreate.customer });
  } catch (error) {
    console.error("Error /api/register-customer:", error.message);
    res.status(500).json({ error: error.message });
  }
}
