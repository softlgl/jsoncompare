import { useCallback, useEffect, useMemo } from 'react';
import { useJsonStore } from '../store/jsonStore';
import { useViewStore } from '../store/viewStore';
import { getConfigFingerprint, makeSourceKey } from '../utils/diffEngine';
import type { AppConfig } from '../types';

/**
 * 输入或对比规则变化后自动重新对比。
 * 仅在两侧都有内容时执行；过程中输入不合法则静默跳过，不干扰正在输入的用户。
 */
export function useAutoCompare(delay = 500): void {
  const enabled = useViewStore((s) => s.config.autoCompare);
  const jsonA = useJsonStore((s) => s.jsonA);
  const jsonB = useJsonStore((s) => s.jsonB);
  const fingerprint = useViewStore((s) => getConfigFingerprint(s.config));

  useEffect(() => {
    if (!enabled) return;
    if (!jsonA.trim() || !jsonB.trim()) return;

    const timer = setTimeout(() => {
      useJsonStore.getState().runDiff(useViewStore.getState().config);
    }, delay);

    return () => clearTimeout(timer);
  }, [enabled, jsonA, jsonB, fingerprint, delay]);
}

/**
 * 修改对比规则后立即重算，让设置「所见即所得」。
 * 已有结果或两侧都有内容时才重算，避免空输入时反复提示错误。
 */
export function useRerunDiff(): (patch: Partial<AppConfig>) => void {
  return useCallback((patch: Partial<AppConfig>) => {
    const { setConfig } = useViewStore.getState();
    setConfig(patch);

    const config = useViewStore.getState().config;
    const json = useJsonStore.getState();
    if (json.diffResult || (json.jsonA.trim() && json.jsonB.trim())) {
      json.runDiff(config);
    }
  }, []);
}

/** 当前结果是否已与输入/配置脱节 */
export function useIsStale(): boolean {
  const jsonA = useJsonStore((s) => s.jsonA);
  const jsonB = useJsonStore((s) => s.jsonB);
  const comparedKey = useJsonStore((s) => s.comparedKey);
  const hasResult = useJsonStore((s) => s.diffResult !== null);
  const config = useViewStore((s) => s.config);

  return useMemo(() => {
    if (!hasResult || comparedKey === null) return false;
    return comparedKey !== makeSourceKey(jsonA, jsonB, config);
  }, [hasResult, comparedKey, jsonA, jsonB, config]);
}
