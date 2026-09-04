import { Card, Button, App, Checkbox, Badge, Tooltip, theme as antdTheme } from 'antd';
import { SwapOutlined, PlayCircleOutlined, ClearOutlined, FilterOutlined, FileTextOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { useViewStore } from '../../store/viewStore';
import { validateJson, formatJson, flattenDiff } from '../../utils/diffEngine';
import { useRerunDiff, useIsStale } from '../../hooks/useDiffActions';
import { useDiffMarks } from '../../hooks/useDiffMarks';
import { useApplyMonacoTheme } from '../../hooks/useApplyMonacoTheme';
import { monacoThemeName } from '../../utils/monacoTheme';
import IgnoreFields from './IgnoreFields';

/** 导入 JSON 文件的大小上限，避免超大文件撑爆界面 */
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const editorCommonOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  renderWhitespace: 'selection' as const,
  scrollbar: { alwaysConsumeMouseWheel: false },
  // 点击行后 Monaco 会给当前行/括号画附加标记（默认带红黄等层级色），
  // 对 JSON 编辑场景属于视觉噪音，统一关掉或弱化：
  renderLineHighlight: 'all' as const, // 当前行背景改用主题的浅绿
  matchBrackets: 'never', // 不额外描画匹配括号边框/背景
  bracketPairColorization: { enabled: false }, // 不给括号按层级上色
  guides: { indentation: true, bracketPairs: false }, // 不画括号引导线
  occurrencesHighlight: 'off', // 点击单词不高亮同类出现
  selectionHighlight: false, // 不高亮与选区相同的文本
};

const InputSection: React.FC = () => {
  const jsonA = useJsonStore((s) => s.jsonA);
  const jsonB = useJsonStore((s) => s.jsonB);
  const setJsonA = useJsonStore((s) => s.setJsonA);
  const setJsonB = useJsonStore((s) => s.setJsonB);
  const swapJsons = useJsonStore((s) => s.swapJsons);
  const clearAll = useJsonStore((s) => s.clearAll);
  const runDiff = useJsonStore((s) => s.runDiff);
  const diffResult = useJsonStore((s) => s.diffResult);

  const config = useViewStore((s) => s.config);
  const { message } = App.useApp();
  const { token } = antdTheme.useToken();
  const [ignoreOpen, setIgnoreOpen] = useState(false);

  const rerunDiff = useRerunDiff();
  const isStale = useIsStale();
  const setCurrentView = useViewStore((s) => s.setCurrentView);
  const focusDiffPath = useViewStore((s) => s.focusDiffPath);

  const editorARef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const editorBRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const items = useMemo(() => (diffResult ? flattenDiff(diffResult) : []), [diffResult]);
  const markColors = useMemo(
    () => ({ added: token.colorSuccess, deleted: token.colorError, updated: token.colorWarning }),
    [token],
  );

  // Ctrl/⌘+点击编辑器里的差异区域 -> 切到树视图并定位对应节点
  const handleLocate = useCallback((path: string) => {
    focusDiffPath(path);
    setCurrentView('tree');
  }, [focusDiffPath, setCurrentView]);

  const marksActive = config.markDiffInEditor && !isStale;
  useDiffMarks(editorARef, jsonA, items, 'A', markColors, marksActive, handleLocate);
  useDiffMarks(editorBRef, jsonB, items, 'B', markColors, marksActive, handleLocate);

  const handleCompare = () => {
    const result = runDiff(config);
    if (result.ok) {
      message.success(`对比完成！发现 ${result.total} 处差异`);
    } else {
      message.error(result.error ?? '对比失败');
    }
  };

  const handleFormat = (side: 'A' | 'B') => {
    const source = side === 'A' ? jsonA : jsonB;
    const setter = side === 'A' ? setJsonA : setJsonB;
    const validation = validateJson(source);
    if (validation.valid) {
      setter(formatJson(source));
    } else {
      message.error(`JSON ${side} 无法格式化: ${validation.error}`);
    }
  };

  const handleSwap = () => {
    swapJsons();
    if (config.autoCompare) return;
    message.info('已交换，点击对比查看结果');
  };

  const handleClear = () => {
    clearAll();
    message.success('已清空');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTarget = useRef<'A' | 'B'>('A');

  const handleImport = (side: 'A' | 'B') => {
    importTarget.current = side;
    fileInputRef.current?.click();
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空以允许重复选择同一个文件
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      message.warning(
        `文件较大（${(file.size / 1048576).toFixed(1)} MB），为避免卡顿请拆分后导入（上限 ${Math.floor(MAX_IMPORT_BYTES / 1048576)} MB）`,
      );
      return;
    }

    try {
      const text = await file.text();
      const side = importTarget.current;
      const setter = side === 'A' ? setJsonA : setJsonB;
      setter(text);
      if (validateJson(text).valid) {
        message.success(`已导入 ${file.name}（${(text.length / 1024).toFixed(1)} KB）`);
      } else {
        message.warning(`已导入 ${file.name}，但内容不是合法 JSON，可在编辑器中修正`);
      }
    } catch {
      message.error('读取文件失败');
    }
  };

  const isDark = config.theme === 'dark';
  useApplyMonacoTheme(isDark);
  const editorOptions = { ...editorCommonOptions, fontSize: config.fontSize };
  const editorTheme = monacoThemeName(isDark);

  const panelStyle = {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    overflow: 'hidden' as const,
  };

  const compareButton = (
    <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleCompare} size="small">
      对比
    </Button>
  );

  return (
    <Card
      style={{ margin: '16px', maxHeight: '40vh', overflow: 'auto' }}
      styles={{ body: { padding: '12px' } }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button icon={<FileTextOutlined />} onClick={() => handleImport('A')} size="small">导入 A</Button>
          <Button icon={<FileTextOutlined />} onClick={() => handleImport('B')} size="small">导入 B</Button>
          <Button onClick={() => handleFormat('A')} size="small">格式化 A</Button>
          <Button onClick={() => handleFormat('B')} size="small">格式化 B</Button>
          <Button icon={<FilterOutlined />} onClick={() => setIgnoreOpen(true)} size="small">
            忽略字段
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button icon={<SwapOutlined />} onClick={handleSwap} size="small">交换</Button>
          <Button icon={<ClearOutlined />} onClick={handleClear} size="small">清空</Button>
          {isStale && !config.autoCompare ? (
            <Tooltip title="输入已变更，结果不是最新">
              <Badge dot color={token.colorWarning} offset={[-4, 4]}>
                {compareButton}
              </Badge>
            </Tooltip>
          ) : (
            compareButton
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, height: 300 }}>
        <div style={panelStyle}>
          <Editor
            height="100%"
            defaultLanguage="json"
            theme={editorTheme}
            value={jsonA}
            onMount={(ed) => { editorARef.current = ed; }}
            onChange={(value) => setJsonA(value ?? '')}
            options={editorOptions}
            loading={<span style={{ color: token.colorTextTertiary }}>编辑器加载中…</span>}
          />
        </div>

        <div style={panelStyle}>
          <Editor
            height="100%"
            defaultLanguage="json"
            theme={editorTheme}
            value={jsonB}
            onMount={(ed) => { editorBRef.current = ed; }}
            onChange={(value) => setJsonB(value ?? '')}
            options={editorOptions}
            loading={<span style={{ color: token.colorTextTertiary }}>编辑器加载中…</span>}
          />
        </div>
      </div>

      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Checkbox
          checked={config.autoCompare}
          onChange={(e) => rerunDiff({ autoCompare: e.target.checked })}
        >
          自动对比
        </Checkbox>
        <Checkbox
          checked={config.arrayOrderSensitive}
          onChange={(e) => rerunDiff({ arrayOrderSensitive: e.target.checked })}
        >
          数组顺序敏感
        </Checkbox>
        <Checkbox
          checked={config.numericPrecision === 'tolerant'}
          onChange={(e) => rerunDiff({ numericPrecision: e.target.checked ? 'tolerant' : 'exact' })}
        >
          数字容差比较
        </Checkbox>
        <Checkbox
          checked={config.objectKeyOrderSensitive}
          onChange={(e) => rerunDiff({ objectKeyOrderSensitive: e.target.checked })}
        >
          键顺序敏感
        </Checkbox>
        <span style={{ fontSize: 12, color: token.colorTextTertiary, alignSelf: 'center' }}>
          {config.autoCompare ? '输入停止后自动重算' : '手动点击对比生效'}
          {config.markDiffInEditor && diffResult ? ' · Ctrl/⌘+点击差异处可定位到树视图' : ''}
        </span>
      </div>

      <IgnoreFields open={ignoreOpen} onClose={() => setIgnoreOpen(false)} />
    </Card>
  );
};

export default InputSection;
