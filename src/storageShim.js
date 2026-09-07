// The Claude.ai artifact sandbox provides a built-in `window.storage` API
// (get/set/delete/list, backed by Anthropic's infrastructure). Outside that
// sandbox there's no such thing — this shim implements the exact same
// contract on top of plain browser localStorage, so none of the app code
// that already calls window.storage needs to change.
//
// Contract preserved:
//   - get() on a missing key throws (matches documented artifact behavior,
//     and the app already wraps every call in try/catch expecting this).
//   - set()/get()/delete() all return { key, value|deleted, shared }.
//   - shared vs personal storage is modeled as separate key prefixes —
//     there's no multi-user backend here, so "shared" just means "not
//     namespaced per browser profile," which is the closest true equivalent.

const PREFIX = "fpm:storage:";

function fullKey(key, shared) {
  return `${PREFIX}${shared ? "shared" : "user"}:${key}`;
}

async function get(key, shared = false) {
  const raw = localStorage.getItem(fullKey(key, shared));
  if (raw === null) {
    throw new Error(`Key not found: ${key}`);
  }
  return { key, value: raw, shared };
}

async function set(key, value, shared = false) {
  localStorage.setItem(fullKey(key, shared), value);
  return { key, value, shared };
}

async function del(key, shared = false) {
  const existed = localStorage.getItem(fullKey(key, shared)) !== null;
  localStorage.removeItem(fullKey(key, shared));
  return { key, deleted: existed, shared };
}

async function list(prefix = "", shared = false) {
  const searchPrefix = fullKey(prefix, shared);
  const stripLen = fullKey("", shared).length;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(searchPrefix)) keys.push(k.slice(stripLen));
  }
  return { keys, prefix, shared };
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = { get, set, delete: del, list };
}
