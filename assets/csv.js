// assets/csv.js

/**
 * CSVテキストをパースしてオブジェクトの配列に変換
 */
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // 引用符内のカンマを無視する簡易的なCSVパース
    const values = [];
    let current = '';
    let inQuote = false;
    for (let char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return headers.reduce((obj, header, index) => {
      // 引用符の除去
      let val = values[index] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      obj[header] = val;
      return obj;
    }, {});
  });
}

/**
 * データテーブルの描画（チェックボックス機能付き）
 * @param {string} csvPath - CSVファイルのパス
 * @param {string} containerId - 表示するHTML要素のID
 * @param {string|null} idColumn - 行を一意に特定するID列名（nullの場合はチェックボックスなし）
 * @param {Array} displayColumns - 表示する列の設定 [{key: 'col_name', label: '表示名'}]
 */
export async function renderTable(csvPath, containerId, idColumn, displayColumns) {
  try {
    const response = await fetch(csvPath);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    const data = parseCSV(text);
    const container = document.getElementById(containerId);
    
    // チェック状態の読み込み
    const savedChecks = idColumn ? JSON.parse(localStorage.getItem('dq7r_checks') || '{}') : {};

    let html = '<div class="table-responsive"><table class="data-table">';
    
    // ヘッダー
    html += '<thead><tr>';
    if (idColumn) html += '<th class="check-header">済</th>';
    displayColumns.forEach(col => {
      html += `<th>${col.label}</th>`;
    });
    html += '</tr></thead>';

    // ボディ
    html += '<tbody>';
    data.forEach(row => {
      // ID列がある場合のみチェックボックス関連の処理を行う
      const id = idColumn ? row[idColumn] : null;
      const isChecked = id && savedChecks[id];
      const rowClass = isChecked ? 'completed' : '';

      html += `<tr class="${rowClass}" data-id="${id}">`;
      
      // チェックボックス列
      if (idColumn) {
        html += `
          <td class="check-col">
            <input type="checkbox" 
                   ${isChecked ? 'checked' : ''} 
                   onchange="toggleCheck('${id}', this)">
          </td>`;
      }

      // データ列
      displayColumns.forEach(col => {
        let val = row[col.key] || '';
        // 簡易フォーマット: ※から始まる場合は赤字にするなど
        if (val.startsWith('※')) val = `<span class="note">${val}</span>`;
        // 改行コードの処理
        val = val.replace(/\\n/g, '<br>');
        html += `<td>${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    container.innerHTML = html;

  } catch (error) {
    console.error('Error loading CSV:', error);
    document.getElementById(containerId).innerHTML = `<p class="error">データの読み込みに失敗しました。<br>(${error.message})</p>`;
  }
}

// グローバル関数として登録（HTML側のonchangeから呼べるようにする）
window.toggleCheck = function(id, checkbox) {
  const savedChecks = JSON.parse(localStorage.getItem('dq7r_checks') || '{}');
  const tr = checkbox.closest('tr');
  
  if (checkbox.checked) {
    savedChecks[id] = true;
    tr.classList.add('completed');
  } else {
    delete savedChecks[id];
    tr.classList.remove('completed');
  }
  
  localStorage.setItem('dq7r_checks', JSON.stringify(savedChecks));
};
