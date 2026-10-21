import { Layout, Typography, Space, Button, Drawer, Switch, Slider, Select, Divider, Segmented, theme as antdTheme } from 'antd';
import { DiffOutlined, SettingOutlined, ThunderboltOutlined, SwapOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useViewStore } from '../../store/viewStore';
import { useRerunDiff } from '../../hooks/useDiffActions';

const { Header: AntHeader } = Layout;
const { Title } = Typography;
const { useToken } = antdTheme;

const Header: React.FC = () => {
  const config = useViewStore((s) => s.config);
  const setConfig = useViewStore((s) => s.setConfig);
  const mode = useViewStore((s) => s.mode);
  const setMode = useViewStore((s) => s.setMode);
  const { token } = useToken();
  const [open, setOpen] = useState(false);
  const rerunDiff = useRerunDiff();

  const row = (label: string, control: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      {control}
    </div>
  );

  return (
    <>
      <AntHeader style={{
        height: 56,
        lineHeight: '56px',
        background: token.colorBgContainer,
        padding: '0 24px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Space size={16}>
          <Space size={10}>
            <DiffOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>JSON Diff Pro</Title>
          </Space>
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as 'compare' | 'beautify')}
            options={[
              { label: '对比', value: 'compare', icon: <SwapOutlined /> },
              { label: '美化', value: 'beautify', icon: <ThunderboltOutlined /> },
            ]}
          />
        </Space>

        <Space>
          <Button icon={<SettingOutlined />} onClick={() => setOpen(true)}>
            设置
          </Button>
        </Space>
      </AntHeader>

      <Drawer
        title="设置"
        placement="right"
        width={360}
        open={open}
        onClose={() => setOpen(false)}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Divider orientation="left" plain style={{ marginTop: 0 }}>外观</Divider>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {row('暗色主题', (
                <Switch
                  checked={config.theme === 'dark'}
                  onChange={(checked) => setConfig({ theme: checked ? 'dark' : 'light' })}
                />
              ))}
              {row('字号', (
                <Slider
                  style={{ width: 160 }}
                  min={12}
                  max={24}
                  value={config.fontSize}
                  onChange={(value) => setConfig({ fontSize: value })}
                />
              ))}
              {row('编辑器内标记差异', (
                <Switch
                  checked={config.markDiffInEditor}
                  onChange={(checked) => setConfig({ markDiffInEditor: checked })}
                />
              ))}
            </Space>
          </div>

          <div>
            <Divider orientation="left" plain>对比规则</Divider>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {row('自动对比', (
                <Switch
                  checked={config.autoCompare}
                  onChange={(checked) => setConfig({ autoCompare: checked })}
                />
              ))}
              {row('对象键顺序敏感', (
                <Switch
                  checked={config.objectKeyOrderSensitive}
                  onChange={(checked) => rerunDiff({ objectKeyOrderSensitive: checked })}
                />
              ))}
              {row('数组顺序敏感', (
                <Switch
                  checked={config.arrayOrderSensitive}
                  onChange={(checked) => rerunDiff({ arrayOrderSensitive: checked })}
                />
              ))}
              {row('数字容差比较', (
                <Switch
                  checked={config.numericPrecision === 'tolerant'}
                  onChange={(checked) => rerunDiff({ numericPrecision: checked ? 'tolerant' : 'exact' })}
                />
              ))}

              <div>
                <div style={{ marginBottom: 8 }}>数组主键（回车添加）</div>
                <Select
                  mode="tags"
                  placeholder="如 id，按该字段对齐数组元素"
                  allowClear
                  style={{ width: '100%' }}
                  value={config.arrayPrimaryKey}
                  onChange={(values) => rerunDiff({ arrayPrimaryKey: values })}
                  options={config.arrayPrimaryKey.map((p) => ({ value: p }))}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>忽略路径（正则，回车添加）</div>
                <Select
                  mode="tags"
                  placeholder="如 timestamp|updatedAt，回车确认"
                  allowClear
                  style={{ width: '100%' }}
                  value={config.ignorePatterns}
                  onChange={(values) => rerunDiff({ ignorePatterns: values })}
                  options={config.ignorePatterns.map((p) => ({ value: p }))}
                />
              </div>
            </Space>
          </div>
        </Space>
      </Drawer>
    </>
  );
};

export default Header;
