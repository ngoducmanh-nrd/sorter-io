// renderer.js — đầu file
import {
  debounce, parseExtension, uniqueFileName,
  getNestedDirectoryHandle, escapeHtml, formatTime, uid,
  isDownloading
} from './js/utils.js';

import { buildPlan, executePlan, undoLastRun } from './js/fs-engine.js';

import { normalizeCategory } from './js/rules.js';
import { startWatching, stopWatching, isWatching } from './js/watcher.js';

import {
  saveHandle, loadHandle, addHistory, getHistory,
  clearHistory, countHistory,
  loadSettings, saveSettings, exportSettings, importSettings,
  saveLastRun, loadLastRun, clearLastRun
} from './js/storage.js';

import { toast, toastSuccess, toastError, toastInfo, toastWarning } from './js/toast.js';
import { confirmDialog, promptDialog, previewDialog, advancedRulesDialog } from './js/modal.js';

// Elements cache
const els = {
  menuDash: document.getElementById('menu-dash'),
  menuRules: document.getElementById('menu-rules'),
  menuLogs: document.getElementById('menu-logs'),
  pageDashboard: document.getElementById('page-dashboard'),
  pageCategories: document.getElementById('page-categories'),
  pageLogs: document.getElementById('page-logs'),
  
  appTitleDisplay: document.getElementById('app-title-display'),
  appSubtitleDisplay: document.getElementById('app-subtitle-display'),
  
  inputSourceDir: document.getElementById('input-source-dir'),
  inputDestDir: document.getElementById('input-dest-dir'),
  btnBrowseSource: document.getElementById('btn-browse-source'),
  btnBrowseDest: document.getElementById('btn-browse-dest'),
  
  btnRunOrganizer: document.getElementById('btn-run-organizer'),
  runStatusDesc: document.getElementById('run-status-desc'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  dashboardOverlay: document.getElementById('dashboard-overlay'),
  
  statMoved: document.getElementById('stat-moved'),
  statErrors: document.getElementById('stat-errors'),
  statRulesCount: document.getElementById('stat-rules-count'),
  
  dashActivityList: document.getElementById('dash-activity-list'),
  fullActivityList: document.getElementById('full-activity-list'),
  
  btnClearDashLogs: document.getElementById('btn-clear-dash-logs'),
  btnClearAllLogs: document.getElementById('btn-clear-all-logs'),
  
  categoriesListContainer: document.getElementById('categories-list-container'),
  inputSearchCategories: document.getElementById('input-search-categories'),
  btnMobileMenu: document.getElementById('btn-mobile-menu'),
  appSidebar: document.getElementById('app-sidebar'),

  runProgress: document.getElementById('run-progress'),
  runProgressFill: document.getElementById('run-progress-fill'),
  runProgressText: document.getElementById('run-progress-text'),
  btnUndoLastRun: document.getElementById('btn-undo-lastrun'),
  inputIgnorePatterns: document.getElementById('input-ignore-patterns'),
  toggleWatch: document.getElementById('toggle-watch')
};

let currentAbort = null;

// Global FileSystem Directory Handles (Kept in Browser Memory)
let sourceDirHandle = null;
let baseDestDirHandle = null;
const customCategoryHandles = {};

// Default Settings State
let settings = {
  sourceDirName: '',
  baseDestDirName: '',
  autoRun: false,
  watchEnabled: false,
  ignorePatterns: ['*.bak', '*.tmp', 'thumbs.db', 'desktop.ini', '.DS_Store'],
  categories: [
    {
      id: 'install',
      name: 'Bộ Cài Đặt (Install)',
      folderName: 'Install',
      extensions: ['exe', 'msi', 'dmg', 'pkg', 'apk', 'deb'],
      themeClass: 'cat-install',
      customPathName: ''
    },
    {
      id: 'pictures',
      name: 'Hình Ảnh (Pictures)',
      folderName: 'Pictures',
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'psd', 'ai'],
      themeClass: 'cat-picture',
      customPathName: ''
    },
    {
      id: 'media',
      name: 'Phim & Âm Nhạc (Media)',
      folderName: 'Media',
      extensions: ['mp3', 'wav', 'mp4', 'mkv', 'avi', 'mov', 'flac', 'ogg', 'webm', 'm4a'],
      themeClass: 'cat-media',
      customPathName: ''
    },
    {
      id: 'documents',
      name: 'Tài Liệu (Documents)',
      folderName: 'Documents',
      extensions: ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'epub', 'doc', 'xls', 'ppt'],
      themeClass: 'cat-document',
      customPathName: ''
    },
    {
      id: 'archives',
      name: 'File Nén (Archives)',
      folderName: 'Archives',
      extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'iso'],
      themeClass: 'cat-archive',
      customPathName: ''
    },
    {
      id: 'markdown',
      name: 'Tài Liệu Markdown (Markdown)',
      folderName: 'Markdown',
      extensions: ['md', 'markdown'],
      themeClass: 'cat-document',
      customPathName: ''
    },
    {
      id: 'html_index',
      name: 'HTML Web Pages (Index)',
      folderName: 'HTML/index',
      extensions: ['html', 'htm'],
      themeClass: 'cat-picture',
      customPathName: ''
    },
    {
      id: 'html_css',
      name: 'CSS Stylesheets (CSS)',
      folderName: 'HTML/css',
      extensions: ['css'],
      themeClass: 'cat-picture',
      customPathName: ''
    },
    {
      id: 'html_json',
      name: 'JSON Data (Json)',
      folderName: 'HTML/json',
      extensions: ['json'],
      themeClass: 'cat-picture',
      customPathName: ''
    },
    {
      id: 'python',
      name: 'Mã Nguồn Python (Codes/Python)',
      folderName: 'Codes/Python',
      extensions: ['py', 'pyw', 'ipynb'],
      themeClass: 'cat-install',
      customPathName: ''
    },
    {
      id: 'cpp',
      name: 'Mã Nguồn C/C++ (Codes/C_CPP)',
      folderName: 'Codes/C_CPP',
      extensions: ['cpp', 'hpp', 'c', 'h', 'cc', 'cxx'],
      themeClass: 'cat-media',
      customPathName: ''
    },
    {
      id: 'javascript',
      name: 'Mã Nguồn JS/TS (Codes/JS)',
      folderName: 'Codes/JS',
      extensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'],
      themeClass: 'cat-install',
      customPathName: ''
    },
    {
      id: 'others',
      name: 'Tệp Khác (Others)',
      folderName: 'Others',
      extensions: ['*'],
      themeClass: 'cat-other',
      customPathName: ''
    }
  ],
  history: []
};

// Initialize Web Application
async function init() {
  if (!('showDirectoryPicker' in window)) showBrowserSupportWarning();

  // Load settings
  settings = loadSettings(settings);

  // === RESTORE HANDLES TỪ INDEXEDDB ===
  try {
    const savedSource = await loadHandle('source');
    if (savedSource) {
      sourceDirHandle = savedSource;
      // queryPermission không cần user gesture
      const perm = await savedSource.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        // Đánh dấu cần xin lại quyền (không auto request vì cần user gesture)
        settings._needsReauth = true;
        toastInfo(`Đã khôi phục thư mục "${savedSource.name}". Nhấn BẮT ĐẦU để cấp lại quyền.`);
      }
    }
    const savedDest = await loadHandle('dest');
    if (savedDest) baseDestDirHandle = savedDest;

    for (const cat of settings.categories) {
      if (cat.customPathName) {
        const catH = await loadHandle('cat_' + cat.id);
        if (catH) customCategoryHandles[cat.id] = catH;
      }
    }
  } catch (e) {
    console.warn('Restore handles failed:', e);
  }

  // Khôi phục Watch nếu đã bật trước đó
  if (settings.watchEnabled && sourceDirHandle) {
    try {
      const perm = await sourceDirHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await startWatching(sourceDirHandle, onWatchNewFile);
        els.toggleWatch.checked = true;
        toastInfo('Đã khôi phục chế độ Watch');
      } else {
        els.toggleWatch.checked = false;
        settings.watchEnabled = false;
        saveSettings(settings);
      }
    } catch (e) { console.warn(e); }
  }

  updateInputs();
  renderCategories();
  await renderHistory();
  await updateStats();
  await refreshUndoButton();
  setupEventListeners();

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Display warning if browser does not support directory picking
function showBrowserSupportWarning() {
  const warningBanner = document.createElement('div');
  warningBanner.style.cssText = `
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #fca5a5;
    padding: 12px 16px;
    border-radius: 12px;
    margin-bottom: 20px;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  warningBanner.innerHTML = `
    <span>⚠️ <strong>Cảnh báo tương thích:</strong> Trình duyệt của bạn hiện chưa hỗ trợ <i>File System Access API</i>. Vui lòng sử dụng <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> hoặc <strong>Brave</strong> để sử dụng tính năng chọn thư mục trên máy tính!</span>
  `;
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.insertBefore(warningBanner, mainContent.children[1]);
  }
}

// Update directory inputs in DOM
function updateInputs() {
  els.inputSourceDir.value = sourceDirHandle
    ? `📂 ${sourceDirHandle.name}`
    : (settings.sourceDirName ? `📂 ${settings.sourceDirName} (Cần chọn lại)` : '');
  els.inputDestDir.value = baseDestDirHandle
    ? `📂 ${baseDestDirHandle.name}`
    : (settings.baseDestDirName ? `📂 ${settings.baseDestDirName}` : 'Mặc định: thư mục con "Organized"');

  if (els.inputIgnorePatterns) {
    els.inputIgnorePatterns.value = (settings.ignorePatterns || []).join('\n');
  }
  if (els.toggleWatch) {
    els.toggleWatch.checked = !!settings.watchEnabled;
  }
}

// Update stats panel
async function updateStats() {
  // Đếm OK / ERROR từ IDB thay vì filter mảng trong RAM
  const all = await getHistory({ order: 'desc' });
  const totalMoved = all.filter(i => i.status === 'OK').length;
  const totalErrors = all.filter(i => i.status === 'ERROR').length;
  els.statMoved.innerText = totalMoved;
  els.statErrors.innerText = totalErrors;
  els.statRulesCount.innerText = settings.categories.length;
}

let watchDebounceTimer = null;
function onWatchNewFile(fileName) {
  clearTimeout(watchDebounceTimer);
  watchDebounceTimer = setTimeout(async () => {
    if (els.btnRunOrganizer.classList.contains('running')) return;
    toastInfo(`Phát hiện tệp mới: ${fileName}`, { title: 'Watch' });
    await runOrganizer({ skipPreview: true, silent: true });
  }, 1500);
}

// Event Listeners setup
function setupEventListeners() {
  // Navigation Menu Toggling
  const navItems = [els.menuDash, els.menuRules, els.menuLogs];
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      const targetPage = item.getAttribute('data-page');
      
      document.querySelectorAll('.page-view').forEach(page => {
        page.classList.remove('active');
      });
      document.getElementById(targetPage).classList.add('active');
      
      if (targetPage === 'page-dashboard') {
        els.appTitleDisplay.innerText = 'Tổng Quan';
        els.appSubtitleDisplay.innerText = 'Quản lý và tự động sắp xếp tập tin nhanh chóng trên Web';
      } else if (targetPage === 'page-categories') {
        els.appTitleDisplay.innerText = 'Cấu Hình Quy Tắc';
        els.appSubtitleDisplay.innerText = 'Thiết lập định dạng tập tin và vị trí lưu trữ';
      } else if (targetPage === 'page-logs') {
        els.appTitleDisplay.innerText = 'Lịch Sử Hoạt Động';
        els.appSubtitleDisplay.innerText = 'Theo dõi chi tiết các file đã phân loại';
      }

      // Close mobile menu on navigate
      if (els.appSidebar && els.appSidebar.classList.contains('open')) {
        els.appSidebar.classList.remove('open');
      }
    });
  });

  // Mobile menu toggle
  if (els.btnMobileMenu && els.appSidebar) {
    els.btnMobileMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      els.appSidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!els.appSidebar.contains(e.target) && e.target !== els.btnMobileMenu) {
        els.appSidebar.classList.remove('open');
      }
    });
  }

  // Filter Categories Search
  if (els.inputSearchCategories) {
    els.inputSearchCategories.addEventListener(
      'input',
      debounce(e => renderCategories(e.target.value), 180)
    );
  }

  // Source Folder Selector (Web Directory Picker)
  els.btnBrowseSource.addEventListener('click', async () => {
    if (!('showDirectoryPicker' in window)) {
      toastError('Trình duyệt không hỗ trợ chọn thư mục. Vui lòng dùng Chrome / Edge / Brave.');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      sourceDirHandle = handle;
      settings.sourceDirName = handle.name;
      await saveHandle('source', handle);   // ← LƯU VÀO IDB
      updateInputs();
      saveSettings(settings);
      toastSuccess(`Đã chọn thư mục nguồn: ${handle.name}`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        toastError(`Không thể truy cập thư mục: ${err.message}`);
      }
    }
  });

  // Destination Folder Selector
  els.btnBrowseDest.addEventListener('click', async () => {
    if (!('showDirectoryPicker' in window)) {
      toastError('Trình duyệt không hỗ trợ chọn thư mục. Vui lòng dùng Chrome / Edge / Brave.');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      baseDestDirHandle = handle;
      settings.baseDestDirName = handle.name;
      await saveHandle('dest', handle);   // ← LƯU VÀO IDB
      updateInputs();
      saveSettings(settings);
      toastSuccess(`Đã chọn thư mục đích: ${handle.name}`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        toastError(`Không thể truy cập thư mục: ${err.message}`);
      }
    }
  });

  // Run Organizer / Pause-Stop unified button
  els.btnRunOrganizer.addEventListener('click', () => {
    if (els.btnRunOrganizer.classList.contains('running')) {
      if (currentAbort) {
        currentAbort.abort();
        els.btnRunOrganizer.classList.add('stopping');
        els.btnRunOrganizer.innerHTML = `
          <svg viewBox="0 0 24 24" style="fill:none;"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-dasharray="28 28"/></svg>
          <span>ĐANG DỪNG...</span>
        `;
        toastWarning('Đã yêu cầu dừng — vui lòng đợi các tệp đang xử lý xong.');
      }
      return;
    }
    runOrganizer();
  });

  // Undo
  els.btnUndoLastRun.addEventListener('click', handleUndo);

  // Ignore patterns
  els.inputIgnorePatterns?.addEventListener('input', debounce(e => {
    settings.ignorePatterns = e.target.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    saveSettings(settings);
  }, 400));

  // Watch toggle
  els.toggleWatch?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      if (!sourceDirHandle) {
        toastInfo('Chọn thư mục nguồn trước khi bật Watch.');
        e.target.checked = false;
        return;
      }
      const { mode } = await startWatching(sourceDirHandle, onWatchNewFile);
      settings.watchEnabled = true;
      saveSettings(settings);
      toastSuccess(
        mode === 'observer'
          ? 'Đã bật Watch (tự động phân loại tệp mới)'
          : 'Đã bật Watch chế độ polling (mỗi 5 giây)',
        { title: 'Theo dõi thư mục' }
      );
    } else {
      stopWatching();
      settings.watchEnabled = false;
      saveSettings(settings);
      toastInfo('Đã tắt Watch');
    }
  });

  // Clean dashboard / logs histories
  els.btnClearDashLogs.addEventListener('click', clearHistoryLogs);
  els.btnClearAllLogs.addEventListener('click', clearHistoryLogs);

  // Export configuration
  document.getElementById('btn-export-config')?.addEventListener('click', () => {
    const blob = new Blob([exportSettings(settings)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sorter-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toastSuccess('Đã xuất cấu hình');
  });

  // Import configuration
  document.getElementById('btn-import-config')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        settings = importSettings(settings, text);
        saveSettings(settings);
        renderCategories();
        await updateStats();
        toastSuccess('Đã nhập cấu hình thành công');
      } catch (e) {
        toastError(`File không hợp lệ: ${e.message}`);
      }
    };
    input.click();
  });
}

// Clear all execution logs
async function clearHistoryLogs() {
  const ok = await confirmDialog({
    title: 'Xóa toàn bộ lịch sử?',
    message: 'Hành động này không thể hoàn tác. Lịch sử phân loại sẽ bị xóa vĩnh viễn.',
    confirmText: 'Xóa',
    danger: true
  });
  if (!ok) return;

  await clearHistory();
  await clearLastRun();
  await renderHistory();
  await updateStats();
  await refreshUndoButton();
  toastSuccess('Đã xóa lịch sử phân loại');
}

// Add extension to category
function addExtension(catId, inputEl) {
  const rawExt = inputEl.value.trim().toLowerCase();
  if (!rawExt) return;
  
  const ext = rawExt.startsWith('.') ? rawExt.substring(1) : rawExt;
  if (!ext) return;

  const category = settings.categories.find(c => c.id === catId);
  if (category) {
    if (!category.extensions.includes(ext)) {
      category.extensions.push(ext);
      saveSettings(settings);
      renderCategories();
      inputEl.value = '';
    } else {
      toastWarning('Định dạng này đã tồn tại trong danh mục!');
    }
  }
}

// Remove extension from category
function removeExtension(catId, ext) {
  const category = settings.categories.find(c => c.id === catId);
  if (category) {
    category.extensions = category.extensions.filter(e => e !== ext);
    saveSettings(settings);
    renderCategories();
  }
}

// Choose custom destination directory for specific category
async function chooseCustomCategoryPath(catId) {
  if (!('showDirectoryPicker' in window)) {
    toastError('Trình duyệt của bạn không hỗ trợ tính năng này. Vui lòng dùng Chrome / Edge / Brave.');
    return;
  }
  const category = settings.categories.find(c => c.id === catId);
  if (!category) return;

  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    customCategoryHandles[catId] = handle;
    category.customPathName = handle.name;
    await saveHandle('cat_' + catId, handle);
    saveSettings(settings);
    renderCategories();
    toastSuccess(`Đã lưu đường dẫn riêng: ${handle.name}`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      toastError(`Không thể truy cập thư mục: ${err.message}`);
    }
  }
}

// Reset category custom path
async function resetCategoryPath(catId) {
  const category = settings.categories.find(c => c.id === catId);
  if (category) {
    category.customPathName = '';
    delete customCategoryHandles[catId];
    await clearHandle('cat_' + catId);
    saveSettings(settings);
    renderCategories();
    toastInfo(`Đã khôi phục đường dẫn mặc định cho ${category.name}`);
  }
}

// Render configuration cards for categories
function renderCategories(filterQuery = '') {
  els.categoriesListContainer.innerHTML = '';
  const query = filterQuery.trim().toLowerCase();

  const filteredCategories = settings.categories.filter(cat => {
    if (!query) return true;
    const matchName = cat.name.toLowerCase().includes(query);
    const matchFolder = cat.folderName.toLowerCase().includes(query);
    const matchExt = cat.extensions.some(e => e.toLowerCase().includes(query));
    return matchName || matchFolder || matchExt;
  });

  if (filteredCategories.length === 0) {
    els.categoriesListContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 0;">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Không tìm thấy danh mục hoặc đuôi file nào khớp với "${filterQuery}".</p>
      </div>
    `;
    return;
  }
  
  filteredCategories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'panel category-card';
    
    let pathDisplay = '';
    if (cat.customPathName) {
      pathDisplay = `Custom: ${cat.customPathName}`;
    } else if (baseDestDirHandle) {
      pathDisplay = `${baseDestDirHandle.name}/${cat.folderName}`;
    } else if (sourceDirHandle) {
      pathDisplay = `${sourceDirHandle.name}/Organized/${cat.folderName}`;
    } else {
      pathDisplay = `[Mặc định] Organized/${cat.folderName}`;
    }

    const isCustom = !!cat.customPathName;
    
    const badgesHtml = cat.extensions.map(ext => `
      <span class="ext-badge">
        .${ext}
        ${cat.id !== 'others' ? `<span class="ext-badge-remove" data-cat="${cat.id}" data-ext="${ext}" title="Xóa đuôi file này">✕</span>` : ''}
      </span>
    `).join('');

    const hasAdvanced = (() => {
      const a = cat.advanced;
      if (!a) return false;
      return !!(a.regex || a.nameContains || a.size?.enabled || a.age?.enabled);
    })();

    card.innerHTML = `
      <div class="category-card-header">
        <h3 class="category-title">
          <span class="category-title-icon ${cat.themeClass} ${hasAdvanced ? 'has-advanced' : ''}">
            ${cat.folderName.substring(0,2).toUpperCase()}
          </span>
          ${cat.name}
        </h3>
        <div style="display:flex; gap:6px;">
          ${cat.id !== 'others' ? `
            <button class="btn-icon" id="adv-btn-${cat.id}" title="Quy tắc nâng cao">⚙️ Nâng cao</button>
          ` : ''}
          ${isCustom ? `
            <button class="btn btn-small btn-danger" style="padding: 4px 8px; font-size: 0.72rem;" id="reset-path-${cat.id}">Khôi phục</button>
          ` : ''}
        </div>
      </div>
      
      <div class="category-path-label" id="path-lbl-${cat.id}" title="Nhấp để chỉ định thư mục riêng cho mục này">
        📂 ${pathDisplay}
      </div>

      <div class="extensions-header">Định dạng file liên kết (${cat.extensions.length}):</div>
      <div class="extensions-list">
        ${badgesHtml || '<span style="color: var(--text-subtle); font-size: 0.78rem;">(Chưa có đuôi file nào)</span>'}
      </div>

      ${cat.id !== 'others' ? `
        <div class="ext-add-form">
          <input type="text" placeholder="Thêm đuôi file (vd: pdf, docx)..." class="ext-input" id="ext-input-${cat.id}">
          <button class="btn btn-primary btn-small" id="ext-btn-${cat.id}">Thêm</button>
        </div>
      ` : `
        <div style="margin-top: auto; font-size: 0.78rem; color: var(--text-muted); text-align: center; padding-top: 8px;">
          <i>Hạng mục này chứa tất cả các tệp không khớp với các quy tắc trên.</i>
        </div>
      `}
    `;

    els.categoriesListContainer.appendChild(card);

    if (cat.id !== 'others') {
      document.getElementById(`adv-btn-${cat.id}`)?.addEventListener('click', async () => {
        const result = await advancedRulesDialog(cat);
        if (!result) return;
        Object.assign(cat, result);
        saveSettings(settings);
        renderCategories(els.inputSearchCategories.value);
        toastSuccess(`Đã lưu quy tắc cho "${cat.name}"`);
      });
    }

    document.getElementById(`path-lbl-${cat.id}`).addEventListener('click', () => {
      chooseCustomCategoryPath(cat.id);
    });

    if (isCustom) {
      document.getElementById(`reset-path-${cat.id}`).addEventListener('click', (e) => {
        e.stopPropagation();
        resetCategoryPath(cat.id);
      });
    }

    if (cat.id !== 'others') {
      const input = document.getElementById(`ext-input-${cat.id}`);
      const btn = document.getElementById(`ext-btn-${cat.id}`);
      
      btn.addEventListener('click', () => addExtension(cat.id, input));
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addExtension(cat.id, input);
      });
    }
  });

  document.querySelectorAll('.ext-badge-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.getAttribute('data-cat');
      const ext = btn.getAttribute('data-ext');
      removeExtension(catId, ext);
    });
  });
}

// Helper: Render empty state markup
function emptyStateHTML(message = 'Chưa có tập tin nào được xử lý.') {
  return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

// Render execution logs
async function renderHistory() {
  const generateHTML = (items) => {
    if (!items.length) return emptyStateHTML('Chưa có tập tin nào được xử lý.');

    return items.map(item => {
      const isOK = item.status === 'OK';
      const downloading = isDownloading(item.name);
      const badgeClass = downloading
        ? 'activity-badge-warning'
        : (isOK ? 'activity-badge-success' : 'activity-badge-error');
      const badgeText = downloading
        ? '⏳ Đang tải'
        : (isOK ? '✓ Thành công' : '✕ Thất bại');

      const extName = (item.ext || '').replace('.', '').toUpperCase() || 'FILE';
      let themeClass = 'cat-other';
      if (isOK) {
        const found = settings.categories.find(c => c.extensions.includes(item.ext.replace('.', '')));
        if (found) themeClass = found.themeClass;
      }
      return `
        <div class="activity-item">
          <div class="activity-item-details">
            <div class="activity-file-icon ${themeClass}">${escapeHtml(extName.substring(0,4))}</div>
            <div style="overflow:hidden; min-width:0;">
              <div class="activity-file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
              <div class="activity-file-paths">
                ${isOK
                  ? `<span>${escapeHtml(item.from)}</span> → <span>${escapeHtml(item.to)}</span>`
                  : `Lỗi: ${escapeHtml(item.error || 'Thất bại')}`}
              </div>
            </div>
          </div>
          <div>
            <span class="activity-badge ${badgeClass}">
              ${badgeText}
            </span>
          </div>
        </div>
      `;
    }).join('');
  };

  const dashItems = await getHistory({ limit: 5, order: 'desc' });
  els.dashActivityList.innerHTML = generateHTML(dashItems);

  const fullItems = await getHistory({ limit: 500, order: 'desc' });
  els.fullActivityList.innerHTML = generateHTML(fullItems);
}

// Core Web File System Access Organizer Engine
async function runOrganizer(opts = {}) {
  const { skipPreview = false, silent = false } = opts;
  if (els.btnRunOrganizer.classList.contains('running')) return;

  // 1. Source dir
  if (!sourceDirHandle) {
    toastInfo('Vui lòng chọn thư mục nguồn.');
    try {
      sourceDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      settings.sourceDirName = sourceDirHandle.name;
      await saveHandle('source', sourceDirHandle);
      updateInputs();
      saveSettings(settings);
    } catch { return; }
  }

  // 2. Permission
  try {
    const opts = { mode: 'readwrite' };
    let perm = await sourceDirHandle.queryPermission(opts);
    if (perm !== 'granted') perm = await sourceDirHandle.requestPermission(opts);
    if (perm !== 'granted') {
      toastError('Cần cấp quyền đọc/ghi.');
      return;
    }
  } catch (e) {
    console.error(e);
    toastError('Không kiểm tra được quyền thư mục.');
    return;
  }

  // 3. UI running
  currentAbort = new AbortController();
  els.btnRunOrganizer.classList.add('running');
  els.btnRunOrganizer.classList.remove('stopping');
  els.btnRunOrganizer.innerHTML = `
    <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
    <span>TẠM DỪNG</span>
  `;
  els.runStatusDesc.innerText = 'Đang quét thư mục...';
  els.statusDot.className = 'status-indicator status-running';
  els.statusText.innerText = 'Đang xử lý';
  els.dashboardOverlay.classList.add('active');

  try {
    // 4. Build plan (dry-run data)
    const plan = await buildPlan(sourceDirHandle, settings.categories, {
      baseDestDirHandle,
      customCategoryHandles,
      ignorePatterns: settings.ignorePatterns
    });

    if (currentAbort.signal.aborted) return;

    if (plan.length === 0) {
      if (!silent) toastInfo('Không có tệp nào cần phân loại.');
      return;
    }

    // 5. Preview
    if (!skipPreview) {
      const uniqFolders = new Set(plan.map(p => p.category.folderName)).size;
      const summary = `Sẽ di chuyển ${plan.length} tệp vào ${uniqFolders} thư mục.`;
      const ok = await previewDialog({
        items: plan.map(p => ({ fileName: p.fileName, ext: p.ext, category: p.category })),
        summary
      });
      if (!ok) {
        toastInfo('Đã hủy thao tác.');
        return;
      }
    }

    if (currentAbort.signal.aborted) return;

    // 6. Execute
    els.runProgress.hidden = false;
    updateProgress(0, plan.length);
    els.runStatusDesc.innerText = `Đang xử lý 0/${plan.length}...`;

    const results = await executePlan(plan, sourceDirHandle, {
      signal: currentAbort.signal,
      concurrency: 4,
      onProgress: (done, total) => {
        updateProgress(done, total);
        els.runStatusDesc.innerText = `Đang xử lý ${done}/${total}...`;
      }
    });

    const okCount = results.filter(r => r.status === 'OK').length;
    const errCount = results.filter(r => r.status === 'ERROR').length;

    if (results.length > 0) {
      await addHistory(results);
      if (silent) {
        // Watch run → GỘP vào lastRun hiện có
        const existing = await loadLastRun();
        const merged = existing
          ? { ...existing, moves: [...(existing.moves || []), ...results], timestamp: Date.now() }
          : { timestamp: Date.now(), categories: settings.categories, moves: results };
        await saveLastRun(merged);
      } else {
        // Manual run → tạo lastRun MỚI
        await saveLastRun({
          timestamp: Date.now(),
          categories: settings.categories,
          moves: results
        });
      }
      await refreshUndoButton();
    }

    if (!silent) {
      if (currentAbort.signal.aborted) {
        toastWarning(`Đã dừng. Đã xử lý ${results.length}/${plan.length} tệp.`);
      } else {
        toastSuccess(`Đã di chuyển ${okCount} tệp${errCount ? `, ${errCount} lỗi` : ''}`,
          { title: 'Phân loại hoàn tất' });
      }
      if (okCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Sắp xếp hoàn tất!', { body: `Đã di chuyển ${okCount} tệp.` });
      }
    }

    await renderHistory();
    await updateStats();
    els.runStatusDesc.innerText = `Hoàn tất! ${okCount} thành công, ${errCount} lỗi.`;
  } catch (err) {
    console.error(err);
    toastError(`Lỗi: ${err.message}`);
  } finally {
    resetRunUI();
  }
}

/* ===== Helpers cho run UI ===== */

function resetRunUI() {
  currentAbort = null;
  els.btnRunOrganizer.classList.remove('running', 'stopping');
  els.btnRunOrganizer.innerHTML = `
    <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
    <span>BẮT ĐẦU</span>
  `;
  els.dashboardOverlay.classList.remove('active');
  els.statusDot.className = 'status-indicator status-idle';
  els.statusText.innerText = 'Sẵn Sàng';
  setTimeout(() => {
    els.runProgress.hidden = true;
    updateProgress(0, 0);
    if (els.runStatusDesc.innerText.startsWith('Hoàn tất')) {
      els.runStatusDesc.innerText = 'Nhấp để phân loại tự động';
    }
  }, 2500);
}

function updateProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  els.runProgressFill.style.width = pct + '%';
  els.runProgressText.innerText = `${done} / ${total} (${pct}%)`;
}

async function refreshUndoButton() {
  const last = await loadLastRun();
  const okCount = last?.moves?.filter(m => m.status === 'OK').length || 0;
  els.btnUndoLastRun.disabled = okCount === 0;
  if (okCount > 0) {
    els.btnUndoLastRun.title =
      `Hoàn tác ${okCount} tệp từ ${new Date(last.timestamp).toLocaleString('vi-VN')}`;
  } else {
    els.btnUndoLastRun.title = 'Không có gì để hoàn tác';
  }
}

async function handleUndo() {
  const last = await loadLastRun();
  if (!last) return;

  const okCount = last.moves.filter(m => m.status === 'OK').length;
  const confirmed = await confirmDialog({
    title: 'Hoàn tác lần chạy cuối?',
    message: `Sẽ khôi phục ${okCount} tệp về thư mục nguồn.\nHành động này không thể hoàn tác lại.`,
    confirmText: 'Hoàn tác',
    danger: true
  });
  if (!confirmed) return;

  // === Verify handles trước khi chạy ===
  if (!sourceDirHandle) {
    toastError('Cần chọn lại thư mục nguồn trước khi hoàn tác.');
    return;
  }

  try {
    const opts = { mode: 'readwrite' };
    for (const [name, h] of [['nguồn', sourceDirHandle], ['đích', baseDestDirHandle]]) {
      if (!h) continue;
      let perm = await h.queryPermission(opts);
      if (perm !== 'granted') perm = await h.requestPermission(opts);
      if (perm !== 'granted') {
        toastError(`Cần cấp quyền đọc/ghi cho thư mục ${name}.`);
        return;
      }
    }
  } catch (e) {
    console.error(e);
    toastError('Không kiểm tra được quyền thư mục.');
    return;
  }

  // === UI running ===
  currentAbort = new AbortController();
  els.btnUndoLastRun.disabled = true;
  els.btnRunOrganizer.classList.add('running');
  els.btnRunOrganizer.classList.remove('stopping');
  els.btnRunOrganizer.innerHTML = `
    <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
    <span>TẠM DỪNG</span>
  `;
  els.runProgress.hidden = false;
  els.runStatusDesc.innerText = `Đang hoàn tác 0/${okCount}...`;
  els.statusDot.className = 'status-indicator status-running';
  els.statusText.innerText = 'Đang hoàn tác';
  updateProgress(0, okCount);

  try {
    const results = await undoLastRun(last, {
      sourceDirHandle,
      baseDestDirHandle,
      customCategoryHandles
    }, {
      signal: currentAbort.signal,
      onProgress: (done, total) => {
        updateProgress(done, total);
        els.runStatusDesc.innerText = `Đang hoàn tác ${done}/${total}...`;
      }
    });

    const okRestored = results.filter(r => r.status === 'OK').length;
    const errRestored = results.filter(r => r.status === 'ERROR').length;

    // === Báo cáo chi tiết ===
    if (currentAbort.signal.aborted) {
      toastWarning(`Đã dừng hoàn tác. Đã khôi phục ${okRestored}/${okCount} tệp.`);
    } else if (errRestored > 0) {
      const failedList = results
        .filter(r => r.status === 'ERROR')
        .slice(0, 5)
        .map(r => `• ${r.name}: ${r.error}`)
        .join('\n');
      toastWarning(
        `${okRestored} thành công, ${errRestored} lỗi.\n${failedList}${errRestored > 5 ? '\n...' : ''}`,
        { title: 'Hoàn tác một phần', duration: 8000 }
      );
    } else {
      toastSuccess(`Đã khôi phục ${okRestored} tệp`, { title: 'Hoàn tác hoàn tất' });
    }

    // Những move chưa được khôi phục thành công (chưa chạy hoặc lỗi)
    const successfulKeys = new Set(
      results.filter(r => r.status === 'OK').map(r => r.key)
    );
    const remainingMoves = last.moves.filter(m =>
      m.status === 'OK' && !successfulKeys.has(`${m.folderName}/${m.name}`)
    );

    if (remainingMoves.length === 0 && !currentAbort.signal.aborted) {
      await clearLastRun();
    } else if (remainingMoves.length > 0) {
      await saveLastRun({
        ...last,
        moves: remainingMoves,
        timestamp: Date.now()
      });
    } else {
      await clearLastRun();
    }

    await renderHistory();
    await updateStats();
  } catch (err) {
    console.error(err);
    toastError(`Hoàn tác thất bại: ${err.message}`);
  } finally {
    resetRunUI();
    await refreshUndoButton();
  }
}

// Start Web application
document.addEventListener('DOMContentLoaded', init);
