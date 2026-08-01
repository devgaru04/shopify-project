import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  shop: process.env.SHOP,
  storefrontAccessToken: process.env.STOREFRONT_ACCESS_TOKEN,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  scopes: process.env.SCOPES || "write_customers,read_customers,write_discounts",
  oauthRedirectUri: process.env.OAUTH_REDIRECT_URI || "http://localhost:4000/api/auth/callback",
  apiVersion: process.env.API_VERSION || "2024-10",
  adminAccessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || process.env.ADMIN_ACCESS_TOKEN || process.env.ADMIN_API_TOKEN || null,
};
