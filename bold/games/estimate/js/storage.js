/* localStorage helpers. Storage can be missing or blocked (private mode, disabled site data),
   so every read and write is wrapped, and the game simply runs without saving in that case. */

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* not saved; the game still works */ }
}
