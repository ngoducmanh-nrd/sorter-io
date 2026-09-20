
// js/watcher.js

let observer = null;
let pollTimer = null;
let watching = false;
let startTime = 0;

/**
 * @param {FileSystemDirectoryHandle} dir
 * @param {(name: string) => void} onNewFile
 * @returns {Promise<{mode: 'observer'|'polling'}>}
 */
export async function startWatching(dir, onNewFile) {
    if (watching) return { mode: observer ? 'observer' : 'polling' };
    watching = true;
    startTime = Date.now();

    if ('FileSystemObserver' in window) {
        try {
            observer = new window.FileSystemObserver(records => {
                for (const r of records) {
                    if (r.type !== 'appeared') continue;
                    const h = r.changedHandle;
                    if (h?.kind === 'file') onNewFile(h.name);
                }
            });
            await observer.observe(dir, { recursive: false });
            return { mode: 'observer' };
        } catch (e) {
            console.warn('FileSystemObserver failed, fallback to polling:', e);
            observer = null;
        }
    }

    // Fallback polling
    const seen = new Set();
    for await (const e of dir.values()) if (e.kind === 'file') seen.add(e.name);

    pollTimer = setInterval(async () => {
        try {
            for await (const e of dir.values()) {
                if (e.kind !== 'file') continue;
                if (!seen.has(e.name)) {
                    seen.add(e.name);
                    // Bỏ qua tệp xuất hiện trong 2s đầu (tránh dội khi vừa bật)
                    if (Date.now() - startTime > 2000) onNewFile(e.name);
                }
            }
        } catch (err) {
            console.warn('Polling error:', err);
        }
    }, 5000);

    return { mode: 'polling' };
}

export function stopWatching() {
    watching = false;
    if (observer) { try { observer.disconnect(); } catch { } observer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export function isWatching() { return watching; }