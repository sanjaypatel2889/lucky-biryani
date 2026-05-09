#!/usr/bin/env node
// Swap the Prisma datasource provider from "sqlite" to "postgresql".
// Used by the Render build to flip the source-of-truth schema before
// `prisma generate` runs. Idempotent: re-running has no effect once the
// swap has happened.

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'apps', 'api', 'prisma', 'schema.prisma');
const original = fs.readFileSync(schemaPath, 'utf8');

if (original.includes('provider = "postgresql"')) {
  console.log('[use-postgres] schema already on postgresql — nothing to do.');
  process.exit(0);
}

const swapped = original.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');

if (swapped === original) {
  console.error('[use-postgres] could not find `provider = "sqlite"` in schema.prisma');
  process.exit(1);
}

fs.writeFileSync(schemaPath, swapped);
console.log('[use-postgres] schema.prisma → provider = "postgresql"');
