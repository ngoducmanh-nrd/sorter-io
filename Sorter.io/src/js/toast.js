// js/toast.js

let container = null;

function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Thông báo');
    document.body.appendChild(container);
    return container;
}

const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>'
};

export function toast(message, { type = 'info', duration = 3200, title = '' } = {}) {
    const c = ensureContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `
    <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" aria-label="Đóng">✕</button>
  `;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    const dismiss = () => {
        if (el.dataset.dismissed) return;
        el.dataset.dismissed = '1';
        el.classList.remove('show');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    };

    el.querySelector('.toast-close').addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);
    return dismiss;
}

// Shortcuts
export const toastSuccess = (msg, opts) => toast(msg, { ...opts, type: 'success' });
export const toastError = (msg, opts) => toast(msg, { ...opts, type: 'error' });
export const toastInfo = (msg, opts) => toast(msg, { ...opts, type: 'info' });
export const toastWarning = (msg, opts) => toast(msg, { ...opts, type: 'warning' });