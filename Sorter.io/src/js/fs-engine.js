// js/fs-engine.js
import {
  parseExtension, splitName, fileExists, uniqueFileName,
  getNestedDirectoryHandle
} from './utils.js';
import { findCategory, shouldIgnore, needsFileData } from './rules.js';

// js/fs-engine.js — thay thế TEMP_EXTS cũ
const TEMP_EXTS = new Set([
  '.crdownload',   // Chrome cũ
  '.crswap',       // Chrome mới (2022+) ← QUAN TRỌNG
  '.part',         // Firefox
  '.partial',      // Edge
  '.download',     // Safari
  '.opdownload',   // Opera
  '.lock',
  '.tmp',
  '.!ut',          // uTorrent
  '.aria2',        // aria2
  '.downloading',  // IDM
]);

/** File tạm downloader — bỏ qua hoàn toàn */
function isTempFile(fileName) {
  const lower = fileName.toLowerCase();
  for (const ext of TEMP_EXTS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/** Move với retry khi file bị lock */
async function moveWithRetry(entry, destHandle, finalName, maxRetries = 3) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await entry.move(destHandle, finalName);
      return;
    } catch (e) {
      lastErr = e;
      const msg = (e.message || '').toLowerCase();
      // Chỉ retry khi là lỗi lock / đang được dùng
      const isRetryable = msg.includes('locked')
                       || msg.includes('in use')
                       || msg.includes('being used');
      if (!isRetryable || i === maxRetries - 1) throw e;
      // Delay tăng dần: 500ms, 1000ms
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Match 1 file vào category (fallback util) */
export function matchCategory(fileName, categories) {
  return findCategory({ name: fileName }, categories);
}

/**
 * Quét source dir + build plan. Tên unique được RESERVE ngay ở bước này
 * để tránh race condition khi execute song song.
 */
export async function buildPlan(sourceDirHandle, categories, ctx = {}, onProgress) {
  const plan = [];
  const handleCache = new Map();       // folderPath → destHandle
  const nameReservations = new Map();  // folderPath → Set<name>
  let scanned = 0;
  const needData = categories.some(needsFileData);

  async function getDestHandle(category) {
    if (ctx.customCategoryHandles?.[category.id]) {
      return ctx.customCategoryHandles[category.id];
    }
    if (handleCache.has(category.folderName)) {
      return handleCache.get(category.folderName);
    }
    const root = ctx.baseDestDirHandle
      || await sourceDirHandle.getDirectoryHandle('Organized', { create: true });
    const h = await getNestedDirectoryHandle(root, category.folderName);
    handleCache.set(category.folderName, h);
    return h;
  }

  for await (const entry of sourceDirHandle.values()) {
    if (entry.kind !== 'file') continue;
    scanned++;

    const fileName = entry.name;
    if (isTempFile(fileName)) continue;

    const extWithDot = fileName.lastIndexOf('.') > 0
      ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      : '';

    // 1. Kiểm tra ignore patterns
    if (shouldIgnore(fileName, ctx.ignorePatterns)) continue;

    // 2. Đọc metadata file nếu có rule nâng cao cần size hoặc age
    let fileObj = { name: fileName };
    if (needData) {
      try {
        const fileData = await entry.getFile();
        fileObj = {
          name: fileName,
          size: fileData.size,
          lastModified: fileData.lastModified
        };
      } catch (e) {
        console.warn('Không đọc được metadata của tệp:', fileName, e);
      }
    }

    // 3. Phân loại bằng rules nâng cao (theo priority)
    const category = findCategory(fileObj, categories);
    if (!category) continue;

    const destHandle = await getDestHandle(category);

    // Reserve unique name tránh collision
    const resKey = category.folderName + '::' + category.id;
    if (!nameReservations.has(resKey)) nameReservations.set(resKey, new Set());
    const reserved = nameReservations.get(resKey);

    const { stem, ext } = splitName(fileName);
    let candidate = fileName;
    let counter = 1;
    while (reserved.has(candidate) || await fileExists(destHandle, candidate)) {
      candidate = `${stem} (${counter})${ext}`;
      counter++;
    }
    reserved.add(candidate);

    plan.push({
      entry, fileName, ext: extWithDot, category,
      destHandle, finalName: candidate
    });

    onProgress?.(scanned);
  }

  return plan;
}

/**
 * Thực thi plan với concurrency + abort
 */
export async function executePlan(plan, sourceDirHandle, {
  onProgress, onFileDone, signal, concurrency = 4
} = {}) {
  const results = [];
  const queue = [...plan];
  const total = plan.length;
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      if (signal?.aborted) return;
      const item = queue.shift();

      try {
        if (typeof item.entry.move === 'function') {
          await moveWithRetry(item.entry, item.destHandle, item.finalName);
        } else {
          const fileData = await item.entry.getFile();
          const target = await item.destHandle.getFileHandle(item.finalName, { create: true });
          const w = await target.createWritable();
          await w.write(fileData);
          await w.close();
          await sourceDirHandle.removeEntry(item.fileName);
        }

        const result = {
          status: 'OK',
          name: item.finalName,
          originalName: item.fileName,
          from: `${sourceDirHandle.name}/${item.fileName}`,
          to: `${item.destHandle.name}/${item.finalName}`,
          ext: item.ext,
          categoryId: item.category.id,
          folderName: item.category.folderName,
          time: Date.now()
        };
        results.push(result);
        onFileDone?.(result);
      } catch (err) {
        let friendlyMsg = err.message || 'Không thể di chuyển file';
        const msg = (err.message || '').toLowerCase();

        if (msg.includes('locked') || msg.includes('in use')) {
          friendlyMsg = 'Tệp đang được ứng dụng khác sử dụng (đang tải/chạy/scan virus)';
        } else if (msg.includes('could not be found')) {
          friendlyMsg = 'Tệp đã bị chương trình khác di chuyển hoặc xóa';
        }

        const result = {
          status: 'ERROR',
          name: item.fileName,
          originalName: item.fileName,
          from: `${sourceDirHandle.name}/${item.fileName}`,
          error: friendlyMsg,
          ext: item.ext,
          categoryId: item.category.id,
          folderName: item.category.folderName,
          time: Date.now()
        };
        results.push(result);
        onFileDone?.(result);
      }

      done++;
      onProgress?.(done, total);
    }
  }

  const n = Math.min(concurrency, plan.length);
  await Promise.all(Array(n).fill().map(worker));
  return results;
}

/**
 * Undo — khôi phục tất cả tệp OK về thư mục nguồn
 */
export async function undoLastRun(lastRun, ctx, { onProgress, signal, concurrency = 4 } = {}) {
  const moves = (lastRun.moves || []).filter(m => m.status === 'OK');
  const results = [];
  const total = moves.length;
  let done = 0;

  const queue = [...moves];
  async function worker() {
    while (queue.length > 0) {
      if (signal?.aborted) return;
      const move = queue.shift();
      const key = `${move.folderName}/${move.name}`;
      try {
        // Xác định handle nơi file đang nằm
        let srcHandle;
        if (ctx.customCategoryHandles[move.categoryId]) {
          srcHandle = ctx.customCategoryHandles[move.categoryId];
        } else {
          const root = ctx.baseDestDirHandle
            || await ctx.sourceDirHandle.getDirectoryHandle('Organized');
          srcHandle = await getNestedDirectoryHandle(root, move.folderName || '', { create: false });
        }

        const fileHandle = await srcHandle.getFileHandle(move.name);
        const fileData = await fileHandle.getFile();

        // Ghi về source với tên gốc
        const targetName = await uniqueFileName(ctx.sourceDirHandle, move.originalName);
        const target = await ctx.sourceDirHandle.getFileHandle(targetName, { create: true });
        const w = await target.createWritable();
        await w.write(fileData);
        await w.close();

        // Xóa bản ở dest
        await srcHandle.removeEntry(move.name);

        results.push({ status: 'OK', key, name: move.name, restored: targetName });
      } catch (err) {
        results.push({ status: 'ERROR', key, name: move.name, error: err.message });
      }
      done++;
      onProgress?.(done, total);
    }
  }

  const n = Math.min(concurrency, moves.length || 1);
  await Promise.all(Array(n).fill().map(worker));
  return results;
}
