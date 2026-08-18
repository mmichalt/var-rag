import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const INITIAL_MIGRATION = '20260818190000_enable_pgvector';

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = resolve(packageRoot, 'prisma.config.ts');

if (process.argv.includes('--revert')) {
  console.error(
    'Prisma migrations are forward-only. Add a new migration with the reverse SQL instead of reverting.',
  );
  process.exitCode = 1;
} else {
  const deploy = runPrisma(['migrate', 'deploy']);
  if (deploy.status === 0) {
    process.exit(0);
  }
  if (!deploy.output.includes('P3005')) {
    process.exit(deploy.status);
  }

  process.stderr.write(
    'Database already has objects. Baselining the initial Prisma pgvector migration.\n',
  );

  // Existing non-empty DB (previous TypeORM migrate). Apply the SQL, then record it.
  const sqlFile = resolve(
    packageRoot,
    'prisma/migrations',
    INITIAL_MIGRATION,
    'migration.sql',
  );
  const executed = runPrisma(['db', 'execute', '--file', sqlFile]);
  if (executed.status !== 0) {
    process.exit(executed.status);
  }
  process.exit(
    runPrisma(['migrate', 'resolve', '--applied', INITIAL_MIGRATION]).status,
  );
}

function runPrisma(args: string[]): { status: number; output: string } {
  const result = spawnSync(
    process.execPath,
    [prismaCli, ...args, '--config', configPath],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      env: process.env,
    },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (output) {
    process.stderr.write(output);
  }
  return { status: result.status ?? 1, output };
}
