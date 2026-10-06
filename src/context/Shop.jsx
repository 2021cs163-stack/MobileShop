import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import { service } from "../services/api";
const C = createContext();
export const useShop = () => useContext(C);
export function ShopProvider({ children }) {
  const [session, setSession] = useState(null),
    [isDemo, setDemo] = useState(false),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(!!supabase),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const api = service(isDemo);
  const refresh = useCallback(async () => {
    setError("");
    try {
      setData(await service(isDemo).load());
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, [isDemo]);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setSession(data.session);
        setLoading(false);
        if (error) setError(error.message);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (!s) setData(null);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (session || isDemo) {
      setLoading(true);
      refresh()
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [session?.user?.id, isDemo, refresh]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const can = (p) =>
    data?.permissions?.includes(p) &&
    data.profile.active &&
    !data.profile.must_change_password;
  const logout = async () => {
    if (supabase && session) await supabase.auth.signOut();
    setDemo(false);
    setData(null);
    setSession(null);
    location.hash = "home";
  };
  return (
    <C.Provider
      value={{
        session,
        isDemo,
        setDemo,
        data,
        loading,
        error,
        refresh,
        api,
        can,
        logout,
        toast,
        setToast,
      }}
    >
      {children}
    </C.Provider>
  );
}
