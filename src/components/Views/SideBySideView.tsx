import { Empty, Button, Segmented, Checkbox, theme as antdTheme } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import {
  DiffEditor,
  type DiffBeforeMount,
  type DiffOnMount,
  type MonacoDiffEditor,
} from '@monaco-editor/react';
import { useCallback, useRef, useState } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { useViewStore } from '../../store/viewStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { defineMonacoThemes, monacoThemeName } from '../../utils/monacoTheme';

type DiffMode = 'side' | 'inline';

const beforeMount: DiffBeforeMount = (monaco) => {
  defineMonacoThemes(monaco);
};

const SideBySideView: React.FC = () => {
  const jsonA = useJsonStore((s) => s.jsonA);
  const jsonB = useJsonStore((s) => s.jsonB);
  const config = useViewStore((s) => s.config);
  const { token } = antdTheme.useToken();

  const editorRef = useRef<MonacoDiffEditor | null>(null);
  const [mode, setMode] = useState<DiffMode>('side');
  const [ignoreTrimWhitespace, setIgnoreTrimWhitespace] = useState(false);

  // 输入过程中不打断编辑，稳定后再交给 DiffEditor 重算
  const original = useDebouncedValue(jsonA, 400);
  const modified = useDebouncedValue(jsonB, 400);

  const onMount: DiffOnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const jump = (target: 'next' | 'previous') => {
    editorRef.current?.goToDiff(target);
  };

  if (!jsonA.trim() || !jsonB.trim()) {
    return <Empty description="请输入 JSON 数据" />;
  }

  const isDark = config.theme === 'dark';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 360 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Segmented
          size="small"
          value={mode}
          onChange={(value) => setMode(value as DiffMode)}
          options={[
            { label: '并排', value: 'side' },
            { label: '内联', value: 'inline' },
          ]}
        />
        <Button size="small" icon={<ArrowUpOutlined />} onClick={() => jump('previous')}>
          上一处
        </Button>
        <Button size="small" icon={<ArrowDownOutlined />} onClick={() => jump('next')}>
          下一处
        </Button>
        <Checkbox
          checked={ignoreTrimWhitespace}
          onChange={(e) => setIgnoreTrimWhitespace(e.target.checked)}
        >
          忽略首尾空白
        </Checkbox>
        <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
          左侧 JSON A（原始） · 右侧 JSON B（修改后）
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          overflow: 'hidden',
        }}
      >
        <DiffEditor
          height="100%"
          language="json"
          theme={monacoThemeName(isDark)}
          beforeMount={beforeMount}
          onMount={onMount}
          original={original}
          modified={modified}
          loading={<span style={{ color: token.colorTextTertiary }}>差异视图加载中…</span>}
          options={{
            readOnly: true,
            originalEditable: false,
            renderSideBySide: mode === 'side',
            minimap: { enabled: false },
            fontSize: config.fontSize,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            ignoreTrimWhitespace,
            renderOverviewRuler: true,
            diffWordWrap: 'off',
          }}
        />
      </div>
    </div>
  );
};

export default SideBySideView;
