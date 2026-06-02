#!/usr/bin/env node
// Turns k6 --summary-export JSON files into a Markdown table for the report.
// Usage: node summarise.mjs <results-dir>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node summarise.mjs <results-dir>');
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith('.summary.json'));
if (files.length === 0) {
  console.log('_No summary files found yet._');
  process.exit(0);
}

const ms = (v) => (v == null ? '—' : `${v.toFixed(1)} ms`);
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`);

console.log('# Load & Stress Test Results\n');
console.log(`Captured: ${new Date().toISOString()}\n`);
console.log('| Scenario | Requests | Throughput (req/s) | Latency p95 | Latency p99 | Error rate |');
console.log('|----------|---------:|-------------------:|------------:|------------:|-----------:|');

for (const f of files.sort()) {
  const m = JSON.parse(readFileSync(join(dir, f), 'utf8')).metrics ?? {};
  const dur = m.http_req_duration?.values ?? m.http_req_duration ?? {};
  const reqs = m.http_reqs?.values ?? m.http_reqs ?? {};
  const failed = m.http_req_failed?.values ?? m.http_req_failed ?? {};
  const name = f.replace('.summary.json', '');
  console.log(
    `| ${name} | ${reqs.count ?? '—'} | ${(reqs.rate ?? 0).toFixed(1)} | ` +
      `${ms(dur['p(95)'])} | ${ms(dur['p(99)'])} | ${pct(failed.rate ?? failed.value)} |`,
  );
}

console.log('\n_Thresholds (pass criteria): p95 < 1500 ms, p99 < 3000 ms, error rate < 1%._');
