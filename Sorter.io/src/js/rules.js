// js/rules.js
import { parseExtension } from './utils.js';

const SIZE_UNITS = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

/** Category cũ có extensions nhưng chưa có advanced → dùng default */
export function normalizeCategory(cat) {
    return {
        priority: 100,
        ...cat,
        extensions: cat.extensions || [],
        advanced: {
            regex: '',
            regexFlags: 'i',
            nameContains: '',
            size: { enabled: false, op: '>', value: 100, unit: 'MB' },
            age: { enabled: false, op: 'older', days: 30 },
            ...(cat.advanced || {})
        }
    };
}

/** So khớp 1 category (chỉ ext + advanced, KHÔNG fallback) */
export function matchCategory(file, category) {
    const ext = parseExtension(file.name);

    // Wildcard ext → match tất cả
    if (category.extensions.includes('*')) return true;
    if (ext && category.extensions.includes(ext)) return true;

    const adv = category.advanced;
    if (!adv) return false;

    // Regex
    if (adv.regex) {
        try {
            const re = new RegExp(adv.regex, adv.regexFlags || 'i');
            if (re.test(file.name)) return true;
        } catch { /* regex sai → bỏ qua */ }
    }

    // Tên chứa chuỗi
    if (adv.nameContains) {
        if (file.name.toLowerCase().includes(adv.nameContains.toLowerCase())) return true;
    }

    // Kích thước
    if (adv.size?.enabled && file.size != null) {
        const bytes = adv.size.value * (SIZE_UNITS[adv.size.unit] || 1);
        if (adv.size.op === '>' && file.size > bytes) return true;
        if (adv.size.op === '<' && file.size < bytes) return true;
    }

    // Tuổi tệp
    if (adv.age?.enabled && file.lastModified) {
        const days = (Date.now() - file.lastModified) / 86400000;
        if (adv.age.op === 'older' && days > adv.age.days) return true;
        if (adv.age.op === 'newer' && days < adv.age.days) return true;
    }

    return false;
}

/** Category này có cần đọc file metadata (size/mtime) không? */
export function needsFileData(category) {
    const a = category.advanced;
    return !!(a?.size?.enabled || a?.age?.enabled);
}

/**
 * Tìm category phù hợp cho 1 file.
 * Duyệt theo priority (nhỏ trước), fallback = Others.
 */
export function findCategory(file, categories) {
    const sorted = [...categories]
        .map(normalizeCategory)
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    for (const cat of sorted) {
        if (cat.id === 'others') continue;
        if (matchCategory(file, cat)) return cat;
    }
    return sorted.find(c => c.id === 'others') || null;
}

/**
 * Kiểm tra ignore pattern (wildcard: * và ?)
 * @param {string} fileName
 * @param {string[]} patterns
 */
export function shouldIgnore(fileName, patterns) {
    if (!patterns?.length) return false;
    const name = fileName.toLowerCase();
    for (const pat of patterns) {
        if (!pat) continue;
        const trimmed = pat.trim().toLowerCase();
        if (!trimmed) continue;
        // Chuyển wildcard → regex, escape ký tự đặc biệt trước
        const rx = '^' + trimmed
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') + '$';
        try {
            if (new RegExp(rx).test(name)) return true;
        } catch { /* ignore invalid */ }
    }
    return false;
}