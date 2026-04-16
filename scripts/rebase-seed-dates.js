#!/usr/bin/env node
// One-shot helper: shift every YYYY-MM-DD (and ISO timestamp) in the seed
// files forward by SHIFT_DAYS. Used to keep the demo data "current" — the
// calendar defaults to today, so if the seed week is in the past the prospect
// sees an empty diary. Re-run before each demo with an appropriate shift.
//
// Usage:   SHIFT_DAYS=7 node scripts/rebase-seed-dates.js
// Default: +7 days.

const fs = require('fs');
const path = require('path');

const SHIFT = parseInt(process.env.SHIFT_DAYS || '7', 10);
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const FILES = [
  'seed-appointments.json',
  'seed-calls.json',
  'seed-comms.json',
  'seed-patients.json'
];

// Fields in these files that are FIXED (pet's actual birthday, historical
// microchip date, etc.) and must NOT shift with the rolling demo window.
const FIXED_FIELDS = new Set(['dateOfBirth']);

function shiftDateStr(s) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + SHIFT);
  return d.toISOString().slice(0, 10);
}

function shiftIsoTs(s) {
  const d = new Date(s);
  d.setUTCDate(d.getUTCDate() + SHIFT);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function shiftValue(v) {
  if (typeof v !== 'string') return v;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v)) return shiftIsoTs(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return shiftDateStr(v);
  return v;
}

function rewriteNode(node) {
  if (Array.isArray(node)) return node.map(rewriteNode);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = FIXED_FIELDS.has(k) ? v : rewriteNode(v);
    }
    return out;
  }
  return shiftValue(node);
}

console.log(`Shifting all dates by +${SHIFT} days in:`);
for (const f of FILES) {
  const p = path.join(DATA_DIR, f);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const shifted = rewriteNode(data);
  fs.writeFileSync(p, JSON.stringify(shifted, null, 2) + '\n');
  console.log(`  ${f}: ok`);
}
console.log('Done. Reload the server (in-memory store reloads on restart).');
