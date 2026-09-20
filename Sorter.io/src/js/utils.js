// js/utils.js

/** Debounce function */
export function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

/**
 * Lấy extension, xử lý đúng dotfile (.gitignore → "")
 * @returns {string} ext không có dấu chấm, lowercase
 */
export function parseExtension(fileName) {
    const i = fileName.lastIndexOf('.');
    if (i <= 0) return ''; // dotfile hoặc không có ext
    return fileName.substring(i + 1).toLowerCase();
}

/** Tách tên file thành stem + ext (giữ dấu chấm ở ext) */
export function splitName(fileName) {
    const i = fileName.lastIndexOf('.');
    if (i <= 0) return { stem: fileName, ext: '' };
    return { stem: fileName.substring(0, i), ext: fileName.substring(i) };
}

/** Kiểm tra file tồn tại (không tạo mới) */
export async function fileExists(dirHandle, name) {
    try {
        await dirHandle.getFileHandle(name);
        return true;
    } catch {
        return false;
    }
}

/** Sinh tên file unique tránh ghi đè: "a.txt" → "a (1).txt" */
export async function uniqueFileName(dirHandle, fileName) {
    if (!(await fileExists(dirHandle, fileName))) return fileName;
    const { stem, ext } = splitName(fileName);
    let i = 1;
    while (true) {
        const candidate = `${stem} (${i})${ext}`;
        if (!(await fileExists(dirHandle, candidate))) return candidate;
        i++;
    }
}

/** Format dung lượng */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** Escape HTML chống XSS khi render tên file */
export function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/** Lấy/tạo nested directory handle từ path kiểu "HTML/css" */
export async function getNestedDirectoryHandle(parentHandle, folderPath, { create = true } = {}) {
    const parts = folderPath.split('/').filter(p => p.length > 0);
    let current = parentHandle;
    for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create });
    }
    return current;
}

/** Format thời gian timestamp ngắn gọn */
export function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('vi-VN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

/** ID ngẫu nhiên */
export function uid() {
    return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const DOWNLOAD_EXTS = ['.crswap', '.crdownload', '.part', '.partial', '.download'];
export function isDownloading(fileName) {
  const lower = fileName.toLowerCase();
  return DOWNLOAD_EXTS.some(e => lower.endsWith(e));
}