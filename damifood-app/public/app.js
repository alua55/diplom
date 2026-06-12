const state = {
  user: null,
  foods: [],
  restaurants: [],
  reviews: [],
  settings: {},
  lang: localStorage.getItem("lang") || "kk",
  theme: localStorage.getItem("theme") || "light"
};

const t = {
  kk: {
    search: "Тағам немесе мейрамхана іздеу",
    login: "Кіру",
    register: "Тіркелу",
    logout: "Шығу",
    cart: "Себет",
    profile: "Профиль",
    orders: "Тапсырыстар",
    dashboard: "Кабинет",
    support: "Қолдау"
  },
  ru: {
    search: "Поиск блюда или ресторана",
    login: "Войти",
    register: "Регистрация",
    logout: "Выйти",
    cart: "Корзина",
    profile: "Профиль",
    orders: "Заказы",
    dashboard: "Кабинет",
    support: "Поддержка"
  }
};

function money(v) {
  return new Intl.NumberFormat("kk-KZ").format(Math.round(v || 0)) + " ₸";
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Сұрау орындалмады");
  return data;
}

function toast(text, danger = false) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = "toast";
  if (danger) el.style.borderLeftColor = "var(--danger)";
  el.textContent = text;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function pageName() {
  return location.pathname.split("/").pop() || "index.html";
}

function header() {
  const active = pageName();
  const lang = t[state.lang];
  const auth = state.user
    ? `<button class="secondary" id="logoutBtn">${lang.logout}</button>`
    : `<a href="/pages/login.html"><button class="secondary">${lang.login}</button></a><a href="/pages/register.html"><button>${lang.register}</button></a>`;
  document.querySelector("#appHeader").innerHTML = `
    <header class="topbar">
      <a class="brand" href="/"><span class="logo">DF</span><span>DamiFood</span></a>
      <form class="searchbar" action="/" method="get">
        <span>⌕</span><input name="q" value="${new URLSearchParams(location.search).get("q") || ""}" placeholder="${lang.search}">
      </form>
      <div class="header-actions">
        <select id="langSelect"><option value="kk">Қазақша</option><option value="ru">Русский</option></select>
        <button class="secondary" id="themeBtn">◐</button>
        ${auth}
      </div>
    </header>
    <nav class="navline">
      <a class="${active === "index.html" ? "active" : ""}" href="/">Каталог</a>
      <a class="${active === "cart.html" ? "active" : ""}" href="/pages/cart.html">${lang.cart}</a>
      <a class="${active === "orders.html" ? "active" : ""}" href="/pages/orders.html">${lang.orders}</a>
      <a class="${active === "profile.html" ? "active" : ""}" href="/pages/profile.html">${lang.profile}</a>
      <a class="${active === "tracking.html" ? "active" : ""}" href="/pages/tracking.html">Карта</a>
      <a class="${active === "dashboard.html" ? "active" : ""}" href="/pages/dashboard.html">${lang.dashboard}</a>
      <a class="${active === "support.html" ? "active" : ""}" href="/pages/support.html">${lang.support}</a>
    </nav>`;
  document.querySelector("#langSelect").value = state.lang;
  document.querySelector("#langSelect").onchange = e => {
    state.lang = e.target.value;
    localStorage.setItem("lang", state.lang);
    header();
  };
  document.querySelector("#themeBtn").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", state.theme);
    document.documentElement.dataset.theme = state.theme;
  };
  document.querySelector("#logoutBtn")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/";
  });
}

function restaurant(id) { return state.restaurants.find(r => r.id === id); }
function food(id) { return state.foods.find(f => f.id === id); }
function isOpen(r) {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = r.open.split(":").map(Number);
  const [ch, cm] = r.close.split(":").map(Number);
  return min >= oh * 60 + om && min <= ch * 60 + cm;
}

async function bootstrap() {
  document.documentElement.dataset.theme = state.theme;
  const data = await api("/api/bootstrap");
  Object.assign(state, data);
  header();
}

async function requireUser() {
  if (!state.user) {
    toast("Алдымен жүйеге кіріңіз", true);
    setTimeout(() => location.href = "/pages/login.html", 500);
    return false;
  }
  return true;
}

async function addToCart(foodId) {
  try {
    if (!await requireUser()) return;
    await api("/api/cart", { method: "POST", body: { foodId } });
    toast("Себетке қосылды");
  } catch (e) { toast(e.message, true); }
}

async function renderHome() {
  await bootstrap();
  const q = (new URLSearchParams(location.search).get("q") || "").toLowerCase();
  const category = document.querySelector("#category");
  const sort = document.querySelector("#sort");
  const max = document.querySelector("#maxPrice");
  category.innerHTML = `<option value="">Барлық санат</option>` + [...new Set(state.foods.map(f => f.category))].map(c => `<option>${c}</option>`).join("");

  function draw() {
    let list = state.foods.filter(f => {
      const r = restaurant(f.restaurantId);
      const text = `${f.name} ${f.category} ${f.price} ${r.name}`.toLowerCase();
      return text.includes(q) && (!category.value || f.category === category.value) && (!max.value || f.price <= Number(max.value));
    });
    list.sort((a, b) => sort.value === "price" ? a.price - b.price : sort.value === "time" ? a.time - b.time : b.rating - a.rating);
    document.querySelector("#foodGrid").innerHTML = list.map(f => {
      const r = restaurant(f.restaurantId);
      return `<article class="card food-card">
        <div class="food-img" style="background-image:url('${f.image}')"></div>
        <div class="card-pad stack">
          <div class="row"><h3>${f.name}</h3><span class="price">${money(f.price)}</span></div>
          <div class="row"><span class="tag">${f.category}</span><span class="tag ok">★ ${f.rating} · ${f.time} мин</span></div>
          <p>${r.name} · ${r.open}-${r.close} · <b>${isOpen(r) ? "Ашық" : "Жабық"}</b></p>
          <div class="row"><button onclick="addToCart(${f.id})" ${!f.available || !isOpen(r) ? "disabled" : ""}>Себетке қосу</button><button class="secondary" onclick="favorite(${f.id})">☆ Таңдау</button></div>
        </div>
      </article>`;
    }).join("") || `<div class="empty">Ештеңе табылмады</div>`;
  }
  [category, sort, max].forEach(el => el.addEventListener("input", draw));
  draw();
}

async function favorite(foodId) {
  try {
    if (!await requireUser()) return;
    await api("/api/favorites", { method: "POST", body: { foodId } });
    toast("Таңдаулылар жаңартылды");
  } catch (e) { toast(e.message, true); }
}

window.Dami = { api, bootstrap, toast, money, state, restaurant, food, requireUser };
window.addToCart = addToCart;
window.favorite = favorite;
window.renderHome = renderHome;
