// Lightweight CSV parser (handles quotes, commas, newlines).
export function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [];
  let inQuotes = false;

  // Normalize newlines
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        // Escaped quote
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }

    field += c; i++;
  }
  // last field
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  if (!rows.length) return [];

  const header = rows[0].map(h => (h || '').trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length === 1 && (rows[r][0] || '').trim() === '') continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = (rows[r][c] ?? '').trim();
    out.push(obj);
  }
  return out;
}
