import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [adminMsg, setAdminMsg] = useState(null);
  const [adminLoading, setAdminLoading] = useState({ discount: false, register: false });
  const [registerForm, setRegisterForm] = useState({ email: "", firstName: "", lastName: "", password: "" });
  const [discountForm, setDiscountForm] = useState({
    code: "",
    title: "",
    type: "percentage",
    value: "",
    minimumSubtotal: "",
    usageLimit: "",
    appliesOnEachItem: false,
  });

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
  }, []);

  function findSelectedVariant(product) {
    const selections = selectedVariants[product.id];
    if (!selections || !product.variants?.edges) return null;
    const optionCount = product.options?.length || 0;
    const selectedCount = Object.keys(selections).length;
    if (selectedCount < optionCount) return null;

    return product.variants.edges.find(({ node }) =>
      node.availableForSale &&
      node.selectedOptions.every((opt) => selections[opt.name] === opt.value)
    )?.node || null;
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
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      alert("Error: " + err.message);
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
      setAdminMsg({ type: "success", text: `Cupón "${discountForm.code}" creado con éxito` });
      setDiscountForm({ code: "", title: "", type: "percentage", value: "", minimumSubtotal: "", usageLimit: "", appliesOnEachItem: false });
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
      setRegisterForm({ email: "", firstName: "", lastName: "", password: "" });
    } catch (err) {
      setAdminMsg({ type: "error", text: err.message });
    } finally {
      setAdminLoading((prev) => ({ ...prev, register: false }));
    }
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );

  if (loading) return <div className="loader">Cargando productos...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="app">
      <header className="header">
        <h1>Capillus Store</h1>
        <p>Productos disponibles</p>
        <div className="admin-actions">
          <details className="register-form-details">
            <summary className="admin-btn">Registrarse como Cliente</summary>
            <form className="register-form" onSubmit={handleRegister}>
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
          <details className="register-form-details">
            <summary className="admin-btn">Crear Cupón de Descuento</summary>
            <form className="register-form discount-form" onSubmit={handleCreateDiscount}>
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
              <button type="submit" disabled={adminLoading.discount}>
                {adminLoading.discount ? "Generando..." : "Crear Cupón"}
              </button>
            </form>
          </details>
        </div>
        {adminMsg && (
          <p className={`admin-msg ${adminMsg.type}`}>{adminMsg.text}</p>
        )}
      </header>

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
