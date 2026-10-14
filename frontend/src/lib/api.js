import axios from "axios";
import { useAuth } from "@clerk/react";
import { useCallback } from "react";
import { API_LANG } from "@/i18n";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const publicApi = axios.create({ baseURL: API, headers: { "X-Lang": API_LANG } });

export function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async (config) => {
      const token = await getToken();
      return axios({
        ...config,
        url: `${API}${config.url}`,
        headers: {
          ...(config.headers || {}),
          "X-Lang": API_LANG,
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
    },
    [getToken]
  );
}

const PHONE_DOMAIN = "@phone.gogo589.com";
export const userEmail = (user) => {
  const e = user?.primaryEmailAddress?.emailAddress || "";
  return e.endsWith(PHONE_DOMAIN) ? "" : e;
};
export const userPhone = (user) => user?.publicMetadata?.phone || user?.primaryPhoneNumber?.phoneNumber || "";
export const userLabel = (user) => userEmail(user) || userPhone(user) || user?.username || "";
