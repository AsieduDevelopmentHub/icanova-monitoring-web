import { useEffect, useState } from "react";
import { getBearerToken, onBearerChange } from "../platform/bearer";

export function useBearerToken() {
  const [token, setToken] = useState<string | null>(() => getBearerToken());
  useEffect(() => onBearerChange(() => setToken(getBearerToken())), []);
  return token;
}
