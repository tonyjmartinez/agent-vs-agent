import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const files = ['engine', 'ai'].flatMap((d) =>
  readdirSync(join(root, d))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(root, d, f)),
);

describe('engine/ai purity (PLAN.md 4.1, 5.6)', () => {
  it.each(files)('%s has no forbidden imports or nondeterminism', (f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/from ['"](phaser|\.\.\/(view|ui|app)\/)/);
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date\(/);
    expect(src).not.toMatch(/\bdocument\.|\bwindow\./);
  });
});
