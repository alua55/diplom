const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const publicDir = path.join(root, "public");
const dbPath = path.join(root, "data", "db.json");
const port = process.env.PORT || 3000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function hash(password, salt = crypto.randomBytes(12).toString("hex")) {
  const digest = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${digest}`;
}

function verify(password, stored) {
  const [salt, digest] = String(stored || "").split(":");
  if (!salt || !digest) return false;
  return hash(password, salt) === stored;
}

function seed() {
  return {
    sessions: {},
    settings: { yandexApiKey: "YOUR_YANDEX_MAPS_API_KEY" },
    users: [
      { id: 1, role: "admin", name: "Admin", email: "admin@dami.kz", phone: "+77010000001", password: hash("Admin123"), verified: true, lockedUntil: 0, failed: 0, addresses: [{ id: 1, title: "Кеңсе", address: "Астана, Мәңгілік Ел 10", coords: [71.4304, 51.1282] }] },
      { id: 2, role: "courier", name: "Courier", email: "courier@dami.kz", phone: "+77010000002", password: hash("Courier123"), verified: true, lockedUntil: 0, failed: 0, addresses: [] },
      { id: 3, role: "owner", name: "Restaurant Owner", email: "owner@dami.kz", phone: "+77010000003", password: hash("Owner123"), verified: true, lockedUntil: 0, failed: 0, addresses: [] }
    ],
    restaurants: [
      { id: 1, ownerId: 3, name: "Qazan House", category: "Ұлттық тағам", rating: 4.8, open: "09:00", close: "23:00", coords: [71.4379, 51.1321], cover: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80" },
      { id: 2, ownerId: 3, name: "Sushi Steppe", category: "Суши", rating: 4.7, open: "10:00", close: "22:00", coords: [71.4217, 51.1264], cover: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80" },
      { id: 3, ownerId: 3, name: "Burger Line", category: "Фастфуд", rating: 4.5, open: "08:00", close: "20:30", coords: [71.4491, 51.1188], cover: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80" }
    ],
    foods: [
      { id: 1, restaurantId: 1, name: "Бешбармақ сеті", category: "Ұлттық", price: 4200, rating: 4.9, time: 35, available: true, image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80" },
      { id: 2, restaurantId: 1, name: "Қуырдақ", category: "Ұлттық", price: 3100, rating: 4.7, time: 30, available: true, image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80" },
      { id: 3, restaurantId: 2, name: "Филадельфия ролл", category: "Суши", price: 2800, rating: 4.6, time: 28, available: true, image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80" },
      { id: 4, restaurantId: 2, name: "Темпура сет", category: "Суши", price: 5200, rating: 4.8, time: 38, available: true, image: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=900&q=80" },
      { id: 5, restaurantId: 3, name: "Double Burger", category: "Бургер", price: 2400, rating: 4.5, time: 22, available: true, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80" },
      { id: 6, restaurantId: 3, name: "Chicken Pizza", category: "Пицца", price: 3600, rating: 4.4, time: 32, available: true, image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80" }
    ],
    carts: {},
    favorites: {},
    orders: [],
    reviews: [
      { id: 1, restaurantId: 1, userName: "Айдана", rating: 5, text: "Тапсырыс жылы келді, порциясы жақсы." },
      { id: 2, restaurantId: 2, userName: "Мирас", rating: 5, text: "Ролл сапасы тұрақты, жеткізу жылдам." }
    ],
    complaints: [],
    logs: []
  };
}

function readDb() {
  if (!fs.existsSync(dbPath)) writeDb(seed());
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function safeUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(x => {
    const i = x.indexOf("=");
    return [x.slice(0, i).trim(), decodeURIComponent(x.slice(i + 1))];
  }));
}

function getUser(req, db) {
  const token = parseCookies(req).session;
  const id = token && db.sessions[token];
  return db.users.find(u => u.id === id) || null;
}

function send(res, status, body, headers = {}) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    ...headers
  });
  res.end(data);
}

function log(db, user, action) {
  db.logs.unshift({ id: Date.now(), at: new Date().toISOString(), user: user?.email || "guest", action });
  db.logs = db.logs.slice(0, 200);
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
  });
}

function isOpen(r) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = r.open.split(":").map(Number);
  const [ch, cm] = r.close.split(":").map(Number);
  return minutes >= oh * 60 + om && minutes <= ch * 60 + cm;
}

function deliveryFee(order) {
  const peak = [12, 13, 18, 19, 20].includes(new Date().getHours()) ? 350 : 0;
  const distanceFactor = Math.max(1, order.items.length) * 280;
  return 650 + peak + distanceFactor;
}

async function api(req, res) {
  const db = readDb();
  const user = getUser(req, db);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;

  try {
    if (method === "GET" && url.pathname === "/api/bootstrap") {
      return send(res, 200, { user: safeUser(user), restaurants: db.restaurants, foods: db.foods, reviews: db.reviews, settings: db.settings });
    }
    if (method === "POST" && url.pathname === "/api/auth/register") {
      const b = await body(req);
      if (!b.name || !b.email || !b.phone || !b.password) return send(res, 400, { error: "Барлық өрістерді толтырыңыз" });
      if (db.users.some(u => u.email === b.email)) return send(res, 409, { error: "Бұл e-mail тіркелген" });
      const next = Math.max(...db.users.map(u => u.id)) + 1;
      const created = { id: next, role: "client", name: b.name, email: b.email.toLowerCase(), phone: b.phone, password: hash(b.password), verified: true, failed: 0, lockedUntil: 0, addresses: [] };
      db.users.push(created);
      const token = crypto.randomBytes(24).toString("hex");
      db.sessions[token] = created.id;
      log(db, created, "Пайдаланушы тіркелді және e-mail/телефон расталды");
      writeDb(db);
      return send(res, 201, { user: safeUser(created) }, { "Set-Cookie": `session=${token}; HttpOnly; Path=/; SameSite=Lax` });
    }
    if (method === "POST" && url.pathname === "/api/auth/login") {
      const b = await body(req);
      const found = db.users.find(u => u.email === String(b.email || "").toLowerCase());
      if (!found) return send(res, 401, { error: "Пайдаланушы табылмады" });
      if (Date.now() < found.lockedUntil) return send(res, 423, { error: "Аккаунт уақытша бұғатталған" });
      if (!verify(b.password, found.password)) {
        found.failed = (found.failed || 0) + 1;
        if (found.failed >= 3) found.lockedUntil = Date.now() + 60000;
        log(db, found, "Қате пароль енгізілді");
        writeDb(db);
        return send(res, 401, { error: found.failed >= 3 ? "3 рет қате пароль. Аккаунт 1 минутқа бұғатталды" : "Құпия сөз қате" });
      }
      found.failed = 0;
      const token = crypto.randomBytes(24).toString("hex");
      db.sessions[token] = found.id;
      log(db, found, "Жүйеге кірді");
      writeDb(db);
      return send(res, 200, { user: safeUser(found) }, { "Set-Cookie": `session=${token}; HttpOnly; Path=/; SameSite=Lax` });
    }
    if (method === "POST" && url.pathname === "/api/auth/logout") {
      const token = parseCookies(req).session;
      if (token) delete db.sessions[token];
      log(db, user, "Жүйеден шықты");
      writeDb(db);
      return send(res, 200, { ok: true }, { "Set-Cookie": "session=; Max-Age=0; Path=/" });
    }
    if (method === "POST" && url.pathname === "/api/auth/reset") {
      const b = await body(req);
      log(db, user, `Құпия сөзді қалпына келтіру сұралды: ${b.email}`);
      writeDb(db);
      return send(res, 200, { ok: true, message: "Қалпына келтіру сілтемесі e-mail арқылы жіберілді" });
    }

    if (!user) return send(res, 401, { error: "Авторизация қажет" });

    if (method === "PUT" && url.pathname === "/api/profile") {
      const b = await body(req);
      user.name = b.name || user.name;
      user.phone = b.phone || user.phone;
      log(db, user, "Профиль жаңартылды");
      writeDb(db);
      return send(res, 200, { user: safeUser(user) });
    }
    if (method === "POST" && url.pathname === "/api/profile/address") {
      const b = await body(req);
      if (!b.address) return send(res, 400, { error: "Мекенжайды енгізіңіз" });
      user.addresses.push({ id: Date.now(), title: b.title || "Мекенжай", address: b.address, coords: b.coords || [71.4304, 51.1282] });
      log(db, user, "Жеткізу мекенжайы қосылды");
      writeDb(db);
      return send(res, 201, { addresses: user.addresses });
    }
    if (method === "GET" && url.pathname === "/api/cart") {
      return send(res, 200, { items: db.carts[user.id] || [] });
    }
    if (method === "POST" && url.pathname === "/api/cart") {
      const b = await body(req);
      const food = db.foods.find(f => f.id === b.foodId);
      if (!food || !food.available) return send(res, 400, { error: "Тағам қолжетімсіз" });
      const r = db.restaurants.find(x => x.id === food.restaurantId);
      if (!isOpen(r)) return send(res, 400, { error: "Мейрамхана қазір жабық" });
      db.carts[user.id] ||= [];
      const item = db.carts[user.id].find(i => i.foodId === food.id);
      item ? item.qty += 1 : db.carts[user.id].push({ foodId: food.id, qty: 1 });
      log(db, user, `Себетке қосылды: ${food.name}`);
      writeDb(db);
      return send(res, 200, { items: db.carts[user.id] });
    }
    if (method === "PATCH" && url.pathname === "/api/cart") {
      const b = await body(req);
      db.carts[user.id] = (db.carts[user.id] || []).map(i => i.foodId === b.foodId ? { ...i, qty: Math.max(0, b.qty) } : i).filter(i => i.qty > 0);
      writeDb(db);
      return send(res, 200, { items: db.carts[user.id] });
    }
    if (method === "POST" && url.pathname === "/api/orders") {
      const b = await body(req);
      const cart = db.carts[user.id] || [];
      if (!cart.length) return send(res, 400, { error: "Себет бос" });
      if (!b.address) return send(res, 400, { error: "Мекенжайды енгізіңіз" });
      if (b.paymentProvider !== "kaspi" || b.paymentStatus !== "paid") return send(res, 402, { error: "Kaspi төлемі расталмады" });
      const items = cart.map(i => ({ ...i, food: db.foods.find(f => f.id === i.foodId) }));
      const subtotal = items.reduce((s, i) => s + i.food.price * i.qty, 0);
      const order = {
        id: Date.now(),
        userId: user.id,
        courierId: null,
        items: cart,
        address: b.address,
        coords: b.coords || [71.4304, 51.1282],
        note: b.note || "",
        phone: user.phone,
        status: "қабылданды",
        paid: true,
        provider: "Kaspi",
        total: subtotal + deliveryFee({ items: cart }),
        createdAt: new Date().toISOString(),
        courierCoords: [71.4379, 51.1321],
        cancelReason: null,
        refunded: false
      };
      db.orders.unshift(order);
      db.carts[user.id] = [];
      log(db, user, `Тапсырыс Kaspi төлемінен кейін жіберілді #${order.id}`);
      writeDb(db);
      return send(res, 201, { order });
    }
    if (method === "GET" && url.pathname === "/api/orders") {
      const orders = user.role === "admin" ? db.orders : user.role === "courier" ? db.orders.filter(o => !o.courierId || o.courierId === user.id) : db.orders.filter(o => o.userId === user.id);
      return send(res, 200, { orders });
    }
    if (method === "PATCH" && url.pathname.startsWith("/api/orders/")) {
      const id = Number(url.pathname.split("/").at(-1));
      const b = await body(req);
      const order = db.orders.find(o => o.id === id);
      if (!order) return send(res, 404, { error: "Тапсырыс табылмады" });
      if (b.accept && user.role === "courier" && !order.courierId) {
        order.courierId = user.id;
        order.status = "курьер алды";
        order.courierCoords = db.restaurants[0].coords;
      }
      if (b.status && ["admin", "owner", "courier"].includes(user.role)) order.status = b.status;
      if (b.courierCoords && order.courierId === user.id) order.courierCoords = b.courierCoords;
      if (b.cancelReason) {
        order.status = "жойылды";
        order.cancelReason = b.cancelReason;
        order.refunded = order.paid;
      }
      log(db, user, `Тапсырыс жаңартылды #${order.id}: ${order.status}`);
      writeDb(db);
      return send(res, 200, { order });
    }
    if (method === "POST" && url.pathname === "/api/favorites") {
      const b = await body(req);
      db.favorites[user.id] ||= [];
      db.favorites[user.id] = db.favorites[user.id].includes(b.foodId) ? db.favorites[user.id].filter(id => id !== b.foodId) : [...db.favorites[user.id], b.foodId];
      writeDb(db);
      return send(res, 200, { favorites: db.favorites[user.id] });
    }
    if (method === "GET" && url.pathname === "/api/dashboard") {
      if (user.role === "client") return send(res, 200, { addresses: user.addresses, orders: db.orders.filter(o => o.userId === user.id), favorites: db.favorites[user.id] || [] });
      if (user.role === "courier") return send(res, 200, { orders: db.orders.filter(o => !o.courierId || o.courierId === user.id) });
      if (user.role === "owner") return send(res, 200, { restaurants: db.restaurants.filter(r => r.ownerId === user.id), foods: db.foods.filter(f => db.restaurants.some(r => r.ownerId === user.id && r.id === f.restaurantId)), orders: db.orders });
      return send(res, 200, { users: db.users.map(safeUser), orders: db.orders, restaurants: db.restaurants, complaints: db.complaints, logs: db.logs });
    }
    if (method === "PATCH" && url.pathname.startsWith("/api/foods/") && user.role === "owner") {
      const id = Number(url.pathname.split("/").at(-1));
      const b = await body(req);
      const food = db.foods.find(f => f.id === id);
      if (!food) return send(res, 404, { error: "Тағам табылмады" });
      if (typeof b.price === "number") food.price = b.price;
      if (typeof b.available === "boolean") food.available = b.available;
      log(db, user, `Мәзір жаңартылды: ${food.name}`);
      writeDb(db);
      return send(res, 200, { food });
    }
    if (method === "POST" && url.pathname === "/api/complaints") {
      const b = await body(req);
      db.complaints.unshift({ id: Date.now(), userId: user.id, restaurantId: b.restaurantId, text: b.text, at: new Date().toISOString() });
      log(db, user, "Шағым/ұсыныс қалдырды");
      writeDb(db);
      return send(res, 201, { ok: true });
    }
    return send(res, 404, { error: "API табылмады" });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}

function serve(req, res) {
  if (req.url.startsWith("/api/")) return api(req, res);
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = path.normalize(path.join(publicDir, pathname));
  if (!file.startsWith(publicDir)) return send(res, 403, "Forbidden");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

http.createServer(serve).listen(port, () => {
  console.log(`DamiFood app: http://localhost:${port}`);
});
