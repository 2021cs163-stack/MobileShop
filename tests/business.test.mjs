import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePurchase,
  validateSale,
  calculateDashboard,
  shopDay,
} from "../src/utils/business.js";
const phone = {
  type: "phone",
  name: "iPhone",
  brand: "Apple",
  imei1: "123456789012345",
  imei2: "123456789012346",
  unit_cost: 100,
  date: "2026-10-06",
  quantity: 1,
};
test("purchase validation and duplicate IMEI across either slot", () => {
  assert.doesNotThrow(() => validatePurchase(phone));
  assert.throws(
    () =>
      validatePurchase({ ...phone, imei1: phone.imei2, imei2: null }, [phone]),
    /duplicateImei/,
  );
  assert.throws(
    () => validatePurchase({ ...phone, imei2: phone.imei1 }),
    /invalidImei/,
  );
  assert.throws(
    () => validatePurchase({ ...phone, unit_cost: -1 }),
    /invalidPrice/,
  );
  assert.throws(
    () => validatePurchase({ ...phone, type: "accessory", quantity: 1.5 }),
    /invalidQuantity/,
  );
});
test("sales cannot exceed stock, use fractions or sell a sold phone", () => {
  assert.doesNotThrow(() => validateSale(phone, 1, 150));
  assert.throws(
    () => validateSale({ ...phone, quantity: 0 }, 1, 150),
    /invalidQuantity/,
  );
  assert.throws(
    () => validateSale({ type: "accessory", quantity: 10 }, 11, 5),
    /invalidQuantity/,
  );
  assert.throws(
    () => validateSale({ type: "accessory", quantity: 10 }, 1.5, 5),
    /invalidQuantity/,
  );
  assert.throws(() => validateSale(phone, 1, -1), /invalidPrice/);
});
test("Kabul day boundaries and dashboard net profit", () => {
  assert.equal(shopDay("2026-10-05T21:00:00Z"), "2026-10-06");
  const data = {
    inventory: [
      { type: "phone", quantity: 1 },
      { type: "accessory", quantity: 8 },
    ],
    sales: [
      {
        date: "2026-10-06T10:00:00Z",
        items: [{ quantity: 2, unit_price: 200, profit: 100 }],
      },
    ],
    expenses: [{ date: "2026-10-06T10:00:00Z", amount: 25 }],
  };
  const d = calculateDashboard(data, new Date("2026-10-06T10:00:00Z"));
  assert.equal(d.total_inventory, 9);
  assert.equal(d.today_revenue, 400);
  assert.equal(d.total_profit, 100);
  assert.equal(d.net_profit, 75);
});
