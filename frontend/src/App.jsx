import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [selectedVariants, setSelectedVariants] = useState({});
  const [adminMsg, setAdminMsg] = useState(null);
  const [adminLoading, setAdminLoading] = useState({ discount: false, register: false, assign: false, storeCredit: false });
  const [registerForm, setRegisterForm] = useState({ email: "", firstName: "", lastName: "", password: "" });
  const [discountForm, setDiscountForm] = useState({
    code: "",
    title: "",
    type: "percentage",
    value: "",
    minimumSubtotal: "",
    usageLimit: "",
    appliesOnEachItem: false,
    tags: "",
    timelineComment: "",
  });
  const [assignForm, setAssignForm] = useState({
    customerEmail: "",
    customerId: "",
    code: "",
    title: "",
    type: "percentage",
    value: "",
    minimumSubtotal: "",
    usageLimit: "",
    productId: "",
    tags: "",
    timelineComment: "",
    readOnlyEmail: false,
  });
  const [assignCustomerMode, setAssignCustomerMode] = useState("select");
  const [orderSearchForm, setOrderSearchForm] = useState({ orderNumber: "" });
  const [orderSearchResult, setOrderSearchResult] = useState(null);
  const [orderSearchError, setOrderSearchError] = useState("");
  const [orderSearchLoading, setOrderSearchLoading] = useState(false);

  const [createdCustomer, setCreatedCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [popupOpen, setPopupOpen] = useState({ register: false, discount: false, assign: false, storeCredit: false, orderSearch: false });
  const [storeCreditForm, setStoreCreditForm] = useState({ customerId: "", amount: "", currency: "USD" });

  async function refreshCustomers() {
    try {
      const res = await fetch("/api/shopify-customers?first=250");
      if (!res.ok) return;
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
    }
  }

  function handlePopupToggle(name, isOpen) {
    setPopupOpen((prev) => ({ ...prev, [name]: isOpen }));
  }

  useEffect(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar productos");
        return res.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    refreshCustomers();
  }, []);

  function findSelectedVariant(product) {
    const selections = selectedVariants[product.id];
    const availableVariants = (product.variants?.edges || [])
      .map(({ node }) => node)
      .filter((node) => node.availableForSale);

    if (availableVariants.length === 0) return null;

    if (!selections || Object.keys(selections).length === 0) {
      return availableVariants.length === 1 ? availableVariants[0] : null;
    }

    const optionCount = product.options?.length || 0;
    const selectedCount = Object.keys(selections).length;

    if (selectedCount < optionCount) {
      const partialMatches = availableVariants.filter((variant) =>
        Object.entries(selections).every(([name, value]) =>
          variant.selectedOptions.some((opt) => opt.name === name && opt.value === value)
        )
      );

      if (partialMatches.length === 1) return partialMatches[0];
      return null;
    }

    return availableVariants.find((variant) =>
      variant.selectedOptions.every((opt) => selections[opt.name] === opt.value)
    ) || null;
  }

  function handleOptionSelect(productId, optionName, value) {
    setSelectedVariants((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [optionName]: value },
    }));
  }

  function addToCart(product) {
    const variant = findSelectedVariant(product);
    if (!variant) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.variantId === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          title: product.title,
          variantTitle: variant.title,
          price: variant.price.amount,
          currency: variant.price.currencyCode,
          image: variant.image?.url || product.images.edges[0]?.node?.url || null,
          quantity: 1,
        },
      ];
    });
    setCartOpen(true);
  }

  function removeFromCart(variantId) {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  }

  function copyDiscountCode(code) {
    if (!code) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
    }
    setAdminMsg((prev) => (prev && prev.code === code ? { ...prev, copied: true } : prev));
  }

  function updateQuantity(variantId, delta) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountCode,
          lines: cart.map((item) => ({
            merchandiseId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Error al crear el checkout");
      }
      if (!res.ok) throw new Error(data.error || "Error al crear el checkout");
      if (!data.checkoutUrl) throw new Error("El checkout no tiene URL de redirección");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setCheckoutError(err.message);
      setCheckingOut(false);
    }
  }

  async function handleCreateDiscount(e) {
    e.preventDefault();
    setAdminMsg(null);
    setAdminLoading((prev) => ({ ...prev, discount: true }));
    try {
      const res = await fetch("/api/create-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discountForm),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!res.ok) throw new Error(data?.error || data?.[0]?.message || "Error en la operación");
      const createdCode = discountForm.code.trim().toUpperCase();
      setAdminMsg({
        type: "success",
        text: `Tu código de descuento es ${createdCode}. Copia y úsalo en el carrito.`,
        code: createdCode,
      });
      setDiscountForm({ code: "", title: "", type: "percentage", value: "", minimumSubtotal: "", usageLimit: "", appliesOnEachItem: false, tags: "", timelineComment: "" });
    } catch (err) {
      setAdminMsg({ type: "error", text: err.message });
    } finally {
      setAdminLoading((prev) => ({ ...prev, discount: false }));
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAdminMsg(null);
    setAdminLoading((prev) => ({ ...prev, register: true }));
    try {
      const res = await fetch("/api/register-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!res.ok) throw new Error(data?.error || "Error al registrar");
      setAdminMsg({ type: "success", text: `Cliente ${data.customer.email} registrado con éxito` });
      setCreatedCustomer(data.customer);
      setRegisterForm({ email: "", firstName: "", lastName: "", password: "" });
      await refreshCustomers();
    } catch (err) {
      setAdminMsg({ type: "error", text: err.message });
    } finally {
      setAdminLoading((prev) => ({ ...prev, register: false }));
    }
  }

  async function handleSearchOrder(e) {
    e.preventDefault();
    setOrderSearchError("");
    setOrderSearchResult(null);
    setOrderSearchLoading(true);
    try {
      const res = await fetch("/api/find-customer-by-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderSearchForm.orderNumber }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!res.ok) throw new Error(data?.error || "No se encontró la orden");
      setOrderSearchResult(data.order || null);
    } catch (err) {
      setOrderSearchError(err.message);
    } finally {
      setOrderSearchLoading(false);
    }
  }

  function handleUseOrderCustomer() {
    if (!orderSearchResult) return;

    const customer = orderSearchResult.customer;
    const customerEmail = customer?.email || orderSearchResult.email || "";

    setAssignCustomerMode("email");
    setAssignForm((prev) => ({
      ...prev,
      customerId: "",
      customerEmail,
      readOnlyEmail: true,
    }));
    setPopupOpen((prev) => ({ ...prev, orderSearch: false, assign: true }));
    setAdminMsg({ type: "success", text: "Datos cargados desde la orden. Completa el cupón para asignarlo." });
  }

  async function handleAssignDiscount(e) {
    e.preventDefault();
    setAdminMsg(null);
    setAdminLoading((prev) => ({ ...prev, assign: true }));
    try {
      let resolvedCustomerId = assignForm.customerId?.trim();
      let resolvedCustomerEmail = assignForm.customerEmail?.trim();

      if (assignCustomerMode === "email") {
        if (!resolvedCustomerEmail) {
          throw new Error("Ingresa el email del cliente para asignar el descuento");
        }

        const customerRes = await fetch("/api/find-or-create-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: resolvedCustomerEmail,
            firstName: "Cliente",
            lastName: "Creado",
            password: "123456",
          }),
        });

        const text = await customerRes.text();
        let customerData;
        try { customerData = JSON.parse(text); } catch { customerData = null; }

        if (!customerRes.ok) {
          throw new Error(customerData?.error || customerData?.message || "Error al buscar o crear el cliente");
        }

        resolvedCustomerId = customerData?.customer?.id;
        resolvedCustomerEmail = customerData?.customer?.email || resolvedCustomerEmail;
        if (!resolvedCustomerId) {
          throw new Error("No se pudo obtener el ID del cliente");
        }
      }

      if (!resolvedCustomerId) {
        throw new Error("Selecciona un cliente guardado o ingresa un email válido");
      }

      const selectedCustomer = customers.find((customer) => customer.id === resolvedCustomerId);

      const payload = {
        ...assignForm,
        customerEmail: selectedCustomer?.email || resolvedCustomerEmail || "",
        customerId: resolvedCustomerId,
      };

      const res = await fetch("/api/assign-discount-to-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!res.ok) throw new Error(data?.error || data?.[0]?.message || "Error al asignar el descuento");

      setAdminMsg({
        type: "success",
        text: `Cupón ${data.discountCode} asignado a ${selectedCustomer?.email || resolvedCustomerEmail || resolvedCustomerId}`,
      });
      setAssignForm({
        customerEmail: "",
        customerId: "",
        code: "",
        title: "",
        type: "percentage",
        value: "",
        minimumSubtotal: "",
        usageLimit: "",
        productId: "",
        tags: "",
        timelineComment: "",
        readOnlyEmail: false,
      });
      setAssignCustomerMode("select");
      await refreshCustomers();
    } catch (err) {
      setAdminMsg({ type: "error", text: err.message });
    } finally {
      setAdminLoading((prev) => ({ ...prev, assign: false }));
    }
  }

  async function handleAssignStoreCredit(e) {
    e.preventDefault();
    setAdminMsg(null);
    setAdminLoading((prev) => ({ ...prev, storeCredit: true }));
    try {
      const customerId = storeCreditForm.customerId?.trim();
      const amount = Number(storeCreditForm.amount);
      if (!customerId) {
        throw new Error("Selecciona un cliente guardado para asignar el crédito");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Ingresa un monto válido mayor a cero");
      }

      const res = await fetch("/api/assign-store-credit-to-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          amount,
          currency: storeCreditForm.currency,
        }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!res.ok) throw new Error(data?.error || "Error al asignar el crédito de tienda");
      setAdminMsg({ type: "success", text: `Crédito de tienda asignado correctamente al cliente seleccionado` });
      setStoreCreditForm({ customerId: "", amount: "", currency: "USD" });
      await refreshCustomers();
    } catch (err) {
      setAdminMsg({ type: "error", text: err.message });
    } finally {
      setAdminLoading((prev) => ({ ...prev, storeCredit: false }));
    }
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );
  const customerCount = customers.length;

  if (loading) return <div className="loader">Cargando productos...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="app">
      <header className="header">
        <h1>Capillus Store</h1>
        <p>Productos disponibles</p>
        <div className="admin-actions">
          <details
            className="register-form-details"
            open={popupOpen.register}
            onToggle={(e) => handlePopupToggle("register", e.currentTarget.open)}
          >
            <summary className="admin-btn">Registrarse como Cliente</summary>
            <form className="register-form" onSubmit={handleRegister}>
              <button
                type="button"
                className="popup-close-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePopupToggle("register", false);
                }}
              >
                ✕
              </button>
              <input
                type="email"
                placeholder="Email *"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Nombre"
                value={registerForm.firstName}
                onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Apellido"
                value={registerForm.lastName}
                onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
              />
              <input
                type="password"
                placeholder="Contraseña *"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                required
              />
              <button type="submit" disabled={adminLoading.register}>
                {adminLoading.register ? "Registrando..." : "Crear Cuenta"}
              </button>
            </form>
          </details>
          <details
            className="register-form-details"
            open={popupOpen.discount}
            onToggle={(e) => handlePopupToggle("discount", e.currentTarget.open)}
          >
            <summary className="admin-btn">Crear Cupón de Descuento</summary>
            <form className="register-form discount-form" onSubmit={handleCreateDiscount}>
              <button
                type="button"
                className="popup-close-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePopupToggle("discount", false);
                }}
              >
                ✕
              </button>
              <input
                type="text"
                placeholder="Código del cupón *"
                value={discountForm.code}
                onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Título *"
                value={discountForm.title}
                onChange={(e) => setDiscountForm({ ...discountForm, title: e.target.value })}
                required
              />
              <select
                value={discountForm.type}
                onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value })}
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo ($)</option>
              </select>
              <input
                type="number"
                step="any"
                min="0"
                placeholder={discountForm.type === "percentage" ? "Porcentaje * (ej: 10)" : "Monto * (ej: 50.00)"}
                value={discountForm.value}
                onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                required
              />
              {discountForm.type === "fixed" && (
                <label className="discount-checkbox">
                  <input
                    type="checkbox"
                    checked={discountForm.appliesOnEachItem}
                    onChange={(e) => setDiscountForm({ ...discountForm, appliesOnEachItem: e.target.checked })}
                  />
                  Aplicar en cada ítem
                </label>
              )}
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Monto mínimo de pedido (opcional)"
                value={discountForm.minimumSubtotal}
                onChange={(e) => setDiscountForm({ ...discountForm, minimumSubtotal: e.target.value })}
              />
              <input
                type="number"
                min="1"
                placeholder="Límite de usos (opcional)"
                value={discountForm.usageLimit}
                onChange={(e) => setDiscountForm({ ...discountForm, usageLimit: e.target.value })}
              />
              <input
                type="text"
                placeholder="Etiquetas (separadas por comas)"
                value={discountForm.tags}
                onChange={(e) => setDiscountForm({ ...discountForm, tags: e.target.value })}
              />
              <textarea
                placeholder="Comentario de cronología (opcional)"
                rows="2"
                value={discountForm.timelineComment}
                onChange={(e) => setDiscountForm({ ...discountForm, timelineComment: e.target.value })}
              />
              <button type="submit" disabled={adminLoading.discount}>
                {adminLoading.discount ? "Generando..." : "Crear Cupón"}
              </button>
            </form>
          </details>
          <details
            className="register-form-details"
            open={popupOpen.storeCredit}
            onToggle={(e) => handlePopupToggle("storeCredit", e.currentTarget.open)}
          >
            <summary className="admin-btn">Crédito de Tienda</summary>
            <form className="register-form discount-form" onSubmit={handleAssignStoreCredit}>
              <button
                type="button"
                className="popup-close-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePopupToggle("storeCredit", false);
                }}
              >
                ✕
              </button>
              <select
                value={storeCreditForm.customerId}
                onChange={(e) => setStoreCreditForm({ ...storeCreditForm, customerId: e.target.value })}
              >
                <option value="">Selecciona un cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.email || customer.firstName || customer.lastName || customer.id}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Monto del crédito *"
                value={storeCreditForm.amount}
                onChange={(e) => setStoreCreditForm({ ...storeCreditForm, amount: e.target.value })}
                required
              />
              <select
                value={storeCreditForm.currency}
                onChange={(e) => setStoreCreditForm({ ...storeCreditForm, currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="COP">COP</option>
              </select>
              <button type="submit" disabled={adminLoading.storeCredit}>
                {adminLoading.storeCredit ? "Asignando..." : "Asignar Crédito"}
              </button>
            </form>
          </details>
          <details
            className="register-form-details"
            open={popupOpen.assign}
            onToggle={(e) => handlePopupToggle("assign", e.currentTarget.open)}
          >
            <summary className="admin-btn">Asignar Cupón a Cliente</summary>
            <form className="register-form discount-form" onSubmit={handleAssignDiscount}>
              <button
                type="button"
                className="popup-close-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePopupToggle("assign", false);
                }}
              >
                ✕
              </button>
              <div className="assign-mode-group">
                <button
                  type="button"
                  className={`assign-mode-btn ${assignCustomerMode === "select" ? "active" : ""}`}
                  onClick={() => {
                    setAssignCustomerMode("select");
                    setAssignForm({ ...assignForm, customerEmail: "", readOnlyEmail: false });
                  }}
                >
                  Seleccionar cliente
                </button>
                <button
                  type="button"
                  className={`assign-mode-btn ${assignCustomerMode === "email" ? "active" : ""}`}
                  onClick={() => {
                    setAssignCustomerMode("email");
                    setAssignForm({ ...assignForm, customerId: "", readOnlyEmail: false });
                  }}
                >
                  Ingresar cliente
                </button>
              </div>
              {assignCustomerMode === "select" ? (
                <>
                  <select
                    value={assignForm.customerId}
                    onChange={(e) => setAssignForm({ ...assignForm, customerId: e.target.value })}
                  >
                    <option value="">Selecciona un cliente guardado</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.email || customer.firstName || customer.lastName ? `${customer.email || "Sin email"}` : customer.id}
                      </option>
                    ))}
                  </select>
                  <p className="helper-text">Selecciona un cliente guardado para asignar el descuento.</p>
                </>
              ) : (
                <>
                  <input
                    type="email"
                    placeholder="Email del cliente *"
                    value={assignForm.customerEmail}
                    onChange={(e) => setAssignForm({ ...assignForm, customerEmail: e.target.value })}
                    required
                    disabled={assignForm.readOnlyEmail}
                  />
                  <p className="helper-text">
                    {assignForm.readOnlyEmail
                      ? "El email viene de la orden y no puede editarse."
                      : "Ingresa el email del cliente. Si no existe, se creará automáticamente."}
                  </p>
                </>
              )}
              <input
                type="text"
                placeholder="Código del cupón *"
                value={assignForm.code}
                onChange={(e) => setAssignForm({ ...assignForm, code: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Título *"
                value={assignForm.title}
                onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                required
              />
              <select
                value={assignForm.type}
                onChange={(e) => setAssignForm({ ...assignForm, type: e.target.value })}
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo ($)</option>
              </select>
              <input
                type="number"
                step="any"
                min="0"
                placeholder={assignForm.type === "percentage" ? "Porcentaje * (ej: 20)" : "Monto * (ej: 50.00)"}
                value={assignForm.value}
                onChange={(e) => setAssignForm({ ...assignForm, value: e.target.value })}
                required
              />
              <select
                value={assignForm.productId}
                onChange={(e) => setAssignForm({ ...assignForm, productId: e.target.value })}
              >
                <option value="">Sin producto específico</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Monto mínimo de pedido (opcional)"
                value={assignForm.minimumSubtotal}
                onChange={(e) => setAssignForm({ ...assignForm, minimumSubtotal: e.target.value })}
              />
              <input
                type="number"
                min="1"
                placeholder="Límite de usos (opcional)"
                value={assignForm.usageLimit}
                onChange={(e) => setAssignForm({ ...assignForm, usageLimit: e.target.value })}
              />
              <input
                type="text"
                placeholder="Etiquetas (separadas por comas)"
                value={assignForm.tags}
                onChange={(e) => setAssignForm({ ...assignForm, tags: e.target.value })}
              />
              <textarea
                placeholder="Comentario de cronología (opcional)"
                rows="2"
                value={assignForm.timelineComment}
                onChange={(e) => setAssignForm({ ...assignForm, timelineComment: e.target.value })}
              />
              <button type="submit" disabled={adminLoading.assign}>
                {adminLoading.assign ? "Asignando..." : "Asignar Cupón"}
              </button>
            </form>
          </details>
          <details
            className="register-form-details"
            open={popupOpen.orderSearch}
            onToggle={(e) => handlePopupToggle("orderSearch", e.currentTarget.open)}
          >
            <summary className="admin-btn">Buscar Cliente por Orden</summary>
            <form className="register-form discount-form" onSubmit={handleSearchOrder}>
              <button
                type="button"
                className="popup-close-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePopupToggle("orderSearch", false);
                }}
              >
                ✕
              </button>
              <input
                type="text"
                placeholder="Número de orden (#1004)"
                value={orderSearchForm.orderNumber}
                onChange={(e) => setOrderSearchForm({ orderNumber: e.target.value })}
                required
              />
              <button type="submit" disabled={orderSearchLoading}>
                {orderSearchLoading ? "Buscando..." : "Buscar Orden"}
              </button>
              {orderSearchError && <p className="helper-text error">{orderSearchError}</p>}
              {orderSearchResult && (
                <div className="order-search-result" style={{color: "#1a1a2e", textAlign: "left"}}>
                  <p><strong>Orden:</strong> {orderSearchResult.name}</p>
                  <p><strong>Nombre completo:</strong> {`${orderSearchResult.customer?.firstName || ""} ${orderSearchResult.customer?.lastName || ""}`.trim() || "No disponible"}</p>
                  <p><strong>Correo:</strong> {orderSearchResult.customer?.email || orderSearchResult.email || "No disponible"}</p>
                  <button
                    type="button"
                    className="popup-close-btn"
                    onClick={handleUseOrderCustomer}
                    disabled={!orderSearchResult.customer?.email && !orderSearchResult.email}
                  >
                    Asignar un descuento a este cliente
                  </button>
                </div>
              )}
            </form>
          </details>
        </div>
        {adminMsg && (
          <div className={`admin-msg ${adminMsg.type}`}>
            <p>{adminMsg.text}</p>
            {adminMsg.code && (
              <button type="button" className="copy-code-btn" onClick={() => copyDiscountCode(adminMsg.code)}>
                {adminMsg.copied ? "¡Copiado!" : "Copiar código"}
              </button>
            )}
          </div>
        )}
      </header>

      <section className="customers-panel">
        <div className="customers-panel-header">
          <h2>Clientes de Shopify</h2>
          <span className="customers-count">{customerCount}</span>
        </div>
        <div className="customers-grid">
          {customers.map((customer) => (
            <article key={customer.id} className="customer-card">
              <div className="customer-card-email">{customer.email || "Sin email"}</div>
              <div className="customer-card-name">
                {customer.firstName || customer.lastName
                  ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                  : "Cliente"}
              </div>
              <div className="customer-card-id">{customer.id}</div>
            </article>
          ))}
        </div>
      </section>

      <button className="cart-toggle" onClick={() => setCartOpen(!cartOpen)}>
        {cartOpen ? "Cerrar" : "Carrito"}
        {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
      </button>

      <aside className={`cart-sidebar ${cartOpen ? "open" : ""}`}>
        <h2>Mi Carrito</h2>
        {cart.length === 0 ? (
          <p className="cart-empty">El carrito está vacío</p>
        ) : (
          <>
            <ul className="cart-items">
              {cart.map((item) => (
                <li key={item.variantId} className="cart-item">
                  {item.image && (
                    <img src={item.image} alt={item.title} className="cart-item-img" />
                  )}
                  <div className="cart-item-info">
                    <span className="cart-item-title">
                      {item.title}
                      {item.variantTitle && <span className="cart-item-variant"> — {item.variantTitle}</span>}
                    </span>
                    <span className="cart-item-price">
                      {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: item.currency,
                      }).format(item.price)}
                    </span>
                    <div className="cart-item-controls">
                      <button onClick={() => updateQuantity(item.variantId, -1)}>
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.variantId, 1)}>
                        +
                      </button>
                      <button
                        className="cart-item-remove"
                        onClick={() => removeFromCart(item.variantId)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="cart-footer">
              <label className="discount-label" htmlFor="discount-code">
                Código de descuento
              </label>
              <div className="discount-form">
                <input
                  id="discount-code"
                  type="text"
                  value={discountCode}
                  onChange={(event) => setDiscountCode(event.target.value.toUpperCase())}
                  placeholder="Ej.: LIBRO10"
                  disabled={checkingOut}
                />
              </div>
              {checkoutError && <p className="checkout-error">{checkoutError}</p>}
              <div className="cart-total">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: "USD",
                  }).format(cartTotal)}
                </span>
              </div>
              <button
                className="checkout-btn"
                onClick={handleCheckout}
                disabled={checkingOut}
              >
                {checkingOut ? "Procesando..." : "Ir a Pagar"}
              </button>
            </div>
          </>
        )}
      </aside>

      <main className="products-grid">
        {products.map((product) => {
          const image = product.images.edges[0]?.node;
          const selectedVariant = findSelectedVariant(product);
          const hasOptions = (product.options?.length || 0) > 0;

          return (
            <div key={product.id} className="product-card">
              {image ? (
                <img src={image.url} alt={image.altText || product.title} />
              ) : (
                <div className="no-image">Sin imagen</div>
              )}
              <div className="product-info">
                <h2>{product.title}</h2>
                {hasOptions && product.options.map((option) => (
                  <div key={option.name} className="variant-group">
                    <label className="variant-label">{option.name}</label>
                    <div className="variant-values">
                      {option.values.map((value) => (
                        <button
                          key={value}
                          className={`variant-btn ${selectedVariants[product.id]?.[option.name] === value ? "active" : ""}`}
                          onClick={() => handleOptionSelect(product.id, option.name, value)}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="price">
                  {new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: selectedVariant?.price?.currencyCode || product.priceRange.minVariantPrice.currencyCode,
                  }).format(selectedVariant?.price?.amount || product.priceRange.minVariantPrice.amount)}
                </p>
                <button
                  className="add-btn"
                  onClick={() => addToCart(product)}
                  disabled={!selectedVariant}
                >
                  {selectedVariant ? "Agregar al Carrito" : hasOptions ? "Selecciona opciones" : "Agotado"}
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

export default App;
