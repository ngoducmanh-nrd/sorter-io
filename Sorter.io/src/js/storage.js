// js/storage.js
import { normalizeCategory } from './rules.js';

const DB_NAME = 'sorter_io';
const DB_VERSION = 2;
const STORE_HANDLES = 'handles';
const STORE_HISTORY = 'history';
const STORE_LASTRUN = 'lastRun';

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_HANDLES)) {
                db.createObjectStore(STORE_HANDLES); // key-value: "source" → handle
            }
            if (!db.objectStoreNames.contains(STORE_HISTORY)) {
                const store = db.createObjectStore(STORE_HISTORY, {
                    keyPath: 'id', autoIncrement: true
                });
                store.createIndex('time', 'time');
                store.createIndex('status', 'status');
            }
            if (!db.objectStoreNames.contains(STORE_LASTRUN)) {
                db.createObjectStore(STORE_LASTRUN);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

async function getStore(name, mode = 'readonly') {
    const db = await openDB();
    return db.transaction(name, mode).objectStore(name);
}

/* ============ HANDLES ============ */

export async function saveHandle(key, handle) {
    const store = await getStore(STORE_HANDLES, 'readwrite');
    return new Promise((res, rej) => {
        const req = store.put(handle, key);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
    });
}

export async function loadHandle(key) {
    const store = await getStore(STORE_HANDLES, 'readonly');
    return new Promise((res, rej) => {
        const req = store.get(key);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
    });
}

export async function clearHandle(key) {
    const store = await getStore(STORE_HANDLES, 'readwrite');
    return new Promise((res, rej) => {
        const req = store.delete(key);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
    });
}

/* ============ HISTORY ============ */

export async function addHistory(items) {
    if (!items || !items.length) return;
    const store = await getStore(STORE_HISTORY, 'readwrite');
    return new Promise((res, rej) => {
        let pending = items.length;
        let errored = false;
        items.forEach(item => {
            const req = store.add(item);
            req.onsuccess = () => { if (--pending === 0 && !errored) res(); };
            req.onerror = () => { errored = true; rej(req.error); };
        });
    });
}

export async function getHistory({ limit, offset = 0, order = 'desc' } = {}) {
    const store = await getStore(STORE_HISTORY, 'readonly');
    return new Promise((res, rej) => {
        const out = [];
        let skipped = 0;
        const cursorReq = store.openCursor(null, order === 'desc' ? 'prev' : 'next');
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) { res(out); return; }
            if (skipped < offset) { skipped++; cursor.continue(); return; }
            out.push(cursor.value);
            if (limit && out.length >= limit) { res(out); return; }
            cursor.continue();
        };
        cursorReq.onerror = () => rej(cursorReq.error);
    });
}

export async function countHistory() {
    const store = await getStore(STORE_HISTORY, 'readonly');
    return new Promise((res, rej) => {
        const req = store.count();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

export async function clearHistory() {
    const store = await getStore(STORE_HISTORY, 'readwrite');
    return new Promise((res, rej) => {
        const req = store.clear();
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
    });
}

/* ============ SETTINGS (localStorage vì nhỏ) ============ */

const SETTINGS_KEY = 'sorter_web_settings_v2';

export function loadSettings(defaults) {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return {
            ...defaults,
            ...parsed,
            ignorePatterns: parsed.ignorePatterns || defaults.ignorePatterns || [],
            categories: defaults.categories.map(cat => {
                const saved = (parsed.categories || []).find(c => c.id === cat.id);
                const merged = saved ? { ...cat, ...saved } : cat;
                return normalizeCategory(merged);
            })
        };
    } catch (e) {
        console.warn('Load settings failed:', e);
        return defaults;
    }
}

export function saveSettings(s) {
    try {
        // Chỉ lưu categories + tên dir, KHÔNG lưu history (đã ở IndexedDB)
        const { history, ...rest } = s;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
    } catch (e) {
        console.warn('Save settings failed:', e);
    }
}

export function exportSettings(s) {
    return JSON.stringify({
        version: 2,
        exportedAt: new Date().toISOString(),
        categories: s.categories,
        sourceDirName: s.sourceDirName,
        baseDestDirName: s.baseDestDirName
    }, null, 2);
}

export function importSettings(s, jsonText) {
    const data = JSON.parse(jsonText);
    if (!data.categories || !Array.isArray(data.categories)) {
        throw new Error('File không hợp lệ: thiếu mảng categories');
    }
    return {
        ...s,
        categories: data.categories,
        sourceDirName: data.sourceDirName || '',
        baseDestDirName: data.baseDestDirName || ''
    };
}

/* ============ LAST RUN (cho Undo) ============ */

export async function saveLastRun(data) {
    // Cap 2000 moves gần nhất để không phình DB
    if (data.moves && data.moves.length > 2000) {
        data = { ...data, moves: data.moves.slice(-2000) };
    }
    const store = await getStore(STORE_LASTRUN, 'readwrite');
    return new Promise((res, rej) => {
        const req = store.put(data, 'current');
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
    });
}

export async function loadLastRun() {
    const store = await getStore(STORE_LASTRUN, 'readonly');
    return new Promise((res, rej) => {
        const req = store.get('current');
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
    });
}

export async function clearLastRun() {
    const store = await getStore(STORE_LASTRUN, 'readwrite');
    return new Promise((res, rej) => {
        const req = store.delete('current');
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
    });
}