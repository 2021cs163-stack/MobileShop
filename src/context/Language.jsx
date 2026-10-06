import { createContext, useContext, useState, useEffect } from "react";
import en from "../i18n/en";
import fa from "../i18n/fa";
import ps from "../i18n/ps";
const C = createContext();
export const useLanguage = () => useContext(C);
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    localStorage.getItem("shop-language") || "en",
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "en" ? "ltr" : "rtl";
    localStorage.setItem("shop-language", language);
  }, [language]);
  const t = (key) => ({ en, fa, ps })[language]?.[key] ?? en[key] ?? key;
  return (
    <C.Provider value={{ language, setLanguage, t }}>{children}</C.Provider>
  );
}
