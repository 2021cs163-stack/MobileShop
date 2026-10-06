import { allPermissions } from "../constants/permissions";
import {
  calculateDashboard,
  validatePurchase,
  validateSale,
  shopDay,
} from "../utils/business";
const id = () => crypto.randomUUID();
const date = (n) => new Date(Date.now() - n * 86400000).toISOString();
const profile = {
  id: "demo-admin",
  username: "Ahmad",
  email: "ahmad@aminzi.af",
  role: "Administrator",
  active: true,
  must_change_password: false,
  created_at: date(90),
};
let data = {
  profile,
  permissions: allPermissions,
  settings: {
    name: "Aminzi Phone Shop",
    phone: "+93 700 123 456",
    address: "Kabul, Afghanistan",
    logo: "",
    primary_color: "#319dea",
    accent_color: "#12bdd0",
    currency: "AFN",
    receipt_note: "Thank you for shopping with us.",
  },
  types: [
    { key: "phone", serialized: true },
    { key: "accessory", serialized: false },
    { key: "other", serialized: false },
  ],
  conditions: ["new", "used"],
  inventory: [],
  purchases: [],
  sales: [],
  expenses: [],
  users: [{ ...profile, permissions: allPermissions }],
};
const products = [
  ["iPhone 15 Pro", "Apple", 58500, 4, "phone", "Natural titanium", "256 GB"],
  ["Galaxy S24 Ultra", "Samsung", 62000, 3, "phone", "Titanium gray", "256 GB"],
  ["iPhone 13", "Apple", 29500, 1, "phone", "Midnight", "128 GB"],
  ["Pixel 8 Pro", "Google", 38000, 1, "phone", "Porcelain", "128 GB"],
  ["Galaxy A55", "Samsung", 21000, 1, "phone", "Ice blue", "128 GB"],
  ["Redmi Note 13", "Xiaomi", 13500, 1, "phone", "Black", "256 GB"],
  ["USB-C fast charger", "Anker", 650, 24, "accessory", "White", ""],
  ["MagSafe phone case", "Apple", 350, 18, "accessory", "Clear", ""],
  ["Wireless earbuds", "Samsung", 1800, 10, "accessory", "Black", ""],
];
products.forEach((p, n) => {
  for (let x = 0; x < (p[4] === "phone" ? p[3] : 1); x++) {
    const item = {
      id: id(),
      type: p[4],
      name: p[0],
      brand: p[1],
      unit_cost: p[2],
      quantity: p[4] === "phone" ? 1 : p[3],
      original_quantity: p[4] === "phone" ? 1 : p[3],
      imei1:
        p[4] === "phone"
          ? `35512345678${String(n * 10 + x).padStart(4, "0")}`
          : null,
      imei2: null,
      color: p[5],
      storage: p[6],
      ram: "8 GB",
      condition: n === 2 ? "used" : "new",
      date: date(n + 2),
      status: "available",
      added_by: "Ahmad",
      notes: "",
    };
    data.inventory.push(item);
    data.purchases.push({ ...item });
  }
});
for (let n = 13; n >= 0; n--) {
  const source = data.inventory[n % 6],
    quantity = 1,
    price = source.unit_cost + 3500 + (n % 3) * 500;
  data.sales.push({
    id: id(),
    invoice: 1024 + 13 - n,
    date: date(n),
    sold_by: "Ahmad",
    shop_snapshot: { ...data.settings },
    items: [
      {
        snapshot: { ...source, sold_by: "Ahmad" },
        inventory_id: source.id,
        quantity,
        unit_price: price,
        profit: price - source.unit_cost,
      },
    ],
  });
}
// Historical demo sales use separate stock lots; available demo stock remains independently sellable.
data.sales.forEach((s) =>
  s.items.forEach((i) => (i.inventory_id = `historic-${s.id}`)),
);
data.sales.reverse();
data.expenses = [
  {
    id: id(),
    amount: 3500,
    reason: "Shop rent",
    date: date(4),
    added_by: "Ahmad",
  },
  {
    id: id(),
    amount: 450,
    reason: "Electricity",
    date: date(1),
    added_by: "Ahmad",
  },
  {
    id: id(),
    amount: 250,
    reason: "Transport",
    date: date(0),
    added_by: "Ahmad",
  },
];
export const demo = {
  async load() {
    const d = structuredClone(data);
    d.dashboard = calculateDashboard(d);
    d.trends = Array.from({ length: 14 }, (_, n) => {
      const day = shopDay(date(13 - n)),
        s = d.sales.filter((s) => shopDay(s.date) === day),
        e = d.expenses.filter((e) => shopDay(e.date) === day);
      return {
        date: day,
        sales: s.length,
        revenue: s.reduce(
          (a, s) =>
            a + s.items.reduce((a, i) => a + i.quantity * i.unit_price, 0),
          0,
        ),
        profit: s.reduce(
          (a, s) => a + s.items.reduce((a, i) => a + i.profit, 0),
          0,
        ),
        expenses: e.reduce((a, e) => a + e.amount, 0),
      };
    });
    d.brands = Object.entries(
      d.sales.reduce((a, s) => {
        s.items.forEach(
          (i) =>
            (a[i.snapshot.brand] = (a[i.snapshot.brand] || 0) + i.quantity),
        );
        return a;
      }, {}),
    ).map(([brand, quantity]) => ({ brand, quantity }));
    return d;
  },
  async purchase(d) {
    validatePurchase(d, data.inventory);
    const item = {
      ...d,
      id: id(),
      unit_cost: Number(d.unit_cost),
      quantity: d.type === "phone" ? 1 : Number(d.quantity),
      status: "available",
      added_by: profile.username,
    };
    item.original_quantity = item.quantity;
    data.inventory.unshift(item);
    data.purchases.unshift({ ...item });
    return item.id;
  },
  async sale(d) {
    const item = data.inventory.find((i) => i.id === d.inventory_id);
    validateSale(item, d.quantity, d.unit_price);
    const quantity = Number(d.quantity),
      unit_price = Number(d.unit_price),
      sid = id();
    const sale = {
      id: sid,
      invoice: Math.max(1000, ...data.sales.map((s) => s.invoice)) + 1,
      date: d.date,
      sold_by: profile.username,
      shop_snapshot: { ...data.settings },
      items: [
        {
          inventory_id: item.id,
          snapshot: { ...item, sold_by: profile.username },
          quantity,
          unit_price,
          profit: (unit_price - item.unit_cost) * quantity,
        },
      ],
    };
    item.quantity -= quantity;
    item.status = item.quantity ? "available" : "sold";
    const p = data.purchases.find((p) => p.id === item.id);
    p.quantity = item.quantity;
    p.status = item.status;
    data.sales.unshift(sale);
    return sid;
  },
  async expense(d, eid) {
    if (!(Number(d.amount) > 0) || !d.reason.trim())
      throw new Error("required");
    const e = {
      ...d,
      amount: Number(d.amount),
      id: eid || id(),
      added_by: profile.username,
    };
    if (eid) data.expenses = data.expenses.map((x) => (x.id === eid ? e : x));
    else data.expenses.unshift(e);
    return e.id;
  },
  async deleteExpense(eid) {
    data.expenses = data.expenses.filter((e) => e.id !== eid);
  },
  async inventory(eid, d, context, remove) {
    if (data.sales.some((s) => s.items.some((i) => i.inventory_id === eid)))
      throw new Error("stockHistory");
    if (remove) {
      data.inventory = data.inventory.filter((i) => i.id !== eid);
      data.purchases = data.purchases.filter((i) => i.id !== eid);
    } else {
      for (const list of [data.inventory, data.purchases]) {
        const item = list.find((i) => i.id === eid);
        Object.assign(item, d);
        if (d.unit_cost !== undefined) item.unit_cost = Number(d.unit_cost);
      }
    }
  },
  async settings(d) {
    data.settings = { ...data.settings, ...d };
  },
  async receipt(eid) {
    return structuredClone(data.sales.find((s) => s.id === eid));
  },
  async user(d) {
    if (d.action === "create") {
      if (data.users.some((u) => u.username === d.username))
        throw new Error("invalidUser");
      data.users.push({
        ...d,
        id: id(),
        email: `${d.username}@aminzi.af`,
        active: true,
        must_change_password: true,
        created_at: date(0),
        permissions: d.permissions || [],
      });
    } else {
      const u = data.users.find((u) => u.id === d.id);
      Object.assign(u, d);
    }
  },
};
