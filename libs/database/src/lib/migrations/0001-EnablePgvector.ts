import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgvector0001 implements MigrationInterface {
  name = 'EnablePgvector0001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS vector');
  }
}
