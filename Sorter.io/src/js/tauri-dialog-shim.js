// js/tauri-dialog-shim.js
// Override File System Access API bằng Tauri native dialog + FS plugin

let tauriReady = false;
let _createFileHandle = null;
let _createDirHandle = null;

(function initShim() {
  if (!window.__TAURI__?.dialog || !window.__TAURI__?.fs) {
    console.log('[Shim] Tauri APIs không có sẵn, dùng File System Access API gốc');
    return;
  }

  const { open } = window.__TAURI__.dialog;
  const fs = window.__TAURI__.fs;
  const SEP = '\\';

  function joinPath(dir, name) {
    if (!dir) return name;
    return dir.endsWith(SEP) ? dir + name : dir + SEP + name;
  }
  function pathName(p) {
    return p.split(/[\\/]/).filter(Boolean).pop() || p;
  }

  _createFileHandle = function (filePath) {
    return {
      kind: 'file',
      name: pathName(filePath),
      __path: filePath,
      __isShim: true,
      async queryPermission() { return 'granted'; },
      async requestPermission() { return 'granted'; },
      async getFile() {
        const data = await fs.readFile(filePath);
        let mtime = Date.now();
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtime) mtime = new Date(stat.mtime).getTime();
        } catch { /* ignore */ }
        return new File([data], pathName(filePath), { lastModified: mtime });
      },
      async createWritable() {
        const chunks = [];
        return {
          async write(data) {
            if (data instanceof File || data instanceof Blob) {
              chunks.push(new Uint8Array(await data.arrayBuffer()));
            } else if (data instanceof Uint8Array) {
              chunks.push(data);
            } else if (ArrayBuffer.isView(data)) {
              chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            } else if (data?.type === 'write' && data.data) {
              chunks.push(new Uint8Array(data.data));
            } else if (typeof data === 'string') {
              chunks.push(new TextEncoder().encode(data));
            }
          },
          async close() {
            const total = chunks.reduce((s, c) => s + c.length, 0);
            const merged = new Uint8Array(total);
            let off = 0;
            for (const c of chunks) { merged.set(c, off); off += c.length; }
            await fs.writeFile(filePath, merged);
            chunks.length = 0;
          }
        };
      },
      async move(destDirHandle, newName) {
        if (!destDirHandle?.__isShim) {
          throw new Error('Không thể move tới handle không phải shim');
        }
        await fs.rename(filePath, joinPath(destDirHandle.__path, newName));
      }
    };
  };

  _createDirHandle = function (dirPath) {
    return {
      kind: 'directory',
      name: pathName(dirPath),
      __path: dirPath,
      __isShim: true,
      async queryPermission() { return 'granted'; },
      async requestPermission() { return 'granted'; },
      async *values() {
        let entries = [];
        try {
          entries = await fs.readDir(dirPath);
        } catch (e) {
          console.warn('[Shim] readDir failed:', dirPath, e);
          return;
        }
        for (const e of entries) {
          const fullPath = joinPath(dirPath, e.name);
          yield e.isDirectory ? _createDirHandle(fullPath) : _createFileHandle(fullPath);
        }
      },
      async getFileHandle(name, opts = {}) {
        const fullPath = joinPath(dirPath, name);
        const exists = await fs.exists(fullPath);
        if (!exists && !opts.create) {
          const err = new Error(`File not found: ${name}`);
          err.name = 'NotFoundError';
          throw err;
        }
        return _createFileHandle(fullPath);
      },
      async getDirectoryHandle(name, opts = {}) {
        const fullPath = joinPath(dirPath, name);
        const exists = await fs.exists(fullPath);
        if (!exists && opts.create) {
          await fs.mkdir(fullPath);
        } else if (!exists) {
          const err = new Error(`Directory not found: ${name}`);
          err.name = 'NotFoundError';
          throw err;
        }
        return _createDirHandle(fullPath);
      },
      async removeEntry(name, opts = {}) {
        await fs.remove(joinPath(dirPath, name), { recursive: opts?.recursive !== false });
      }
    };
  };

  window.showDirectoryPicker = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Chọn thư mục'
    });
    if (!selected) {
      const err = new Error('User cancelled');
      err.name = 'AbortError';
      throw err;
    }
    console.log('[Shim] Chọn folder:', selected);
    return _createDirHandle(selected);
  };

  tauriReady = true;
  console.log('[TauriDialogShim] ✅ Đã override showDirectoryPicker');
})();

// === Export helpers ===

export function isShimHandle(h) {
  return !!h?.__isShim;
}

/** Chuyển shim handle → plain object để lưu IDB */
export function serializeHandle(handle) {
  if (isShimHandle(handle)) {
    return {
      __isShim: true,
      kind: handle.kind,
      name: handle.name,
      __path: handle.__path
    };
  }
  return handle;
}

/** Chuyển plain object → shim handle khi load từ IDB */
export function deserializeHandle(data) {
  if (data?.__isShim && tauriReady) {
    return data.kind === 'directory'
      ? _createDirHandle(data.__path)
      : _createFileHandle(data.__path);
  }
  return data;
}