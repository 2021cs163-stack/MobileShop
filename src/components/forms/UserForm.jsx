import { useState } from "react";
import { errorKey } from "../../utils/errors";
import { groups } from "../../constants/permissions";
import { useShop } from "../../context/Shop";
import { useLanguage } from "../../context/Language";
import { Modal, Field, Button } from "../ui";
export default function UserForm({ record, onClose }) {
  const { t } = useLanguage(),
    { api, refresh, setToast, can } = useShop(),
    [username, setUsername] = useState(record?.username || ""),
    [role, setRole] = useState(record?.role || "Staff"),
    [permissions, setPermissions] = useState(record?.permissions || []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!record && !/^[a-z][a-z0-9_]{2,29}$/.test(username)) {
      setError(t("invalidUser"));
      return;
    }
    setBusy(true);
    try {
      if (!record)
        await api.user({
          action: "create",
          username,
          role,
          ...(can("users.permissions") ? { permissions } : {}),
        });
      else {
        if (can("users.edit"))
          await api.user({ action: "edit", id: record.id, role });
        if (can("users.permissions"))
          await api.user({ action: "permissions", id: record.id, permissions });
      }
      await refresh();
      setToast(t("saved"));
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t(record ? "edit" : "newUser")}
      onClose={() => !busy && onClose()}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field
            label={t("username")}
            required
            disabled={!!record}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
          <Field
            label={t("role")}
            required
            disabled={!!record && !can("users.edit")}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <p className="setup-note" dir="ltr">
          {username || "username"}@aminzi.af
        </p>
        {!record && <p className="confirmation-note">{t("initialPassword")}</p>}
        {can("users.permissions") && (
          <div className="permission-groups">
            {Object.entries(groups).map(([g, ps]) => (
              <fieldset key={g}>
                <legend>{t(g)}</legend>
                {ps.map((p) => {
                  const key = `${g}.${p}`;
                  return (
                    <label className="checkbox-label" key={key}>
                      <input
                        type="checkbox"
                        checked={permissions.includes(key)}
                        onChange={(e) =>
                          setPermissions((v) => {
                            const next = new Set(v);
                            if (e.target.checked) {
                              next.add(key);
                              if (key === "sales.receipt")
                                next.add("sales.price");
                            } else {
                              next.delete(key);
                              if (key === "sales.price")
                                next.delete("sales.receipt");
                            }
                            return [...next];
                          })
                        }
                      />
                      {t(p)}
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button busy={busy} type="submit">
            {t("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
