#!/usr/bin/env node
// 顺序编排三段流水线并输出结构化进度行（供 Web 端解析）：
//   STAGE svg2png <done>
//   STAGE answer <done/total>
//   STAGE score <done/total>
//   STAGE done <summaryPath>
// 用法：node pipeline.mjs --model <id> [--items ...] [--modes ...] [--out ...] [--skip-png]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODE = process.execPath;
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;

const RUN = path.resolve(String(opt.out || 'benchmark/results/run')); // 强制绝对路径，杜绝 cwd 差异产生第二份副本
const judge = opt['judge-model'] || opt.model;

// 作答进度：count / total（供 Web 端展示）
const MODES_N = String(opt.modes || 'vision,coord,pure').split(',').length;
function countItems() {
  try {
    if (opt.items) return String(opt.items).split(',').length;
    return fs.readdirSync(path.join(HERE, '..', 'items')).filter(d => d.startsWith('GM-')).length;
  } catch { return 0; }
}
const TOTAL_ANS = countItems() * MODES_N;
let ansDone = 0;

function run(step, args) {
  return new Promise((resolve) => {
    const child = spawn(NODE, [path.join(HERE, step), ...args], { env: process.env });
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) {
        if (l.startsWith('==')) {
          const m = /== (GM-\d+) \/ (\w+)/.exec(l);
          if (m) {
            pipeline.answerDone[`${m[1]}__${m[2]}`] = true;
            ansDone = Object.keys(pipeline.answerDone).length;
            if (step === 'run-eval.mjs') console.log(`STAGE answer ${ansDone}/${TOTAL_ANS}`);
          }
          console.log(`EVAL ${l.trim()}`);
        } else if (l.trim()) console.log(`LOG ${l.trim()}`);
      }
    });
    child.stderr.on('data', (d) => {
      const t = d.toString().trim();
      if (t) console.log(`LOG ${t}`);
    });
    child.on('close', (code) => resolve(code));
  });
}

const pipeline = { answerDone: {} };
let code = 0;

if (!opt['skip-png']) {
  console.log('STAGE convert 0');
  code = await run('svg2png.mjs', opt.items ? ['--items', String(opt.items)] : []);
  console.log(`STAGE convert ${code === 0 ? 'ok' : 'fail'}`);
}

const evalArgs = ['--model', String(opt.model)];
if (opt.items) evalArgs.push('--items', String(opt.items));
if (opt.modes) evalArgs.push('--modes', String(opt.modes));
if (opt.concurrency) evalArgs.push('--concurrency', String(opt.concurrency));
if (opt['max-tokens']) evalArgs.push('--max-tokens', String(opt['max-tokens']));
evalArgs.push('--out', RUN);
console.log(`STAGE answer 0/${TOTAL_ANS}`);
code = (await run('run-eval.mjs', evalArgs)) || code;

const scoreArgs = ['--run', RUN, '--judge-model', String(judge)];
if (opt.items) scoreArgs.push('--items', String(opt.items));
if (opt.concurrency) scoreArgs.push('--concurrency', String(opt.concurrency));
console.log('STAGE score 0');
code = (await run('score.mjs', scoreArgs)) || code;
console.log(`STAGE score ${code === 0 ? 'ok' : 'fail'}`);

code = (await run('summarize.mjs', ['--run', RUN])) || code;
console.log(`STAGE done ${path.join(RUN, 'summary.md')}`);
process.exit(code);
