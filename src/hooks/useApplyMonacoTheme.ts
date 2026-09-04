import { useEffect } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { defineMonacoThemes, monacoThemeName } from '../utils/monacoTheme';

/**
 * Monaco 实例就绪后注册自定义主题并强制应用。
 *
 * 不依赖 Editor 的 beforeMount：该回调与编辑器创建存在时序竞争，
 * 一旦主题名先于 defineTheme 生效，Monaco 会回退到内置 vs/vs-dark
 * （此时当前行高亮等会显示奇怪的红色兜底色）。
 * 这里在拿到实例后主动 define + setTheme，晚一点生效也能正确换肤。
 */
export function useApplyMonacoTheme(isDark: boolean): void {
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;
    defineMonacoThemes(monaco);
    monaco.editor.setTheme(monacoThemeName(isDark));
  }, [monaco, isDark]);
}
