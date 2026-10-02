import { useEffect, useState } from "react";
import { getCachedSettings, fetchSettings } from "@/lib/api";

export const useSettings = () => {
  const [settings, setSettings] = useState(getCachedSettings());
  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);
  return settings;
};
