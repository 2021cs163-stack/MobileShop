import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("execute all migrations and exercise secure shop workflows", async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key,email text,encrypted_password text,last_sign_in_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await db.exec(await readFile("supabase/all-migrations.sql", "utf8"));
  const admin = "00000000-0000-0000-0000-000000000001",
    staff = "00000000-0000-0000-0000-000000000002";
  await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    admin,
    "admin@aminzi.af",
    staff,
    "staff@aminzi.af",
  ]);
  await db.exec(await readFile("supabase/bootstrap-admin.sql", "utf8"));
  await t.test('administrator setup can safely be rerun',async()=>{
    await db.exec(await readFile('supabase/bootstrap-admin.sql','utf8'));
    assert.equal((await db.query('select count(*)::int n from profiles where id=$1',[admin])).rows[0].n,1);
  });
  await db.query(
    "insert into profiles(id,username,email,must_change_password) values($1,'staff','staff@aminzi.af',false)",
    [staff],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    admin,
  ]);
  const rpc = async (name, args) =>
    (
      await db.query(
        `select public.${name}(${args.map((_, n) => "$" + (n + 1)).join(",")}) result`,
        args,
      )
    ).rows[0].result;
  const d = {
    type: "phone",
    name: "iPhone 15",
    brand: "Apple",
    imei1: "111111111111111",
    imei2: "222222222222222",
    unit_cost: 100,
    quantity: 1,
    date: new Date().toISOString(),
  };
  let inv, sale;
  await t.test("purchase creates inventory atomically", async () => {
    inv = await rpc("create_purchase", [d]);
    assert.equal(
      (await db.query("select quantity from inventory where id=$1", [inv]))
        .rows[0].quantity,
      1,
    );
  });
  await t.test(
    "IMEI is unique across both slots; failed purchase rolls back",
    async () => {
      await assert.rejects(() =>
        rpc("create_purchase", [
          { ...d, imei1: "333333333333333", imei2: d.imei1 },
        ]),
      );
      assert.equal(
        (await db.query("select count(*)::int n from purchases")).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "phone sale snapshots product, records profit and marks stock sold",
    async () => {
      sale = await rpc("create_sale", [inv, 1, 150, new Date().toISOString()]);
      const row = (
        await db.query("select * from sale_items where sale_id=$1", [sale])
      ).rows[0];
      assert.equal(Number(row.profit), 50);
      assert.equal(row.snapshot.imei1, d.imei1);
      assert.equal(
        (await db.query("select quantity from inventory where id=$1", [inv]))
          .rows[0].quantity,
        0,
      );
    },
  );
  await t.test("same phone cannot be sold twice", async () => {
    await assert.rejects(
      () => rpc("create_sale", [inv, 1, 150, new Date().toISOString()]),
      /Insufficient/,
    );
    assert.equal(
      (await db.query("select count(*)::int n from sales")).rows[0].n,
      1,
    );
  });
  await t.test("accessory quantities and oversell rollback", async () => {
    const accessory = await rpc("create_purchase", [
      {
        type: "accessory",
        name: "Charger",
        quantity: 10,
        unit_cost: 10,
        date: new Date().toISOString(),
      },
    ]);
    await rpc("create_sale", [accessory, 2, 15, new Date().toISOString()]);
    await assert.rejects(() =>
      rpc("create_sale", [accessory, 9, 15, new Date().toISOString()]),
    );
    assert.equal(
      (
        await db.query("select quantity from inventory where id=$1", [
          accessory,
        ])
      ).rows[0].quantity,
      8,
    );
  });
  await t.test(
    "expenses, dashboard and receipts remain historically accurate",
    async () => {
      await rpc("save_expense", [
        { amount: 5, reason: "Transport", date: new Date().toISOString() },
        null,
      ]);
      const data = await rpc("get_shop_data", []);
      assert.equal(data.dashboard.net_profit, 55);
      assert.equal(data.dashboard.total_revenue, 180);
      const receipt = await rpc("get_receipt", [sale]);
      assert.equal(receipt.items[0].unit_price, 150);
      assert.equal(receipt.items[0].unit_cost, undefined);
      assert.equal(receipt.items[0].profit, undefined);
      await rpc("save_settings", [{ ...data.settings, name: "Changed name" }]);
      assert.equal(
        (await rpc("get_receipt", [sale])).shop_snapshot.name,
        "Aminzi Phone Shop",
      );
    },
  );
  await t.test(
    "staff costs and profit are redacted at the database boundary",
    async () => {
      await db.query(
        "insert into user_permissions values($1,'inventory.view'),($1,'sales.view'),($1,'home.view')",
        [staff],
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        staff,
      ]);
      const data = await rpc("get_shop_data", []);
      assert.equal(data.inventory[0].unit_cost, undefined);
      assert.equal(data.sales[0].items[0].profit, undefined);
      assert.equal(data.sales[0].items[0].unit_price, undefined);
      assert.equal(data.dashboard.net_profit, undefined);
      await assert.rejects(
        () => rpc("create_purchase", [d]),
        /Permission denied/,
      );
      await assert.rejects(
        () => rpc("get_receipt", [sale]),
        /Permission denied/,
      );
    },
  );
  await t.test(
    "raw table reads and admin RPC are denied to authenticated clients",
    async () => {
      await db.exec("set role authenticated");
      await assert.rejects(
        () => db.query("select * from purchases"),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("select * from sale_items"),
        /permission denied/,
      );
      await assert.rejects(
        () => rpc("admin_profile", [staff, admin, {}, "disable"]),
        /permission denied/,
      );
      await db.exec("reset role");
    },
  );
  await t.test(
    "disabled accounts and first-login password gate enforced",
    async () => {
      await db.query("update profiles set active=false where id=$1", [staff]);
      await assert.rejects(
        () => rpc("get_shop_data", []),
        /Account unavailable/,
      );
      await db.query(
        "update profiles set active=true,must_change_password=true where id=$1",
        [staff],
      );
      const d = await rpc("get_shop_data", []);
      assert.equal(d.inventory, undefined);
      assert.equal(await rpc("has_permission", ["inventory.view"]), false);
      await db.query(
        "update auth.users set encrypted_password='new-hash' where id=$1",
        [staff],
      );
      assert.equal(await rpc("has_permission", ["inventory.view"]), true);
    },
  );
  await db.close();
});
