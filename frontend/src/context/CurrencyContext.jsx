import { createContext, useContext, useEffect, useState } from "react";
import { publicApi } from "@/lib/api";

const CurrencyContext = createContext(null);

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencyProvider({ children }) {
  const [currencies, setCurrencies] = useState([]);
  const [code, setCode] = useState(() => localStorage.getItem("gt_currency") || "USD");

  useEffect(() => {
    publicApi.get("/currencies").then((r) => setCurrencies(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("gt_currency", code);
  }, [code]);

  const active = currencies.find((c) => c.code === code) || { code: "USD", symbol: "$", rate_to_usd: 1 };

  const convert = (usd) => (usd || 0) * (active.rate_to_usd || 1);

  const format = (usd) => {
    const amt = convert(usd);
    const decimals = ["JPY", "TWD", "KRW", "VND", "IDR"].includes(active.code) ? 0 : 2;
    return `${active.symbol}${amt.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currencies, code, setCode, active, convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}
