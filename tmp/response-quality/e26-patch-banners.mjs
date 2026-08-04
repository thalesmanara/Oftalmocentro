#!/usr/bin/env node
/**
 * Add TechnicalAreaBanner to technical pages if missing
 */
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'src/pages/AiValidationPage.tsx',
  'src/pages/AiPromptsPage.tsx',
  'src/pages/AiRetrievalPage.tsx',
  'src/pages/AiContextPage.tsx',
  'src/pages/AiCachePage.tsx',
  'src/pages/AiEvidencePage.tsx',
  'src/pages/QdrantAdminPage.tsx',
  'src/pages/SettingsPage.tsx',
];

for (const f of files) {
  let s = readFileSync(f, 'utf8');
  if (s.includes('TechnicalAreaBanner')) {
    console.log('skip', f);
    continue;
  }
  if (!s.includes("from '@/components/ui/PageHeader'")) {
    console.log('no PageHeader', f);
    continue;
  }
  s = s.replace(
    "from '@/components/ui/PageHeader'",
    "from '@/components/ui/PageHeader'\nimport { TechnicalAreaBanner } from '@/components/ui/TechnicalAreaBanner'",
  );
  // Insert banner after first PageHeader closing — find `/>` after PageHeader block is hard.
  // Simpler: after `return (` first `<div` child, insert banner before PageHeader
  if (s.includes('<PageHeader')) {
    s = s.replace('<PageHeader', '<TechnicalAreaBanner />\n      <PageHeader');
    writeFileSync(f, s);
    console.log('patched', f);
  }
}
