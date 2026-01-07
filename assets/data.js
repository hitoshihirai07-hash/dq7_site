import { parseCSV } from "./csv.js";

const cache = new Map();

export async function loadCSV(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path, { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`データ読込失敗: ${path} (${res.status})`);
      const txt = await res.text();
      return parseCSV(txt);
    });
  cache.set(path, p);
  return p;
}

export function byId(list, idKey, id) {
  return list.find(x => (x[idKey] || '') === id) || null;
}
