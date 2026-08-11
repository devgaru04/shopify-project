import { shopifyFetch } from "../services/shopifyService.js";

// Controlador para consultar productos desde Shopify Storefront.
export async function getProducts(req, res) {
  try {
    const query = `
      query Products($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              description
              handle
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              options {
                name
                values
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    price {
                      amount
                      currencyCode
                    }
                    selectedOptions {
                      name
                      value
                    }
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await shopifyFetch(query, { first: 20 });
    const products = data.products.edges.map((edge) => edge.node);
    res.json(products);
  } catch (error) {
    console.error("Error /api/products:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function getProductByHandle(req, res) {
  try {
    const query = `
      query ProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          descriptionHtml
          handle
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 5) {
            edges {
              node {
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                availableForSale
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    const data = await shopifyFetch(query, { handle: req.params.handle });
    if (!data.productByHandle) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(data.productByHandle);
  } catch (error) {
    console.error("Error /api/products/:handle:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function createCheckout(req, res) {
  try {
    const { lines, discountCode } = req.body;
    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }

    const normalizedDiscountCode = typeof discountCode === "string" ? discountCode.trim() : "";

    const query = `
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        title
                        images(first: 1) {
                          edges {
                            node {
                              url
                              altText
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            cost {
              totalAmount {
                amount
                currencyCode
              }
              subtotalAmount {
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

    const data = await shopifyFetch(query, {
      input: {
        lines: lines.map((line) => ({
          merchandiseId: line.merchandiseId,
          quantity: line.quantity,
        })),
        discountCodes: normalizedDiscountCode ? [normalizedDiscountCode] : undefined,
      },
    });

    if (!data || !data.cartCreate) {
      return res.status(500).json({ error: "Respuesta inválida de Shopify" });
    }

    if (data.cartCreate.userErrors && data.cartCreate.userErrors.length > 0) {
      return res.status(400).json({ error: data.cartCreate.userErrors[0].message });
    }

    if (!data.cartCreate.cart || !data.cartCreate.cart.checkoutUrl) {
      return res.status(500).json({ error: "No se pudo crear el carrito en Shopify" });
    }

    let cart = data.cartCreate.cart;

    if (normalizedDiscountCode) {
      const checkoutUrl = new URL(cart.checkoutUrl);
      checkoutUrl.searchParams.set("discount", normalizedDiscountCode);
      checkoutUrl.searchParams.set("discount_code", normalizedDiscountCode);
      cart = {
        ...cart,
        checkoutUrl: checkoutUrl.toString(),
      };
    }

    res.json(cart);
  } catch (error) {
    console.error("Error /api/checkout:", error.message);
    res.status(500).json({ error: error.message });
  }
}
