import { theme as antdTheme } from 'antd';
import type { Monaco } from '@monaco-editor/react';

// 取两套算法的静态 token，用于一次性注册亮/暗两个 Monaco 主题，
// 使编辑器底色与 antd 容器完全融合（默认的 vs-dark 是 #1e1e1e，会与卡片脱节）。
const lightToken = antdTheme.getDesignToken({ algorithm: antdTheme.defaultAlgorithm });
const darkToken = antdTheme.getDesignToken({ algorithm: antdTheme.darkAlgorithm });

export const MONACO_THEME_LIGHT = 'json-diff-light';
export const MONACO_THEME_DARK = 'json-diff-dark';

/** hex 颜色加透明度，用于当前行高亮、括号引导线等半透明效果 */
function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function editorColors(t: typeof lightToken) {
  // 当前行高亮与激活括号引导线：统一用浅绿（antd 语义色 colorSuccess），
  // 避免默认主题里"点击行"出现突兀的红/灰等颜色。
  // 只覆盖"线/行"相关的 token，括号字符的层级配色保留默认，避免整篇括号变色。
  const lineHighlight = withAlpha(t.colorSuccess, 0.14);
  const activeGuide = withAlpha(t.colorSuccess, 0.3);
  return {
    'editor.background': t.colorBgContainer,
    'editorGutter.background': t.colorBgContainer,
    'editor.lineHighlightBackground': lineHighlight,
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': t.colorTextQuaternary,
    'editorLineNumber.activeForeground': t.colorTextSecondary,
    'editorIndentGuide.background': t.colorBorderSecondary,
    'editorIndentGuide.activeBackground': t.colorBorder,
    'editorWidget.background': t.colorBgElevated,
    'editorWidget.border': t.colorBorderSecondary,
    // 光标所在层的括号引导线（默认按层级取红/橙等色，这里统一为浅绿）
    'editorBracketPairGuide.activeBackground1': activeGuide,
    'editorBracketPairGuide.activeBackground2': activeGuide,
    'editorBracketPairGuide.activeBackground3': activeGuide,
    'editorBracketPairGuide.activeBackground4': activeGuide,
    'editorBracketPairGuide.activeBackground5': activeGuide,
    'editorBracketPairGuide.activeBackground6': activeGuide,
  };
}

let registered = false;

/** 注册自定义 Monaco 主题，可重复调用（内部幂等） */
export function defineMonacoThemes(monaco: Monaco): void {
  if (registered) return;
  monaco.editor.defineTheme(MONACO_THEME_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: editorColors(lightToken),
  });
  monaco.editor.defineTheme(MONACO_THEME_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: editorColors(darkToken),
  });
  registered = true;
}

export function monacoThemeName(isDark: boolean): string {
  return isDark ? MONACO_THEME_DARK : MONACO_THEME_LIGHT;
}
