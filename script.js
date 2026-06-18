import { db, firebaseReady } from "./firebase-config.js";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const products = [
  {
    id: "sobre-individual",
    name: "Sobre filtrante",
    description: "Cafe de grano seleccionado en un filtro portatil. Listo en cualquier lugar.",
    price: 3.5,
    coins: 35,
    image: "./assets/sobre-filtrante.webp"
  },
  {
    id: "caja-sobres",
    name: "Caja Coffee Golden",
    description: "Presentacion premium con sobres individuales para casa, oficina o regalo.",
    price: 24,
    coins: 80,
    image: "./assets/caja-sobres.webp"
  },
  {
    id: "combo-golden",
    name: "Combo Golden",
    description: "Sobres filtrantes, galletas artesanales y pasaporte cafetero QR.",
    price: 29.5,
    coins: 100,
    image: "./assets/combo-golden.webp"
  }
];

const state = {
  cart: []
};

const elements = {
  productGrid: document.querySelector("#productGrid"),
  cartList: document.querySelector("#cartList"),
  cartTotal: document.querySelector("#cartTotal"),
  orderForm: document.querySelector("#orderForm"),
  ordersList: document.querySelector("#ordersList"),
  statusMessage: document.querySelector("#statusMessage"),
  passportData: document.querySelector("#passportData"),
  coinBalance: document.querySelector("#coinBalance"),
  balanceLarge: document.querySelector("#balanceLarge"),
  menuButton: document.querySelector("#menuButton"),
  navMenu: document.querySelector("#navMenu")
};

const localOrdersKey = "coffee-golden-web-orders";

function formatMoney(value) {
  return `S/ ${value.toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProducts() {
  elements.productGrid.innerHTML = products
    .map((product) => `
      <article class="product-card">
        <img src="${product.image}" alt="${escapeHtml(product.name)}">
        <div class="product-body">
          <div class="product-title-row"><h3>${escapeHtml(product.name)}</h3><strong class="product-price">${formatMoney(product.price)}</strong></div>
          <p>${escapeHtml(product.description)}</p>
          <div class="coins-earned"><span class="mini-coin">C</span> +${product.coins} Coffee Coins</div>
          <button class="add-button" type="button" data-add-product="${product.id}">Agregar al pedido</button>
        </div>
      </article>
    `)
    .join("");
}

function getCartTotal() {
  return state.cart.reduce((total, item) => total + item.price, 0);
}

function renderCart() {
  if (!state.cart.length) {
    elements.cartList.innerHTML = '<p class="empty-state">Selecciona una presentacion para iniciar el pedido.</p>';
  } else {
    elements.cartList.innerHTML = state.cart
      .map((item, index) => `
        <article class="cart-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatMoney(item.price)}</span>
          </div>
          <button class="remove-button" type="button" data-remove-item="${index}" aria-label="Quitar ${escapeHtml(item.name)}">×</button>
        </article>
      `)
      .join("");
  }

  elements.cartTotal.textContent = formatMoney(getCartTotal());
}

function addProduct(productId) {
  const product = products.find((item) => item.id === productId);

  if (!product) return;

  state.cart.push(product);
  renderCart();
  document.querySelector("#comprar").scrollIntoView({ behavior: "smooth" });
}

function removeCartItem(index) {
  state.cart.splice(index, 1);
  renderCart();
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#9f2f2f" : "#2d725c";
}

function readLocalOrders() {
  return JSON.parse(localStorage.getItem(localOrdersKey) || "[]");
}

function saveLocalOrder(order) {
  const orders = [order, ...readLocalOrders()];
  localStorage.setItem(localOrdersKey, JSON.stringify(orders));
  renderOrders(orders);
}

function buildOrder(formData) {
  return {
    customerName: formData.get("customerName").trim(),
    customerEmail: formData.get("customerEmail").trim(),
    deliveryMode: formData.get("deliveryMode"),
    notes: formData.get("notes").trim(),
    items: state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price
    })),
    total: getCartTotal(),
    productType: "Cafe en sobres filtrantes portatiles",
    source: "Pasaporte cafetero web",
    createdAt: new Date().toISOString()
  };
}

async function submitOrder(event) {
  event.preventDefault();

  if (!state.cart.length) {
    setStatus("Agrega al menos una presentacion de sobres filtrantes.", true);
    return;
  }

  const order = buildOrder(new FormData(elements.orderForm));

  if (!order.customerName || !order.customerEmail) {
    setStatus("Completa tu nombre y correo para registrar la compra.", true);
    return;
  }

  try {
    if (firebaseReady && db) {
      await addDoc(collection(db, "compras"), {
        ...order,
        createdAt: serverTimestamp()
      });
      setStatus("Compra registrada en Firebase Firestore.");
    } else {
      saveLocalOrder(order);
      setStatus("Compra guardada localmente. Agrega Firebase para guardar en Firestore.");
    }

    state.cart = [];
    elements.orderForm.reset();
    renderCart();
  } catch (error) {
    console.error("Error al registrar la compra:", error);
    setStatus("No se pudo registrar la compra. Revisa Firebase y las reglas de Firestore.", true);
  }
}

function renderOrders(orders) {
  if (!elements.ordersList) return;

  if (!orders.length) {
    elements.ordersList.innerHTML = '<p class="empty-state">Todavia no hay compras registradas.</p>';
    return;
  }

  elements.ordersList.innerHTML = orders
    .map((order) => {
      const items = Array.isArray(order.items)
        ? order.items.map((item) => item.name).join(", ")
        : "Sobres filtrantes";
      const date = order.createdAt?.toDate
        ? order.createdAt.toDate().toLocaleString("es-EC")
        : new Date(order.createdAt).toLocaleString("es-EC");

      return `
        <article class="order-card">
          <h3>${escapeHtml(order.customerName)}</h3>
          <p>${escapeHtml(items)}</p>
          <footer>
            <strong>${formatMoney(Number(order.total || 0))}</strong>
            <span>${date}</span>
          </footer>
        </article>
      `;
    })
    .join("");
}

function listenToOrders() {
  if (!firebaseReady || !db) {
    renderOrders(readLocalOrders());
    return;
  }

  const ordersQuery = query(collection(db, "compras"), orderBy("createdAt", "desc"));

  onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      renderOrders(orders);
    },
    (error) => {
      console.error("Error al leer compras:", error);
      renderOrders(readLocalOrders());
    }
  );
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-product]");
  const removeButton = event.target.closest("[data-remove-item]");

  if (addButton) {
    addProduct(addButton.dataset.addProduct);
  }

  if (removeButton) {
    removeCartItem(Number(removeButton.dataset.removeItem));
  }
});

elements.orderForm.addEventListener("submit", submitOrder);
elements.menuButton.addEventListener("click", () => {
  const isOpen = elements.navMenu.classList.toggle("open");
  elements.menuButton.setAttribute("aria-expanded", String(isOpen));
});
elements.navMenu.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    elements.navMenu.classList.remove("open");
    elements.menuButton.setAttribute("aria-expanded", "false");
  }
});

document.querySelectorAll(".map-marker").forEach((marker) => {
  marker.addEventListener("click", () => {
    document.querySelectorAll(".map-marker").forEach((item) => item.classList.remove("active"));
    marker.classList.add("active");
    document.querySelector("#territoryTitle").textContent = marker.dataset.territory;
    document.querySelector("#territoryRegion").textContent = marker.dataset.region;
    document.querySelector("#territoryProduct").textContent = marker.dataset.product;
    document.querySelector("#territoryDescription").textContent = marker.dataset.description;
  });
});

renderProducts();
renderCart();
listenToOrders();
