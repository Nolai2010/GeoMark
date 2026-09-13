// GeoMark Benchmark 结果动效（Remotion 合成）
// 数据源：benchmark/results/<runid>/summary.json（summarize.mjs 产出）
// 渲染：
//   npx remotion render benchmark/viz/index.jsx BenchmarkResults out.mp4 --props benchmark/results/<runid>/summary.json
// 或在 remotion.config.ts 中注册后 `npx remotion studio benchmark/viz/index.jsx` 预览。
//
// 依赖：npm i remotion @remotion/cli react react-dom（ benchmark/viz/package.json 见同目录 ）
import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence,
} from 'remotion';

const INK = '#221f1c';
const PAPER = '#faf7f2';
const CINNABAR = '#b54434';
const GOLD = '#8a6d3b';
const TEAL = '#1f6f5c';
const MODE_COLORS = { vision: CINNABAR, coord: TEAL, pure: GOLD };
const MODE_LABELS = { vision: '纯识图', coord: '可建系', pure: '不可建系' };

export const BenchmarkResults = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const table = data?.table || {};
  const gids = Object.keys(table);
  const modes = ['vision', 'coord', 'pure'];

  // 标题入场
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: PAPER, fontFamily: 'Georgia, "Times New Roman", serif', padding: 70 }}>
      <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 10, background: CINNABAR, color: PAPER,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>格</div>
          <div>
            <div style={{ fontSize: 42, fontWeight: 700, color: INK }}>
              GeoMark Benchmark · {data?.manifest?.model || 'model'}
            </div>
            <div style={{ fontSize: 20, color: '#777', marginTop: 4 }}>
              三模式评测对比 {gids.length} 题 · temperature {data?.manifest?.temperature ?? 0}
            </div>
          </div>
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${CINNABAR}, ${GOLD}55, transparent)`, marginTop: 24 }} />
      </div>

      {gids.map((gid, i) => {
        const appear = 20 + i * 8;
        const opacity = interpolate(frame, [appear, appear + 12], [0, 1], { extrapolateRight: 'clamp' });
        const x = interpolate(frame, [appear, appear + 12], [60, 0], { extrapolateRight: 'clamp' });
        const row = table[gid] || {};
        return (
          <div key={gid} style={{ opacity, transform: `translateX(${x}px)`, marginTop: i === 0 ? 34 : 14 }}>
            <div style={{ fontSize: 22, color: INK, marginBottom: 6, fontWeight: 600 }}>{gid}</div>
            <div style={{ display: 'flex', gap: 26 }}>
              {modes.map((m) => {
                const cell = row[m]; // { total, max, pct } | null
                const pctNum = cell?.pct ?? 0;
                const barGrow = spring({ frame: frame - appear - 6, fps, config: { damping: 200 } });
                return (
                  <div key={m} style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: '#8a8378', marginBottom: 4 }}>
                      {MODE_LABELS[m]}{cell ? `　${cell.total}/${cell.max}` : ''}
                    </div>
                    <div style={{ height: 16, background: '#e8e2d5', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pctNum * barGrow}%`,
                        background: `linear-gradient(90deg, ${MODE_COLORS[m]}, ${MODE_COLORS[m]}aa)`,
                        borderRadius: 8,
                      }} />
                    </div>
                    <div style={{ fontSize: 15, color: INK, marginTop: 3 }}>{cell ? `${pctNum}%` : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 尾帧：模式均分 */}
      <Sequence from={Math.max(30, durationInFrames - 90)}>
        <ModeAverages gids={gids} table={table} />
      </Sequence>
    </AbsoluteFill>
  );
};

const ModeAverages = ({ gids, table }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const modes = ['vision', 'coord', 'pure'];
  const avg = modes.map((m) => {
    const vals = gids.map(g => table[g]?.[m]?.pct).filter(v => typeof v === 'number');
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  });
  return (
    <AbsoluteFill style={{ background: 'rgba(250,247,242,0.94)', padding: 70 }}>
      <div style={{ opacity, fontSize: 34, fontWeight: 700, color: INK, marginBottom: 30 }}>三模式均分</div>
      <div style={{ display: 'flex', gap: 60, alignItems: 'flex-end', height: 260 }}>
        {modes.map((m, i) => {
          const v = avg[i] ?? 0;
          const grow = spring({ frame: frame - 12 - i * 8, fps: 30, config: { damping: 200 } });
          return (
            <div key={m} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 44, fontWeight: 700, color: MODE_COLORS[m], marginBottom: 10 }}>{v}%</div>
              <div style={{
                height: `${v * grow * 1.6}px`, background: `linear-gradient(180deg, ${MODE_COLORS[m]}, ${MODE_COLORS[m]}88)`,
                borderRadius: '12px 12px 0 0',
              }} />
              <div style={{ fontSize: 20, color: INK, marginTop: 10 }}>{MODE_LABELS[m]}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
