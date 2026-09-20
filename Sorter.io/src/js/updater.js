// js/updater.js
export async function checkForUpdates({ silent = false } = {}) {
  if (!window.__TAURI__?.updater) return { checked: false };

  try {
    const { check } = window.__TAURI__.updater;
    const { relaunch } = window.__TAURI__.process;

    const update = await check();

    if (!update) {
      console.log('[Updater] Đang dùng bản mới nhất.');
      return { checked: true, hasUpdate: false };
    }

    console.log('[Updater] Có bản mới:', update.version);
    // Tauri tự hiện dialog native + progress bar
    await update.downloadAndInstall();
    await relaunch();
    return { checked: true, hasUpdate: true, installed: true };
  } catch (err) {
    console.error('[Updater] Lỗi:', err);
    return { checked: true, error: err.message };
  }
}