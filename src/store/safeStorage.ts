/**
 * localStorage 安全包装：
 * - 隐私模式 / 配额满时读写不抛错，功能降级为“不持久化”而不是白屏；
 * - 提供带防抖的草稿写入，避免编辑器逐键落盘。
 */

/** 供 zustand persist 中间件使用的容错 storage（返回 null 表示不可用） */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 配额满或隐私模式下静默失败
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/** 草稿写入防抖句柄：同一 key 的连续写入只保留最后一次 */
const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveDraftDebounced(key: string, value: string, delay = 500): void {
  const old = draftTimers.get(key);
  if (old) clearTimeout(old);
  draftTimers.set(
    key,
    setTimeout(() => {
      draftTimers.delete(key);
      safeStorage.setItem(key, value);
    }, delay),
  );
}

export function loadDraft(key: string): string | null {
  return safeStorage.getItem(key);
}

export function clearDraft(key: string): void {
  safeStorage.removeItem(key);
}
