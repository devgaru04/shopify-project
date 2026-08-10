import { adminFetch } from "./shopifyService.js";

function normalizeCustomerId(customerId) {
  if (!customerId) return null;
  if (typeof customerId === "string" && customerId.startsWith("gid://shopify/Customer/")) {
    return customerId;
  }
  if (typeof customerId === "string" && customerId.startsWith("Customer/")) {
    return `gid://shopify/${customerId}`;
  }
  return `gid://shopify/Customer/${customerId}`;
}

export async function creditCustomerStoreBalance({ customerId, amount, currency = "USD" }) {
  const normalizedId = normalizeCustomerId(customerId);
  if (!normalizedId) {
    throw new Error("Debes seleccionar un cliente válido para asignar crédito de tienda");
  }

  const amountValue = Number(amount);
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new Error("El monto de crédito debe ser mayor que cero");
  }

  const mutation = `
    mutation storeCreditAccountCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
      storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
        storeCreditAccountTransaction {
          amount {
            amount
            currencyCode
          }
          account {
            id
            balance {
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

  const variables = {
    id: normalizedId,
    creditInput: {
      creditAmount: {
        amount: amountValue.toFixed(2),
        currencyCode: currency,
      },
    },
  };

  console.log("Admin API store credit mutation variables:", JSON.stringify(variables));

  const data = await adminFetch(mutation, variables);

  const result = data?.storeCreditAccountCredit;
  if (!result) {
    throw new Error("No se recibió respuesta válida del crédito de tienda");
  }

  const userErrors = result.userErrors || [];
  if (userErrors.length > 0) {
    throw new Error(userErrors[0].message || "No se pudo asignar el crédito de tienda");
  }

  return {
    customerId: normalizedId,
    amount: amountValue,
    currency,
    transaction: result.storeCreditAccountTransaction,
  };
}
