import { Card, Button, App, Segmented, Switch, Space, Alert, theme as antdTheme } from 'antd';
import {
  ThunderboltOutlined,
  CompressOutlined,
  CopyOutlined,
  ClearOutlined,
  FileTextOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useViewStore } from '../../store/viewStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { loadDraft, saveDraftDebounced, clearDraft } from '../../store/safeStorage';
import { useApplyMonacoTheme } from '../../hooks/useApplyMonacoTheme';
import { monacoThemeName } from '../../utils/monacoTheme';
import {
  formatJsonText,
  minifyJsonText,
  validateJsonText,
  getTextStats,
  removeComments,
  type BeautifyOptions,
} from '../../utils/jsonFormat';
import { exportJsonToExcel } from '../../utils/jsonToExcel';

/** 与对比模式一致：超大文件直接拒收，避免编辑器与实时校验卡死 */
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** 美化页草稿的 localStorage 键 */
const DRAFT_KEY = 'jsoncompare-beautify-draft';
const INDENT_KEY = 'jsoncompare-beautify-indent';
const COMMENTS_KEY = 'jsoncompare-beautify-comments';

/** 展示无损能力：超大整数与注释都不被破坏 */
const SAMPLE = `{
  // 大整数与高精度小数都会原样保留
  "id": 9007199254740993,
  "amount": 3.14159265358979323846,
  "list": [1, 2, 3],
  "nested": { "a": 1, "b": { "c": true } }
}`;

const indentOptions = [
  { label: '2 空格', value: '2' },
  { label: '4 空格', value: '4' },
  { label: 'Tab', value: 'tab' },
];

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  renderWhitespace: 'selection',
  scrollbar: { alwaysConsumeMouseWheel: false },
  renderLineHighlight: 'all',
  matchBrackets: 'never',
  bracketPairColorization: { enabled: false },
  guides: { indentation: true, bracketPairs: false },
  wordWrap: 'on',
};

const BeautifyView: React.FC = () => {
  // 首次挂载从草稿恢复（无则用示例）；偏好同样落盘
  const [text, setText] = useState<string>(() => loadDraft(DRAFT_KEY) ?? SAMPLE);
  const [indent, setIndent] = useState<string>(() => loadDraft(INDENT_KEY) ?? '2');
  const [allowComments, setAllowComments] = useState<boolean>(
    () => loadDraft(COMMENTS_KEY) !== 'false',
  );
  const [exporting, setExporting] = useState<boolean>(false);
  const { message } = App.useApp();
  const { token } = antdTheme.useToken();

  // 草稿防抖落盘：逐键输入不频繁写 localStorage
  useEffect(() => {
    saveDraftDebounced(DRAFT_KEY, text);
  }, [text]);
  useEffect(() => {
    saveDraftDebounced(INDENT_KEY, indent);
  }, [indent]);
  useEffect(() => {
    saveDraftDebounced(COMMENTS_KEY, String(allowComments));
  }, [allowComments]);

  const config = useViewStore((s) => s.config);
  const isDark = config.theme === 'dark';
  useApplyMonacoTheme(isDark);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 实时校验防抖：连续输入时只在停手后重算，大文档不逐键扫描
  const debouncedText = useDebouncedValue(text, 300);
  const validation = useMemo(
    () => validateJsonText(debouncedText, allowComments),
    [debouncedText, allowComments],
  );
  const stats = useMemo(() => getTextStats(text), [text]);

  const resolveOptions = (): BeautifyOptions =>
    indent === 'tab'
      ? { insertSpaces: false, tabSize: 1 }
      : { insertSpaces: true, tabSize: Number(indent) };

  const handleBeautify = () => {
    // 防抖窗口内可能刚改过内容，按钮动作前以当前文本即时校验
    const current = validateJsonText(text, allowComments);
    if (!current.valid) {
      message.error(`无法美化：${current.error ?? 'JSON 非法'}`);
      return;
    }
    setText(formatJsonText(text, resolveOptions()));
    message.success('已美化（无损：保留数字精度与注释）');
  };

  const handleMinify = () => {
    const current = validateJsonText(text, allowComments);
    if (!current.valid) {
      message.error(`无法压缩：${current.error ?? 'JSON 非法'}`);
      return;
    }
    setText(minifyJsonText(text));
    message.success('已压缩');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选择内容复制');
    }
  };

  const handleClear = () => {
    setText('');
    clearDraft(DRAFT_KEY);
  };

  const handleExportExcel = async () => {
    const current = validateJsonText(text, allowComments);
    if (!current.valid) {
      message.error(`无法导出：${current.error ?? 'JSON 非法'}`);
      return;
    }
    setExporting(true);
    try {
      // 导出面向标准 JSON：先剥掉注释（无注释时为空操作），再走统一的无损解析与精度保护
      const count = await exportJsonToExcel([{ name: 'JSON', text: removeComments(text) }]);
      message.success(`已导出 Excel（${count} 个 sheet）`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => fileInputRef.current?.click();

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      message.warning(
        `文件较大（${(file.size / 1048576).toFixed(1)} MB），为避免卡顿请拆分后导入（上限 ${Math.floor(MAX_IMPORT_BYTES / 1048576)} MB）`,
      );
      return;
    }

    try {
      const content = await file.text();
      setText(content);
      message.success(`已导入 ${file.name}`);
    } catch {
      message.error('读取文件失败');
    }
  };

  const panelStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    overflow: 'hidden' as const,
  };

  return (
    <Card
      style={{ margin: '16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      styles={{
        body: { padding: '12px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space wrap size={8}>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleBeautify} size="small">
            格式化
          </Button>
          <Button icon={<CompressOutlined />} onClick={handleMinify} size="small">
            压缩
          </Button>
          <Button icon={<CopyOutlined />} onClick={handleCopy} size="small">
            复制
          </Button>
          <Button icon={<FileTextOutlined />} onClick={handleImport} size="small">
            导入文件
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} loading={exporting} size="small">
            导出 Excel
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleClear} size="small">
            清空
          </Button>
        </Space>

        <Space wrap size={12}>
          <Segmented
            size="small"
            options={indentOptions}
            value={indent}
            onChange={(v) => setIndent(String(v))}
          />
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>允许注释(JSONC)</span>
          <Switch size="small" checked={allowComments} onChange={setAllowComments} />
        </Space>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.jsonc,.txt,application/json,text/plain"
        style={{ display: 'none' }}
        onChange={handleFilePicked}
      />

      {validation.valid ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            allowComments && validation.hasComments
              ? 'JSON 合法 · 检测到注释，压缩将移除注释（美化会保留）'
              : 'JSON 合法'
          }
        />
      ) : (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`JSON 非法：${validation.error}`}
          description={
            validation.line != null
              ? `位置：第 ${validation.line} 行，第 ${validation.column} 列（偏移 ${validation.offset}）`
              : undefined
          }
        />
      )}

      <div style={{ ...panelStyle, flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          defaultLanguage="json"
          theme={monacoThemeName(isDark)}
          value={text}
          onMount={(ed) => { editorRef.current = ed; }}
          onChange={(value) => setText(value ?? '')}
          options={{ ...editorOptions, fontSize: config.fontSize }}
          loading={<span style={{ color: token.colorTextTertiary }}>编辑器加载中…</span>}
        />
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: token.colorTextTertiary,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span>字符：{stats.chars.toLocaleString()}</span>
        <span>行数：{stats.lines.toLocaleString()}</span>
        <span>字节：{(stats.bytes / 1024).toFixed(1)} KB</span>
        <span>无损格式化：数字按原文保留、注释不被丢弃</span>
      </div>
    </Card>
  );
};

export default BeautifyView;
