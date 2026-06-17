import { db, firebaseReady } from "./firebase-config.js";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const drinks = [
  {
    id: "latte-golden",
    name: "Latte Golden",
    detail: "Espresso, leche cremosa y toque de panela.",
    price: 3.75,
    coins: 18,
    image: "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "americano-origen",
    name: "Americano de origen",
    detail: "Cafe ecuatoriano con perfil cacao y citricos.",
    price: 2.6,
    coins: 12,
    image: "https://images.unsplash.com/photo-1497636577773-f1231844b336?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "cold-brew",
    name: "Cold Brew",
    detail: "Extraccion lenta, suave y refrescante.",
    price: 3.25,
    coins: 16,
    image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "capuccino-canela",
    name: "Capuccino con canela",
    detail: "Espuma sedosa, canela y aroma tostado.",
    price: 3.1,
    coins: 14,
    image: "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=500&q=80"
  }
];

const state = {
  cart: [],
  coins: Number(localStorage.getItem("coffee-golden-coins") || 0)
};

const elements = {
  tabs: document.querySelectorAll(".tab-view"),
  navButtons: document.querySelectorAll("[data-tab-target]"),
  bottomButtons: document.querySelectorAll(".bottom-nav [data-tab-target]"),
  menuList: document.querySelector("#menuList"),
  cartPreview: document.querySelector("#cartPreview"),
  orderItems: document.querySelector("#orderItems"),
  activeOrderCount: document.querySelector("#activeOrderCount"),
  orderTotal: document.querySelector("#orderTotal"),
  coinBalance: document.querySelector("#coinBalance"),
  walletBalance: document.querySelector("#walletBalance"),
  orderForm: document.querySelector("#orderForm"),
  statusMessage: document.querySelector("#statusMessage"),
  ordersList: document.querySelector("#ordersList"),
  scanButton: document.querySelector("#scanButton"),
  tracePanel: document.querySelector("#tracePanel")
};

const localOrdersKey = "coffee-golden-orders";

function setActiveTab(tabId) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.id === tabId);
  });

  elements.bottomButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tabTarget === tabId);
  });
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMenu() {
  elements.menuList.innerHTML = drinks
    .map((drink) => `
      <article class="drink-card">
        <img src="${drink.image}" alt="${escapeHtml(drink.name)}">
        <div>
          <h3>${escapeHtml(drink.name)}</h3>
          <p>${escapeHtml(drink.detail)}</p>
          <div class="drink-meta">
            <strong>${formatMoney(drink.price)}</strong>
            <button class="add-button" type="button" data-add-drink="${drink.id}">Agregar</button>
          </div>
        </div>
      </article>
    `)
    .join("");
}

function getCartTotal() {
  return state.cart.reduce((total, item) => total + item.price, 0);
}

function getCartCoins() {
  return state.cart.reduce((total, item) => total + item.coins, 0);
}

function renderCart() {
  const count = state.cart.length;
  elements.activeOrderCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  elements.orderTotal.textContent = formatMoney(getCartTotal());

  const content = count
    ? state.cart.map((item, index) => `
        <article class="cart-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatMoney(item.price)} - ${item.coins} coins</span>
          </div>
          <button class="remove-button" type="button" data-remove-item="${index}">Quitar</button>
        </article>
      `).join("")
    : '<p class="empty-state">Tu carrito esta vacio.</p>';

  elements.orderItems.innerHTML = content;
  elements.cartPreview.innerHTML = count
    ? content
    : '<p class="empty-state">Selecciona una bebida para crear tu pedido.</p>';
}

function renderCoins() {
  elements.coinBalance.textContent = state.coins;
  elements.walletBalance.textContent = state.coins;
  localStorage.setItem("coffee-golden-coins", String(state.coins));
}

function addDrink(drinkId) {
  const drink = drinks.find((item) => item.id === drinkId);

  if (!drink) return;

  state.cart.push(drink);
  renderCart();
  setActiveTab("order");
}

function removeCartItem(index) {
  state.cart.splice(index, 1);
  renderCart();
}

function readLocalOrders() {
  return JSON.parse(localStorage.getItem(localOrdersKey) || "[]");
}

function saveLocalOrder(order) {
  const orders = [order, ...readLocalOrders()];
  localStorage.setItem(localOrdersKey, JSON.stringify(orders));
  renderOrders(orders);
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#a8534f" : "#2f7a63";
}

function buildOrder(formData) {
  return {
    customerName: formData.get("customerName").trim(),
    pickupMode: formData.get("pickupMode"),
    notes: formData.get("notes").trim(),
    items: state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      coins: item.coins
    })),
    total: getCartTotal(),
    coinsEarned: getCartCoins(),
    createdAt: new Date().toISOString()
  };
}

async function submitOrder(event) {
  event.preventDefault();

  if (!state.cart.length) {
    setStatus("Agrega al menos una bebida antes de confirmar.", true);
    return;
  }

  const order = buildOrder(new FormData(elements.orderForm));

  if (!order.customerName) {
    setStatus("Escribe el nombre del cliente.", true);
    return;
  }

  try {
    if (firebaseReady && db) {
      await addDoc(collection(db, "pedidos"), {
        ...order,
        createdAt: serverTimestamp()
      });
      setStatus("Pedido guardado en Firebase Firestore.");
    } else {
      saveLocalOrder(order);
      setStatus("Pedido guardado localmente. Agrega Firebase para guardar en Firestore.");
    }

    state.coins += order.coinsEarned;
    state.cart = [];
    elements.orderForm.reset();
    renderCoins();
    renderCart();
    setActiveTab("profile");
  } catch (error) {
    console.error("Error al guardar el pedido:", error);
    setStatus("No se pudo guardar. Revisa Firebase y las reglas de Firestore.", true);
  }
}

function renderOrders(orders) {
  if (!orders.length) {
    elements.ordersList.innerHTML = '<p class="empty-state">Todavia no hay pedidos guardados.</p>';
    return;
  }

  elements.ordersList.innerHTML = orders
    .map((order) => {
      const items = Array.isArray(order.items)
        ? order.items.map((item) => item.name).join(", ")
        : "Pedido";
      const date = order.createdAt?.toDate
        ? order.createdAt.toDate().toLocaleString("es-EC")
        : new Date(order.createdAt).toLocaleString("es-EC");

      return `
        <article class="order-card">
          <h3>${escapeHtml(order.customerName)}</h3>
          <p>${escapeHtml(items)}</p>
          <footer>
            <strong>${formatMoney(Number(order.total || 0))}</strong>
            <span>${Number(order.coinsEarned || 0)} coins - ${date}</span>
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

  const ordersQuery = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));

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
      console.error("Error al leer pedidos:", error);
      renderOrders(readLocalOrders());
    }
  );
}

function renderTraceDemo() {
  elements.tracePanel.innerHTML = `
    <ul class="trace-list">
      <li><span>Origen</span><strong>Loja, Ecuador</strong></li>
      <li><span>Productor</span><strong>Finca El Dorado</strong></li>
      <li><span>Tueste</span><strong>Medio</strong></li>
      <li><span>Lote</span><strong>CG-2026-EC</strong></li>
      <li><span>Bienestar</span><strong>Pausa de 5 min</strong></li>
    </ul>
  `;
}

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-tab-target]");
  const addButton = event.target.closest("[data-add-drink]");
  const removeButton = event.target.closest("[data-remove-item]");

  if (tabButton) {
    setActiveTab(tabButton.dataset.tabTarget);
  }

  if (addButton) {
    addDrink(addButton.dataset.addDrink);
  }

  if (removeButton) {
    removeCartItem(Number(removeButton.dataset.removeItem));
  }
});

elements.orderForm.addEventListener("submit", submitOrder);
elements.scanButton.addEventListener("click", renderTraceDemo);

renderMenu();
renderCart();
renderCoins();
listenToOrders();
