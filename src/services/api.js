import { supabase } from "../lib/supabase";
import { demo } from "./demo";
async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}
export function service(isDemo) {
  return isDemo
    ? demo
    : {
        load: () => rpc("get_shop_data"),
        purchase: (d) => rpc("create_purchase", { p_data: d }),
        sale: (d) =>
          rpc("create_sale", {
            p_inventory_id: d.inventory_id,
            p_quantity: Number(d.quantity),
            p_unit_price: Number(d.unit_price),
            p_date: d.date,
          }),
        expense: (d, id) =>
          rpc("save_expense", { p_data: d, p_id: id || null }),
        deleteExpense: (id) => rpc("delete_expense", { p_id: id }),
        inventory: (id, d, context, remove) =>
          rpc("change_inventory", {
            p_id: id,
            p_data: d,
            p_context: context,
            p_delete: remove,
          }),
        settings: (d) => rpc("save_settings", { p_data: d }),
        receipt: (id) => rpc("get_receipt", { p_id: id }),
        user: async (d) => {
          const { data, error } = await supabase.functions.invoke(
            "manage-user",
            { body: d },
          );
          if (error) {
            const details = await error.context?.json?.().catch(() => null);
            throw new Error(details?.error || error.message);
          }
          if (data?.error) throw new Error(data.error);
          return data;
        },
      };
}
