import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  let createdId: string | undefined;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    if (req.method !== "POST")
      return reply({ error: "Method not allowed" }, 405);
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token) return reply({ error: "Unauthorized" }, 401);
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) return reply({ error: "Unauthorized" }, 401);
    const { action, id, ...data } = await req.json();
    if (!["create", "edit", "disable", "permissions"].includes(action))
      throw new Error("Invalid action");
    const permission = {
      create: "users.create",
      edit: "users.edit",
      disable: "users.disable",
      permissions: "users.permissions",
    }[action];
    const { data: profile } = await admin
      .from("profiles")
      .select("active,must_change_password")
      .eq("id", user.id)
      .single();
    const { data: allowed } = await admin
      .from("user_permissions")
      .select("permission")
      .eq("user_id", user.id)
      .eq("permission", permission!)
      .maybeSingle();
    if (!profile?.active || profile.must_change_password || !allowed)
      return reply({ error: "Permission denied" }, 403);
    if (data.permissions) {
      const { data: can } = await admin
        .from("user_permissions")
        .select("permission")
        .eq("user_id", user.id)
        .eq("permission", "users.permissions")
        .maybeSingle();
      if (!can) return reply({ error: "Permission management denied" }, 403);
    }
    let target = id;
    if (action === "create") {
      if (!/^[a-z][a-z0-9_]{2,29}$/.test(data.username || ""))
        throw new Error("Invalid username");
      const { data: made, error } = await admin.auth.admin.createUser({
        email: `${data.username}@aminzi.af`,
        password: "user123",
        email_confirm: true,
      });
      if (error) throw error;
      target = made.user.id;
      createdId = target;
    }
    const { error } = await admin.rpc("admin_profile", {
      p_actor: user.id,
      p_target: target,
      p_data: data,
      p_action: action,
    });
    if (error) throw error;
    return reply({ id: target });
  } catch (e) {
    if (createdId) await admin.auth.admin.deleteUser(createdId);
    return reply(
      { error: e instanceof Error ? e.message : "User operation failed" },
      400,
    );
  }
});
