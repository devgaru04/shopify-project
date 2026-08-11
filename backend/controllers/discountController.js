import { adminFetch } from "../services/shopifyService.js";

// Crea el payload de descuento y ejecuta la mutación de Shopify.
// Retorna el resultado básico de la creación del descuento.
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
    tags,
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

  if (tags && typeof tags === "string") {
    const parsedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (parsedTags.length > 0) {
      variables.basicCodeDiscount.tags = parsedTags;
    }
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

// Guarda un comentario en un metafield del recurso cuando el comentario nativo no está disponible.
async function saveDiscountMetafieldNote(resourceId, comment) {
  if (!resourceId || !comment || comment.trim() === "") {
    return { success: true };
  }

  const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        ownerId: resourceId,
        namespace: "app",
        key: "timeline_comment",
        type: "multi_line_text_field",
        value: comment.trim(),
      },
    ],
  };

  const data = await adminFetch(mutation, variables);

  if (data.metafieldsSet.userErrors.length) {
    return {
      success: false,
      errors: data.metafieldsSet.userErrors,
    };
  }

  return { success: true };
}

// Intenta añadir un commentEvent en Shopify para el recurso.
// Si la API no soporta este tipo de comentario, hace fallback a un metafield.
async function addTimelineComment(resourceId, comment) {
  if (!resourceId || !comment || comment.trim() === "") {
    return { success: true };
  }

  const mutation = `
    mutation commentEventCreate($input: CommentEventCreateInput!) {
      commentEventCreate(input: $input) {
        commentEvent {
          id
          rawMessage
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = {
    subjectId: resourceId,
    body: comment.trim(),
  };

  try {
    const data = await adminFetch(mutation, { input });

    if (data.commentEventCreate.userErrors.length) {
      return {
        success: false,
        errors: data.commentEventCreate.userErrors,
      };
    }

    return { success: true };
  } catch (error) {
    const lower = error.message.toLowerCase();
    const unsupported =
      lower.includes("unknown field") ||
      lower.includes("commenteventcreate") ||
      lower.includes("commenteventcreateinput") ||
      lower.includes("cannot query field") ||
      lower.includes("field \"commenteventcreate\" not found");

    if (unsupported) {
      const fallbackResult = await saveDiscountMetafieldNote(resourceId, comment);
      if (fallbackResult.success) {
        return { success: true, fallback: true };
      }
      return fallbackResult;
    }

    return {
      success: false,
      unsupported,
      error: error.message,
    };
  }
}

export async function createDiscount(req, res) {
  try {
    const { tags, timelineComment, ...payload } = req.body;
    const result = await createDiscountCode({ ...payload, tags });

    if (!result.success) {
      return res.status(400).json(result.errors);
    }

    if (timelineComment && timelineComment.trim()) {
      const createdDiscountNodeId = result.discount?.codeDiscountNode?.id;
      if (createdDiscountNodeId) {
        const commentResult = await addTimelineComment(createdDiscountNodeId, timelineComment);
        if (!commentResult.success) {
          if (commentResult.unsupported) {
            console.warn("Timeline comment unsupported:", commentResult.error);
            return res.json({
              ...result,
              warning: "El descuento se creó, pero Shopify no admite comentarios de cronología sobre descuentos. La nota se guardó como metafield del descuento.",
            });
          }
          return res.status(400).json(commentResult.errors);
        }
        if (commentResult.fallback) {
          return res.json({
            ...result,
            warning: "El descuento se creó y se guardó la nota como metafield porque la mutación de comentario no está disponible para descuentos.",
          });
        }
      }
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

export async function assignDiscountToCustomer(req, res) {
  try {
    const { customerEmail, customerId, tags, timelineComment, ...payload } = req.body;

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

    const result = await createDiscountCode({ ...payload, customerId: resolvedCustomerId, tags });

    if (!result.success) {
      return res.status(400).json(result.errors);
    }

    if (timelineComment && timelineComment.trim()) {
      const createdDiscountNodeId = result.discount?.codeDiscountNode?.id;
      if (createdDiscountNodeId) {
        const commentResult = await addTimelineComment(createdDiscountNodeId, timelineComment);
        if (!commentResult.success) {
          if (commentResult.unsupported) {
            console.warn("Timeline comment unsupported:", commentResult.error);
            return res.json({
              ...result,
              customerEmail,
              customerId: resolvedCustomerId,
              warning: "El descuento se creó, pero Shopify no admite comentarios de cronología sobre descuentos. La nota se guardó como metafield del descuento.",
            });
          }
          return res.status(400).json(commentResult.errors);
        }
        if (commentResult.fallback) {
          return res.json({
            ...result,
            customerEmail,
            customerId: resolvedCustomerId,
            warning: "El descuento se creó y se guardó la nota como metafield porque la mutación de comentario no está disponible para descuentos.",
          });
        }
      }
    }

    res.json({ ...result, customerEmail, customerId: resolvedCustomerId });
  } catch (error) {
    console.error("Error /api/assign-discount-to-customer:", error.message);
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
