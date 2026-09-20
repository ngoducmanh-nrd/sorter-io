// js/updater.js
// Dùng global API của Tauri (không cần bundler)

export async function checkForUpdates({ silent = false } = {}) {
  // Không phải Tauri → skip
  if (!window.__TAURI__?.updater) {
    if (!silent) console.log('[Updater] Tauri updater API not available, skip.');
    return { checked: false };
  }

  try {
    const { check } = window.__TAURI__.updater;
    const { relaunch } = window.__TAURI__.process;

    const update = await check();

    if (!update) {
      console.log('[Updater] Đang dùng bản mới nhất.');
      return { checked: true, hasUpdate: false };
    }

    const notes = update.body || '(Không có ghi chú)';
    const message =
      `🎉 Có phiên bản mới: v${update.version}\n\n` +
      `📝 Ghi chú:\n${notes}\n\n` +
      `Cập nhật ngay bây giờ?`;

    const yes = confirm(message);
    if (!yes) {
      console.log('[Updater] User từ chối update.');
      return { checked: true, hasUpdate: true, accepted: false };
    }

    console.log('[Updater] Đang tải...');
    let downloaded = 0;
    let total = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength || 0;
          console.log(`[Updater] Bắt đầu tải: ${(total / 1024 / 1024).toFixed(2)} MB`);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength || 0;
          const pct = total ? Math.round((downloaded / total) * 100) : 0;
          console.log(`[Updater] Đang tải: ${pct}%`);
          break;
        case 'Finished':
          console.log('[Updater] Tải xong, đang cài đặt...');
          break;
      }
    });

    console.log('[Updater] Cài đặt xong, khởi động lại...');
    await relaunch();
    return { checked: true, hasUpdate: true, accepted: true, installed: true };
  } catch (err) {
    console.error('[Updater] Lỗi:', err);
    return { checked: true, error: err.message };
  }
}