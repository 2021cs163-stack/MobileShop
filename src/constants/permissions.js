export const groups = {
  home: ["view", "revenue", "profit", "expenses", "analytics"],
  sales: ["view", "create", "details", "price", "profit", "receipt"],
  purchases: ["view", "create", "edit", "delete", "cost"],
  inventory: ["view", "details", "cost", "edit", "delete"],
  expenses: ["view", "create", "edit", "delete"],
  users: ["view", "create", "edit", "disable", "permissions"],
  settings: ["view", "edit"],
};
export const allPermissions = Object.entries(groups).flatMap(([g, ps]) =>
  ps.map((p) => `${g}.${p}`),
);
