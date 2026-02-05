// assets/csv.js

/**
 * CSVテキストをパースしてオブジェクトの配列に変換
 */
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] ? values[index].trim() : '';
      return obj;
    }, {});
  });
}

/**
 * テーブルを生成して描画する（チェックボックス機能付き）
 * @param {string} csvPath - CSVファイルのパス
 * @param {string} containerId - テーブルを表示するHTML要素のID
 * @param {string} idColumn - 行を一意に特定するID列の名前（例: 'medal_id', 'tablet_id'）
 * @param {Array} displayColumns - 表示したい列のリスト（日本語ヘッダー対応）
 */
export async function renderTable(csvPath, containerId, idColumn, displayColumns) {
  try {
    const response = await fetch(csvPath);
    const text = await response.text();
    const data = parseCSV(text);
    const container = document.getElementById(containerId);
    
    // 保存されたチェック状態を取得
    const savedChecks = JSON.parse(localStorage.getItem('dq7r_checks') || '{}');

    let html = '<table class="data-table">';
    
    // ヘッダー生成
    html += '<thead><tr><th>完了</th>'; // チェックボックス列
    displayColumns.forEach(col => {
      html += `<th>${col.label}</th>`;
    });
    html += '</tr></thead>';

    // ボディ生成
    html += '<tbody>';
    data.forEach(row => {
      const id = row[idColumn];
      const isChecked = savedChecks[id] ? 'checked' : '';
      const rowClass = isChecked ? 'completed' : ''; // 完了行には色をつけるクラス

      html += `<tr class="${rowClass}" data-id="${id}">`;
      
      // チェックボックス列
      html += `
        <td class="check-col">
          <input type="checkbox" ${isChecked} onchange="toggleCheck('${id}', this)">
        </td>`;

      // データ列
      displayColumns.forEach(col => {
        let val = row[col.key] || '';
        // 特定のキーワード（※など）を赤字にする簡易装飾
        if (val.startsWith('※')) val = `<span class="note">${val}</span>`;
        html += `<td>${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;

  } catch (error) {
    console.error('CSV Load Error:', error);
    document.getElementById(containerId).innerHTML = '<p class="error">データの読み込みに失敗しました。</p>';
  }
}

// グローバル関数として登録（HTMLから直接呼べるようにする）
window.toggleCheck = function(id, checkbox) {
  const savedChecks = JSON.parse(localStorage.getItem('dq7r_checks') || '{}');
  if (checkbox.checked) {
    savedChecks[id] = true;
    checkbox.closest('tr').classList.add('completed');
  } else {
    delete savedChecks[id];
    checkbox.closest('tr').classList.remove('completed');
  }
  localStorage.setItem('dq7r_checks', JSON.stringify(savedChecks));
};
