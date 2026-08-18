import { AppDataSource } from './data-source.js';

const revert = process.argv.includes('--revert');

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    if (revert) {
      await AppDataSource.undoLastMigration();
    } else {
      await AppDataSource.runMigrations();
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
