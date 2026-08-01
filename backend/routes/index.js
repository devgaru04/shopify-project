import express from "express";
import { getProducts, getProductByHandle, createCheckout } from "../controllers/productController.js";
import { createDiscount, debugDiscountSchema } from "../controllers/discountController.js";
import { registerCustomer } from "../controllers/customerController.js";
import {
  redirectToAuth,
  authCallback,
  getAuthToken,
  setAuthToken,
} from "../controllers/authController.js";

const router = express.Router();

router.get("/products", getProducts);
router.get("/products/:handle", getProductByHandle);
router.post("/checkout", createCheckout);
router.post("/create-discount", createDiscount);
router.get("/debug-discount-schema", debugDiscountSchema);
router.post("/register-customer", registerCustomer);
router.get("/auth", redirectToAuth);
router.get("/auth/callback", authCallback);
router.get("/auth/token", getAuthToken);
router.post("/auth/token", setAuthToken);

export default router;
