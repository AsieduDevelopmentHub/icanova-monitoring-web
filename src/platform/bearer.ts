const BEARER_KEY = "dse.bearer";
const CHANGE_EVENT = "dse-bearer";

export function getBearerToken(): string | null {
  return sessionStorage.getItem(BEARER_KEY);
}

export function setBearerToken(token: string | null) {
  if (token) {
    sessionStorage.setItem(BEARER_KEY, token);
  } else {
    sessionStorage.removeItem(BEARER_KEY);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onBearerChange(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
