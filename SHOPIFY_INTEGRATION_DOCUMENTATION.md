# Shopify Proof-of-Concept Documentation

## Resumen del proyecto

Este proyecto es una prueba de concepto para validar flujos de Shopify con un backend en Express y un frontend en React/Vite.

- Backend: `backend/`
- Frontend: `frontend/src/App.jsx`
- Servicios Shopify: `backend/services/shopifyService.js`, `backend/services/storeCreditService.js`
- Configuración de ambiente: `backend/config/env.js`

El propósito del documento es mostrar los flujos implementados, los endpoints del backend, los servicios de Shopify usados y las variables de entorno necesarias.

---

## Variables de entorno usadas

Ubicación: `backend/config/env.js`

- `PORT`: puerto local del backend (por defecto `4000`).
- `SHOP`: nombre de la tienda Shopify, ejemplo `mi-tienda` para `mi-tienda.myshopify.com`.
- `STOREFRONT_ACCESS_TOKEN`: token para Storefront API.
- `CLIENT_ID`: API Key para OAuth/Admin.
- `CLIENT_SECRET`: API Secret Key para OAuth/Admin.
- `SCOPES`: permisos solicitados para OAuth. Por defecto `write_customers,read_customers,write_discounts`.
- `OAUTH_REDIRECT_URI`: URL de retorno de OAuth, por defecto `http://localhost:4000/api/auth/callback`.
- `API_VERSION`: versión de la API de Shopify, por defecto `2024-10`.
- `SHOPIFY_ADMIN_ACCESS_TOKEN`, `ADMIN_ACCESS_TOKEN` o `ADMIN_API_TOKEN`: token de Admin API para llamadas de backend.

---

## Conexión con Shopify

### `backend/services/shopifyService.js`

Este archivo contiene los wrappers para hacer requests GraphQL a Shopify.

- `shopifyFetch(query, variables)`: usa Storefront API con el header `X-Shopify-Storefront-Access-Token`.
  - URL: `https://{SHOP}.myshopify.com/api/{API_VERSION}/graphql.json`
  - Usado para: `getProducts`, `getProductByHandle`, `createCheckout`, `registerCustomer`.

- `adminFetch(query, variables)`: usa Admin API con el header `X-Shopify-Access-Token`.
  - URL: `https://{SHOP}.myshopify.com/admin/api/{API_VERSION}/graphql.json`
  - Usado para: clientes, órdenes, descuentos, store credit, metafields, comentarios.

- Token Admin API:
  - `loadAdminToken()`: carga token desde variables de entorno.
  - `setAdminToken(token)`: guarda token en memoria para el backend.
  - `getAdminToken()`: retorna token cargado.

- OAuth / token:
  - `oauthTokenRequest(body)`: realiza request a `https://{SHOP}.myshopify.com/admin/oauth/access_token`.
  - `exchangeCodeForToken(code)`: intercambia código OAuth por token.
  - `getTokenClientCredentials()`: intenta client credentials grant.
  - `getAuthUrl()`: arma URL de autorización OAuth.
  - `openAuthInBrowser(port)`: abre navegador para autenticación.

---

## Endpoints del backend

### Productos y carrito

- `GET /api/products`
  - Descripción: lista productos y variantes.
  - Shopify: Storefront API query `Products(first: 20)`.
  - Respuesta: arreglo de productos con `id`, `title`, `description`, `handle`, `priceRange`, `options`, `images`, `variants`.
  - Request example: `GET /api/products` (no body)
  - Response example:

```json
[
  {
    "id": "gid://shopify/Product/1234567890",
    "title": "Example Product",
    "handle": "example-product",
    "priceRange": { "min": "19.99", "max": "29.99" }
  }
]
```

- `GET /api/products/:handle`
  - Descripción: obtiene producto por handle.
  - Shopify: Storefront API query `ProductByHandle(handle: $handle)`.
  - Respuesta: objeto del producto con variantes e imágenes.
  - Request example: `GET /api/products/example-product`
  - Response example:

```json
{
  "id": "gid://shopify/Product/1234567890",
  "title": "Example Product",
  "handle": "example-product",
  "variants": [ { "id": "gid://shopify/ProductVariant/111", "price": "19.99" } ]
}
```

- `POST /api/checkout`
  - Descripción: crea carrito y genera `checkoutUrl`.
  - Request body:
    - `lines`: arreglo de `{ merchandiseId, quantity }`
    - `discountCode` (opcional)
  - Shopify: Storefront API mutation `CartCreate(input: CartInput!)`.
  - Respuesta: datos del carrito con `checkoutUrl`.
  - Request example:

```json
{
  "lines": [ { "merchandiseId": "gid://shopify/ProductVariant/111", "quantity": 1 } ],
  "discountCode": "SUMMER10"
}
```

  - Response example:

```json
{
  "checkoutUrl": "https://mi-tienda.myshopify.com/cart/111:1?discount=SUMMER10",
  "cartId": "gid://shopify/Cart/987654321"
}
```

### Clientes

- `POST /api/register-customer`
  - Descripción: registra un cliente en Shopify por email y password.
  - Request body:
    - `email`
    - `firstName`
    - `lastName`
    - `password`
  - Shopify: Storefront API mutation `customerCreate(input: CustomerCreateInput!)`.
  - Respuesta: `customer` con `id`, `email`, `firstName`, `lastName`.
  - Request example:

```json
{
  "email": "mauro@example.com",
  "firstName": "Mauro",
  "lastName": "Test",
  "password": "s3cr3tP@ss"
}
```

  - Response example:

```json
{
  "success": true,
  "customer": { "id": "gid://shopify/Customer/24832550928544", "email": "mauro@example.com", "firstName": "Mauro", "lastName": "Test" }
}
```

- `POST /api/find-or-create-customer`
  - Descripción: busca un cliente por email en Shopify (Admin API). Si no existe, lo crea.
  - Request body:
    - `email`
    - `firstName` (opcional)
    - `lastName` (opcional)
    - `password` (opcional)
  - Shopify: Admin API query `customers(first: 1, query: $query)` y mutation `customerCreate`.
  - Respuesta: `customer` con `id`, `email`, `firstName`, `lastName`.
  - Request example:

```json
{ "email": "mauro@example.com", "firstName": "Mauro", "lastName": "Test" }
```

  - Response example (found):

```json
{ "success": true, "customer": { "id": "gid://shopify/Customer/24832550928544", "email": "mauro@example.com" } }
```

  - Response example (created):

```json
{ "success": true, "created": true, "customer": { "id": "gid://shopify/Customer/999999999", "email": "mauro@example.com" } }
```

- `GET /api/shopify-customers?first=250`
  - Descripción: lista hasta `first` clientes de Shopify.
  - Shopify: Admin API query `customers(first: $first)`.
  - Respuesta: arreglo de clientes simplificado.
  - Request example: `GET /api/shopify-customers?first=50`
  - Response example:

```json
{ "customers": [ { "id": "gid://shopify/Customer/1", "email": "a@x.com" } ] }
```

- `GET /api/customers`
  - Descripción: lista clientes locales en memoria creados durante la sesión.
  - Respuesta: arreglo de clientes guardados en `localCustomers`.
  - Request example: `GET /api/customers`
  - Response example:

```json
[ { "id": "local-1", "email": "temp@local" } ]
```

- `POST /api/find-customer-by-order`
  - Descripción: busca una orden por número y devuelve datos de la orden + cliente.
  - Request body:
    - `orderNumber`
  - Shopify: Admin API query `orders(first: 1, query: $query)` con `name`.
  - Respuesta: `order` con campos `id`, `name`, `email`, `customer { id, email, firstName, lastName }`.
  - Request example:

```json
{ "orderNumber": "#1004" }
```

  - Response example:

```json
{
  "success": true,
  "order": {
    "id": "gid://shopify/Order/7839363432608",
    "name": "#1004",
    "email": "mauro1234@yopmail.com",
    "customer": {
      "id": "gid://shopify/Customer/24832550928544",
      "email": "mauro1234@yopmail.com",
      "firstName": "mauro",
      "lastName": "test"
    }
  }
}
```

### Descuentos

- `POST /api/create-discount`
  - Descripción: crea un descuento en Shopify.
  - Request body:
    - `code`
    - `title`
    - `type`: `percentage` o `fixed`
    - `value`
    - `minimumSubtotal` (opcional)
    - `usageLimit` (opcional)
    - `appliesOnEachItem` (opcional)
    - `productId` (opcional)
    - `tags` (opcional, cadena separada por comas)
    - `timelineComment` (opcional)
  - Shopify: Admin API mutation `discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount)`.
  - Respuesta: éxito con `discountCode` y datos de descuento.

- `POST /api/assign-discount-to-customer`
  - Descripción: crea un descuento y lo asigna a un cliente Shopify.
  - Request body:
    - `customerId` o `customerEmail`
    - `code`
    - `title`
    - `type`
    - `value`
    - `minimumSubtotal`
    - `usageLimit`
    - `productId`
    - `tags`
    - `timelineComment`
  - Lógica adicional:
    - Si se envía `customerEmail`, el backend acepta sólo valores tipo `gid://shopify/Customer/...` o devuelve error porque la resolución directa por email no está permitida en esta app sin scopes adicionales.
    - Si se envía `customerId` numérico, se normaliza a `gid://shopify/Customer/{id}`.
  - Shopify: Admin API `discountCodeBasicCreate`.
  - Comentarios de cronología:
    - Se intenta `commentEventCreate`.
    - Si Shopify no soporta esa mutación, se guarda como `metafieldsSet` en el descuento.
  - Motivo por el que puede no añadirse el comentario dentro del flujo de descuentos:
    - Shopify Admin GraphQL actualmente no expone una mutación que añada directamente comentarios de cronología (`commentEventCreate`) sobre recursos de tipo descuento/`DiscountCodeNode`. En muchos catálogos de la API la creación de eventos de comentario está limitada a recursos como `Order` u otros objetos que soportan eventos de cronología; los `Discount` no siempre son admitidos.
    - También puede requerirse un scope/permiso que no esté disponible para la app (aunque el permiso `write_discounts` permite crear descuentos, no garantiza soporte de mutaciones de comentario sobre el recurso).
    - Por eso el flujo está diseñado con un fallback que guarda la nota como un `metafield` en el recurso del descuento, preservando la información de la nota incluso cuando la mutación de comentario no está soportada.

  - Ejemplo de respuesta cuando se usa el fallback (nota guardada en `metafield`):

```json
{
  "success": true,
  "discountCode": "SJN11",
  "discount": {
    "codeDiscountNode": {
      "id": "gid://shopify/DiscountCodeNode/1729154777248",
      "codeDiscount": {
        "title": "ADS",
        "status": "ACTIVE",
        "startsAt": "2026-08-11T19:37:16Z",
        "createdAt": "2026-08-11T19:37:16Z"
      }
    },
    "userErrors": []
  },
  "warning": "El descuento se creó y se guardó la nota como metafield porque la mutación de comentario no está disponible para descuentos."
}
```

  - Recomendaciones:
    - Revisar periódicamente la documentación de la Admin API por si Shopify añade soporte para `commentEventCreate` sobre `Discount` u ofrece una mutación equivalente.
    - Conservar la nota en `metafields` con un `namespace` y `key` claros (por ejemplo `admin_notes.note`) para facilitar búsquedas y migraciones si en el futuro se soporta un timeline nativo.
  - Request example (`/api/create-discount`):

```json
{
  "code": "VIP20OFF",
  "title": "20% for VIP",
  "type": "percentage",
  "value": 0.2,
  "tags": "vip,newsletter",
  "timelineComment": "Assigned via admin tool"
}
```

  - Response example (create):

```json
{ "success": true, "discount": { "code": "VIP20OFF", "id": "gid://shopify/DiscountCodeNode/1057856785" } }
```

  - Request example (`/api/assign-discount-to-customer`):

```json
{
  "customerId": "gid://shopify/Customer/24832550928544",
  "code": "VIP20OFF",
  "title": "20% for VIP",
  "type": "percentage",
  "value": 0.2
}
```

  - Response example (assign):

```json
{ "success": true, "assigned": true, "discount": { "code": "VIP20OFF" }, "customerId": "gid://shopify/Customer/24832550928544" }
```

### Créditos de tienda

- `POST /api/assign-store-credit-to-customer`
  - Descripción: asigna crédito de tienda a un cliente Shopify.
  - Request body:
    - `customerId`
    - `amount`
    - `currency` (opcional, default `USD`)
  - Shopify: Admin API mutation `storeCreditAccountCredit(id: $id, creditInput: $creditInput)`.
  - Respuesta: información de la transacción y saldo.
  - Request example:

```json
{ "customerId": "gid://shopify/Customer/24832550928544", "amount": "49.99", "currency": "USD" }
```

  - Response example:

```json
{
  "success": true,
  "transaction": {
    "amount": { "amount": "49.99", "currencyCode": "USD" },
    "account": { "id": "gid://shopify/StoreCreditAccount/316863792", "balance": { "amount": "61.10", "currencyCode": "USD" } }
  }
}
```

### Autenticación Admin API

- `GET /api/auth`
  - Redirige al flujo OAuth de Shopify para obtener permiso.

- `GET /api/auth/callback`
  - Recibe el `code` de Shopify y obtiene el `access_token`.
  - Muestra el token en un HTML simple.

- `GET /api/auth/token`
  - Retorna el token de Admin API cargado en memoria.

- `POST /api/auth/token`
  - Permite configurar el token manualmente en el backend.
  - Request body: `{ access_token }`.
  - Request/Response examples:

`GET /api/auth` — redirección al OAuth de Shopify (sin body).

`GET /api/auth/token` — Response example:

```json
{ "access_token": "shpat_XXXX..." }
```

`POST /api/auth/token` — Request example:

```json
{ "access_token": "shpat_XXXX..." }
```

`POST /api/auth/token` — Response example:

```json
{ "success": true, "message": "Admin token saved" }
```

---

## Flujos implementados

### 1. Listado de productos

Frontend:
- `GET /api/products`
- Muestra productos y variantes.
- Usa `products` en `App.jsx`.

Backend:
- `backend/controllers/productController.js` -> `getProducts`
- Shopify Storefront API `Products(first: 20)`.

### 2. Listado de clientes

Frontend:
- `GET /api/shopify-customers?first=250`
- Muestra clientes de Shopify.

Backend:
- `backend/controllers/customerController.js` -> `getShopifyCustomers`
- Shopify Admin API `customers(first: $first)`.

### 3. Registrar/Crear a un cliente en Shopify

Frontend:
- `POST /api/register-customer`
- Envia `{ email, firstName, lastName, password }`.

Backend:
- `backend/controllers/customerController.js` -> `registerCustomer`
- Shopify Storefront API mutation `customerCreate(input: CustomerCreateInput!)`.
- Shopify docs: `customerCreate` mutation example https://shopify.dev/docs/api/storefront/latest/mutations/customercreate

### 4. Registrar/Crear un descuento

Frontend:
- `POST /api/create-discount`
- Envia el formulario de descuento con etiquetas y comentario.

Backend:
- `backend/controllers/discountController.js` -> `createDiscount`
- `backend/controllers/discountController.js` -> `createDiscountCode(payload)`
- Shopify Admin API mutation `discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount)`.

Notas:
- Las `tags` se convierten de string separadas por comas a arreglo.
- `timelineComment` se intenta guardar como comentario de cronología.
- Si Shopify no soporta `commentEventCreate` para descuentos, se usa `metafieldsSet` como fallback.

### 5. Asignar un descuento a un cliente

Frontend:
- `POST /api/assign-discount-to-customer`
- El formulario puede:
  - seleccionar un cliente existente
  - o usar el email encontrado por orden

Backend:
- `backend/controllers/discountController.js` -> `assignDiscountToCustomer`
- Internamente usa la misma creación de descuento con `customerId`.

Flujo separado:
- Si `customerId` ya existe, se usa directamente.
- Si no existe y se provee `customerEmail`, el backend intenta normalizarlo a un GID válido.
- Si no se aporta `customerId` válido, devuelve error.

### 6. Buscar a un cliente por orden de compra

Frontend:
- `POST /api/find-customer-by-order`
- Envia `{ orderNumber }`.

Backend:
- `backend/controllers/customerController.js` -> `findCustomerByOrder`
- Shopify Admin API query `orders(first: 1, query: $query)`.
- Retorna la orden y sus datos de cliente.
- Shopify docs: Admin API `order` query example https://shopify.dev/docs/api/admin-graphql/latest/queries/order

Notas:
- Si la orden tiene cliente Shopify, retorna `order.customer`.
- Si no, usa el correo de la orden.
- En frontend, el flujo carga el email encontrado en el formulario de asignación y abre el popup de descuento.

### 7. Crear/asignar un crédito de tienda

Frontend:
- `POST /api/assign-store-credit-to-customer`
- Envia `{ customerId, amount, currency }`.

Backend:
- `backend/controllers/storeCreditController.js` -> `assignStoreCreditToCustomer`
- `backend/services/storeCreditService.js` -> `creditCustomerStoreBalance`
- Shopify Admin API mutation `storeCreditAccountCredit(id: $id, creditInput: $creditInput)`.

---

## Comentarios técnicos clave

### `backend/services/shopifyService.js`

- `requestJson(url, options, body)`: realiza la llamada HTTPS.
- `shopifyFetch(...)`: Storefront API con token `STOREFRONT_ACCESS_TOKEN`.
- `adminFetch(...)`: Admin API con `SHOPIFY_ADMIN_ACCESS_TOKEN` o token cargado en memoria.
- `getAuthUrl()`: construye la URL OAuth con los scopes.
- `exchangeCodeForToken(code)`: obtiene el token de Admin API.

### `backend/controllers/customerController.js`

- `localCustomers`: cache temporal de clientes creados o encontrados en la sesión.
- `normalizeCustomer(customer)`: normaliza datos de cliente para el frontend.
- `searchCustomerByEmail(email)`: busca cliente usando varios query forms.
- `searchCustomerByOrder(orderNumber)`: busca `orders` por nombre de orden.
- `findOrCreateCustomer(...)`: reutiliza cliente existente o crea uno nuevo.

### `backend/controllers/discountController.js`

- `createDiscountCode(payload)`: arma el payload `DiscountCodeBasicInput`.
- `saveDiscountMetafieldNote(resourceId, comment)`: guarda notas en metafield si `commentEventCreate` falla.
- `addTimelineComment(resourceId, comment)`: intenta crear comentario nativo y cae a metafield si no está soportado.
- `assignDiscountToCustomer(...)`: asigna descuento usando `customerId` o GID de cliente.

### Frontend `frontend/src/App.jsx`

- `useEffect(...)`: carga productos y clientes al iniciar.
- `handleCreateDiscount(e)`: crea descuenta con datos del formulario.
- `handleRegister(e)`: registra cliente en Shopify.
- `handleSearchOrder(e)`: busca orden y muestra cliente encontrado.
- `handleUseOrderCustomer()`: toma los datos de la orden y abre el formulario de asignación.
- `handleAssignDiscount(e)`: asigna descuento al cliente existente o a un cliente creado por email.
- `handleAssignStoreCredit(e)`: asigna crédito de tienda a un cliente.

---

## Referencias oficiales de Shopify

- Ejemplo oficial de creación de cliente (Storefront API): https://shopify.dev/docs/api/storefront/latest/mutations/customercreate
- Flujo de búsqueda de orden/cliente en Admin API: https://shopify.dev/docs/api/admin-graphql/latest/queries/order
- Flujo de creación de descuento en Admin API: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountcodebasiccreate
- Flujo de store credit en Admin API: https://shopify.dev/docs/api/admin-graphql/latest/mutations/storecreditaccountcredit

## Observaciones importantes

- El proyecto no es un producto final, es una prueba de concepto de flujos Shopify.
- El flujo de comentarios de cronología en descuentos depende de soporte de la API. Actualmente se intenta con `commentEventCreate`; si no es compatible, se guarda como `metafield`.
- Algunos flujos de clientes usan Admin API y requieren token con permisos adecuados.
- El endpoint `find-or-create-customer` busca primero por email y luego crea el cliente si no existe.

---

## Ubicaciones principales de código

- `backend/routes/index.js`: define las rutas de API.
- `backend/controllers/productController.js`: productos y checkout.
- `backend/controllers/customerController.js`: clientes y búsqueda por orden.
- `backend/controllers/discountController.js`: descuentos y asignaciones.
- `backend/controllers/storeCreditController.js`: crédito de tienda.
- `backend/controllers/authController.js`: OAuth y token Admin API.
- `backend/services/shopifyService.js`: llamadas a Shopify.
- `backend/services/storeCreditService.js`: store credit mutation.
- `backend/config/env.js`: variables de entorno.
- `frontend/src/App.jsx`: lógica de UI, fetch y formularios.

---

## Recomendación para proyecto de producción

- En un proyecto real, separar servicio de Shopify en un módulo independiente.
- Guardar tokens de Admin API de forma segura, no solo en memoria.
- Añadir validación y manejo de errores más robusto en frontend y backend.
- Revisar permisos de OAuth para los scopes necesarios.
- Evitar usar `customerEmail` como identificador directo sin una resolución segura.
