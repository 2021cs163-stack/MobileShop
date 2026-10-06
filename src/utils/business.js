export const shopDay = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export function validatePurchase(d, inventory = []) {
  if (!d.name?.trim() || !d.date || !d.type) throw new Error("required");
  if (
    d.unit_cost === "" ||
    !Number.isFinite(Number(d.unit_cost)) ||
    Number(d.unit_cost) < 0
  )
    throw new Error("invalidPrice");
  if (d.type === "phone") {
    if (!d.brand?.trim()) throw new Error("required");
    if (
      !/^\d{15}$/.test(d.imei1 || "") ||
      (d.imei2 && !/^\d{15}$/.test(d.imei2)) ||
      d.imei1 === d.imei2
    )
      throw new Error("invalidImei");
    if (
      inventory.some((i) =>
        [i.imei1, i.imei2].some((x) => x && [d.imei1, d.imei2].includes(x)),
      )
    )
      throw new Error("duplicateImei");
  } else if (!Number.isInteger(Number(d.quantity)) || Number(d.quantity) < 1)
    throw new Error("invalidQuantity");
}
export function validateSale(item, quantity, price) {
  if (!item) throw new Error("required");
  if (
    !Number.isInteger(Number(quantity)) ||
    Number(quantity) < 1 ||
    Number(quantity) > item.quantity ||
    (item.type === "phone" && Number(quantity) !== 1)
  )
    throw new Error("invalidQuantity");
  if (price === "" || !Number.isFinite(Number(price)) || Number(price) < 0)
    throw new Error("invalidPrice");
}
export function calculateDashboard(data, now = new Date()) {
  const today = shopDay(now),
    month = today.slice(0, 7),
    d = {
      total_inventory: 0,
      available_phones: 0,
      available_accessories: 0,
      sold: 0,
      phones_sold: 0,
    };
  data.inventory.forEach((i) => {
    d.total_inventory += i.quantity;
    d[i.type === "phone" ? "available_phones" : "available_accessories"] +=
      i.quantity;
  });
  for (const period of ["today", "monthly", "total"])
    for (const metric of ["sales", "revenue", "profit", "expenses"])
      d[`${period}_${metric}`] = 0;
  data.sales.forEach((s) => {
    const date = shopDay(s.date),
      revenue = s.items.reduce((a, i) => a + i.unit_price * i.quantity, 0),
      profit = s.items.reduce((a, i) => a + i.profit, 0);
    d.sold += s.items.reduce((a, i) => a + i.quantity, 0);
    d.phones_sold += s.items.reduce(
      (a, i) => a + (i.snapshot?.type === "phone" ? i.quantity : 0),
      0,
    );
    for (const period of [
      "total",
      ...(date === today ? ["today"] : []),
      ...(date.slice(0, 7) === month ? ["monthly"] : []),
    ]) {
      d[`${period}_sales`]++;
      d[`${period}_revenue`] += revenue;
      d[`${period}_profit`] += profit;
    }
  });
  data.expenses.forEach((e) => {
    const date = shopDay(e.date);
    d.total_expenses += Number(e.amount);
    if (date === today) d.today_expenses += Number(e.amount);
    if (date.slice(0, 7) === month) d.monthly_expenses += Number(e.amount);
  });
  d.net_profit = d.total_profit - d.total_expenses;
  return d;
}
