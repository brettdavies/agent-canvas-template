import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

// WCAG 2.1 A/AA check via axe-core run through the shared gstack `browse`
// Chromium (one browser per box — no bundled second Chromium). Loose A/AA:
// fails only on serious/critical violations.
const APP_URL = process.env.A11Y_URL ?? 'http://localhost:5173';
const BROWSE = join(homedir(), '.claude/skills/gstack/browse/dist/browse');
const AXE = 'node_modules/axe-core/axe.min.js';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

function browse(...args: string[]): string {
  return execFileSync(BROWSE, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}
const sleep = (seconds: string) => execFileSync('sleep', [seconds]);

browse('goto', APP_URL);
browse('wait', '--networkidle');
// axe.min.js is a UMD IIFE; evaluating the file attaches `axe` to the page global.
browse('eval', AXE);
// `browse js` resolves microtask promises but not axe.run's macrotask ticks, so
// kick off the scan, stash the result on `window`, then poll for it.
browse(
  'js',
  `axe.run(document,{runOnly:{type:'tag',values:${JSON.stringify(TAGS)}}}).then((r)=>{window.__axe=JSON.stringify(r.violations)}).catch((e)=>{window.__axe='ERR:'+e.message}); 'started'`,
);

let raw = '';
for (let i = 0; i < 50; i++) {
  raw = browse('js', 'window.__axe || ""');
  if (raw) break;
  sleep('0.2');
}
if (!raw) {
  console.error('a11y: axe.run did not complete within 10s');
  process.exit(2);
}
if (raw.startsWith('ERR:')) {
  console.error(`a11y: ${raw}`);
  process.exit(2);
}

const violations = JSON.parse(raw) as AxeViolation[];
const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

console.log(`axe WCAG 2.1 A/AA @ ${APP_URL}: ${violations.length} violation(s), ${blocking.length} serious/critical`);
for (const v of violations) {
  console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`);
}
if (blocking.length > 0) {
  process.exit(1);
}
console.log('PASS: no serious/critical WCAG violations');
