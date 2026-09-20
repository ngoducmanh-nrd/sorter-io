// js/modal.js

/**
 * Custom confirm dialog, trả về Promise<boolean>
 */
export function confirmDialog({
    title = 'Xác nhận',
    message = '',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    danger = false
} = {}) {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title" class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button class="btn" data-act="cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${confirmText}</button>
        </div>
      </div>
    `;
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('show'));

        const close = (result) => {
            backdrop.classList.remove('show');
            backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter') close(true);
        };
        document.addEventListener('keydown', onKey);

        backdrop.addEventListener('click', (e) => {
            const act = e.target.getAttribute?.('data-act');
            if (act === 'ok') close(true);
            else if (act === 'cancel' || e.target === backdrop) close(false);
        });

        // Focus nút OK
        requestAnimationFrame(() => backdrop.querySelector('[data-act="ok"]')?.focus());
    });
}

/** Prompt dialog, trả về Promise<string|null> */
export function promptDialog({
    title = 'Nhập giá trị',
    message = '',
    defaultValue = '',
    placeholder = '',
    confirmText = 'OK',
    cancelText = 'Hủy'
} = {}) {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal-title">${title}</h3>
        ${message ? `<p class="modal-message">${message}</p>` : ''}
        <input class="text-input modal-input" type="text" value="${defaultValue}" placeholder="${placeholder}">
        <div class="modal-actions">
          <button class="btn" data-act="cancel">${cancelText}</button>
          <button class="btn btn-primary" data-act="ok">${confirmText}</button>
        </div>
      </div>
    `;
        document.body.appendChild(backdrop);
        const input = backdrop.querySelector('.modal-input');
        requestAnimationFrame(() => {
            backdrop.classList.add('show');
            input.focus();
            input.select();
        });

        const close = (result) => {
            backdrop.classList.remove('show');
            backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') close(null);
            if (e.key === 'Enter') close(input.value.trim() || null);
        };
        document.addEventListener('keydown', onKey);

        backdrop.addEventListener('click', (e) => {
            const act = e.target.getAttribute?.('data-act');
            if (act === 'ok') close(input.value.trim() || null);
            else if (act === 'cancel' || e.target === backdrop) close(null);
        });
    });
}

/** Modal xem trước danh sách file sẽ di chuyển */
export function previewDialog({ items, summary, maxDisplay = 200 } = {}) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const displayed = items.slice(0, maxDisplay);
    const remainder = items.length - displayed.length;

    const rowsHtml = displayed.map(it => `
      <div class="preview-row">
        <div class="preview-file">
          <span class="preview-ext">${(it.ext || '?').replace('.','')}</span>
          <span class="preview-name" title="${it.fileName}">${it.fileName}</span>
        </div>
        <svg class="preview-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <span class="preview-dest">${it.category.folderName}/</span>
      </div>
    `).join('');

    backdrop.innerHTML = `
      <div class="modal modal-lg" role="dialog" aria-modal="true">
        <h3 class="modal-title">Xem trước phân loại</h3>
        <p class="modal-message">${summary}</p>
        <div class="preview-list">
          ${rowsHtml || '<div class="empty-state" style="padding:20px">Không có tệp nào</div>'}
          ${remainder > 0 ? `<div class="preview-more">… và ${remainder} tệp khác</div>` : ''}
        </div>
        <div class="modal-actions">
          <button class="btn" data-act="cancel">Hủy</button>
          <button class="btn btn-primary" data-act="ok" ${items.length ? '' : 'disabled'}>
            Bắt đầu chuyển
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    const close = v => {
      backdrop.classList.remove('show');
      backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = e => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter' && items.length) close(true);
    };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', e => {
      const act = e.target.getAttribute?.('data-act');
      if (act === 'ok') close(true);
      else if (act === 'cancel' || e.target === backdrop) close(false);
    });
  });
}

/** Modal cấu hình rules nâng cao cho 1 category */
export function advancedRulesDialog(category) {
  return new Promise(resolve => {
    const adv = category.advanced || {};
    const size = adv.size || { enabled: false, op: '>', value: 100, unit: 'MB' };
    const age  = adv.age  || { enabled: false, op: 'older', days: 30 };

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-lg" role="dialog" aria-modal="true">
        <h3 class="modal-title">Quy tắc nâng cao — ${category.name}</h3>
        <p class="modal-message" style="margin-bottom:16px">
          Các điều kiện dưới đây được kết hợp bằng OR. Để trống = không dùng.
        </p>

        <div class="form-group">
          <label class="form-label">Regex (khớp tên tệp)</label>
          <input class="text-input" id="adv-regex" value="${(adv.regex || '').replace(/"/g,'&quot;')}"
                 placeholder="vd: ^report_\\d+\\.pdf$">
        </div>

        <div class="form-group">
          <label class="form-label">Tên chứa chuỗi</label>
          <input class="text-input" id="adv-name" value="${(adv.nameContains || '').replace(/"/g,'&quot;')}"
                 placeholder="vd: invoice">
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" id="adv-size-enabled" ${size.enabled ? 'checked' : ''}>
            Kích thước tệp
          </label>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <select class="text-input" id="adv-size-op" style="flex:0 0 130px">
              <option value=">" ${size.op === '>' ? 'selected' : ''}>Lớn hơn</option>
              <option value="<" ${size.op === '<' ? 'selected' : ''}>Nhỏ hơn</option>
            </select>
            <input class="text-input" type="number" id="adv-size-val" value="${size.value}" min="0" step="any">
            <select class="text-input" id="adv-size-unit" style="flex:0 0 90px">
              <option ${size.unit==='KB'?'selected':''}>KB</option>
              <option ${size.unit==='MB'?'selected':''}>MB</option>
              <option ${size.unit==='GB'?'selected':''}>GB</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" id="adv-age-enabled" ${age.enabled ? 'checked' : ''}>
            Tuổi tệp
          </label>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <select class="text-input" id="adv-age-op" style="flex:0 0 130px">
              <option value="older" ${age.op === 'older' ? 'selected' : ''}>Cũ hơn</option>
              <option value="newer" ${age.op === 'newer' ? 'selected' : ''}>Mới hơn</option>
            </select>
            <input class="text-input" type="number" id="adv-age-val" value="${age.days}" min="1">
            <span style="align-self:center; color:var(--text-muted);">ngày</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Độ ưu tiên (nhỏ hơn = xét trước)</label>
          <input class="text-input" type="number" id="adv-priority" value="${category.priority ?? 100}">
        </div>

        <div class="modal-actions">
          <button class="btn" data-act="cancel">Hủy</button>
          <button class="btn btn-primary" data-act="ok">Lưu quy tắc</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    const close = (val) => {
      backdrop.classList.remove('show');
      backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);

    backdrop.addEventListener('click', e => {
      const act = e.target.getAttribute?.('data-act');
      if (act === 'ok') {
        close({
          priority: parseInt(backdrop.querySelector('#adv-priority').value, 10) || 100,
          advanced: {
            regex: backdrop.querySelector('#adv-regex').value.trim(),
            regexFlags: 'i',
            nameContains: backdrop.querySelector('#adv-name').value.trim(),
            size: {
              enabled: backdrop.querySelector('#adv-size-enabled').checked,
              op: backdrop.querySelector('#adv-size-op').value,
              value: parseFloat(backdrop.querySelector('#adv-size-val').value) || 0,
              unit: backdrop.querySelector('#adv-size-unit').value
            },
            age: {
              enabled: backdrop.querySelector('#adv-age-enabled').checked,
              op: backdrop.querySelector('#adv-age-op').value,
              days: parseInt(backdrop.querySelector('#adv-age-val').value, 10) || 30
            }
          }
        });
      } else if (act === 'cancel' || e.target === backdrop) {
        close(null);
      }
    });
  });
}