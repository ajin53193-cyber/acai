import axios from "axios";
import { useAuth } from "@clerk/react";
import { useCallback } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const publicApi = axios.create({ baseURL: API });

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
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
    },
    [getToken]
  );
}
