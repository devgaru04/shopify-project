import { creditCustomerStoreBalance } from "../services/storeCreditService.js";

export async function assignStoreCreditToCustomer(req, res) {
  try {
    const { customerId, amount, currency = "USD" } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ error: "Debes seleccionar un cliente válido" });
    }

    const result = await creditCustomerStoreBalance({
      customerId,
      amount,
      currency,
    });

    return res.json({
      success: true,
      message: "Crédito de tienda asignado correctamente",
      ...result,
    });
  } catch (error) {
    console.error("Error /api/assign-store-credit-to-customer:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
