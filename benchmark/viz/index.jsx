// Remotion 入口：注册 GeoMark Benchmark 结果合成
// 渲染 MP4：
//   cd benchmark/viz
//   npx remotion render index.jsx BenchmarkResults GeoMark-Benchmark.mp4 --props ../../benchmark/results/<runid>/summary.json
// 预览：npx remotion studio index.jsx
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { BenchmarkResults } from './BenchmarkResults.jsx';

// 默认 props：无 summary.json 时也能在 Studio 里预览版式（数值为占位示例）
const SAMPLE = {
  manifest: { model: 'your-model', temperature: 0 },
  table: Object.fromEntries(
    ['GM-0001', 'GM-0002', 'GM-0003', 'GM-0004', 'GM-0005', 'GM-0006', 'GM-0007', 'GM-0008', 'GM-0009', 'GM-0010'].map((g) => [
      g,
      { vision: { total: 6, max: 12, pct: 50 }, coord: { total: 9, max: 12, pct: 75 }, pure: { total: 8, max: 12, pct: 67 } },
    ])
  ),
};

const RemotionRoot = () => (
  <Composition
    id="BenchmarkResults"
    component={BenchmarkResults}
    durationInFrames={240}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ data: SAMPLE }}
  />
);

registerRoot(RemotionRoot);
