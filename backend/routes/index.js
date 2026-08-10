import express from "express";
import { getProducts, getProductByHandle, createCheckout } from "../controllers/productController.js";
import { createDiscount, debugDiscountSchema, assignDiscountToCustomer } from "../controllers/discountController.js";
import { registerCustomer, findOrCreateCustomer, getLocalCustomers, getShopifyCustomers, findCustomerByOrder } from "../controllers/customerController.js";
import {
  redirectToAuth,
  authCallback,
  getAuthToken,
  setAuthToken,
} from "../controllers/authController.js";
import { assignStoreCreditToCustomer } from "../controllers/storeCreditController.js";

const router = express.Router();

router.get("/products", getProducts);
router.get("/products/:handle", getProductByHandle);
router.post("/checkout", createCheckout);
router.post("/create-discount", createDiscount);
router.post("/assign-discount-to-customer", assignDiscountToCustomer);
router.get("/debug-discount-schema", debugDiscountSchema);
router.post("/register-customer", registerCustomer);
router.post("/find-or-create-customer", findOrCreateCustomer);
router.post("/find-customer-by-order", findCustomerByOrder);
router.get("/customers", getLocalCustomers);
router.get("/shopify-customers", getShopifyCustomers);
router.post("/assign-store-credit-to-customer", assignStoreCreditToCustomer);
router.get("/auth", redirectToAuth);
router.get("/auth/callback", authCallback);
router.get("/auth/token", getAuthToken);
router.post("/auth/token", setAuthToken);

export default router;
