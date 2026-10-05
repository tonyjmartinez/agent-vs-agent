import { expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/engine', 'src/ai'];

test('engine and ai stay pure (no Phaser/DOM/random/clock imports)', () => {
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const f of fs.readdirSync(root)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts') || f.endsWith('.worker.ts')) continue;
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src, f).not.toMatch(/from ['"]phaser['"]/);
      expect(src, f).not.toMatch(/from ['"]\.\.\/(view|ui|app)\//);
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date\(|\bdocument\.|\bwindow\./);
    }
  }
});
