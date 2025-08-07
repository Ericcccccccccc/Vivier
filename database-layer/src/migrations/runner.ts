import { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export interface Migration {
  name: string;
  up: string;
  down?: string;
  checksum?: string;
}

export class MigrationRunner {
  constructor(private db: SupabaseClient) {}

  async run(): Promise<void> {
    try {
      // Create migrations table if not exists
      await this.createMigrationsTable();

      // Get applied migrations
      const applied = await this.getAppliedMigrations();
      logger.info(`Found ${applied.length} applied migrations`);

      // Get pending migrations
      const pending = await this.getPendingMigrations(applied);
      logger.info(`Found ${pending.length} pending migrations`);

      // Apply migrations in order
      for (const migration of pending) {
        await this.applyMigration(migration);
      }

      if (pending.length === 0) {
        logger.info('All migrations are up to date');
      } else {
        logger.info(`Successfully applied ${pending.length} migrations`);
      }
    } catch (error) {
      logger.error('Migration runner failed', { error });
      throw error;
    }
  }

  async rollback(steps: number = 1): Promise<void> {
    try {
      const applied = await this.getAppliedMigrations();
      const toRollback = applied.slice(-steps);

      for (const migration of toRollback.reverse()) {
        await this.rollbackMigration(migration);
      }

      logger.info(`Successfully rolled back ${toRollback.length} migrations`);
    } catch (error) {
      logger.error('Rollback failed', { error });
      throw error;
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        checksum VARCHAR(64),
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        execution_time_ms INTEGER
      )
    `;

    const { error } = await this.db.rpc('execute_sql', { query });
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Failed to create migrations table: ${error.message}`);
    }
  }

  private async getAppliedMigrations(): Promise<string[]> {
    const { data, error } = await this.db
      .from('migrations')
      .select('name')
      .order('applied_at', { ascending: true });

    if (error && !error.message.includes('does not exist')) {
      throw new Error(`Failed to get applied migrations: ${error.message}`);
    }

    return (data || []).map(m => m.name);
  }

  private async getPendingMigrations(applied: string[]): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname, '.');
    const files = await fs.readdir(migrationsDir);
    
    const migrations: Migration[] = [];
    
    for (const file of files) {
      if (file.endsWith('.sql') && !applied.includes(file)) {
        const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
        migrations.push({
          name: file,
          up: content,
        });
      }
    }

    // Sort migrations by name (assuming they're prefixed with numbers)
    migrations.sort((a, b) => a.name.localeCompare(b.name));

    return migrations;
  }

  private async applyMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Applying migration: ${migration.name}`);

      // Split migration into individual statements
      const statements = migration.up
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Execute each statement
      for (const statement of statements) {
        const { error } = await this.db.rpc('execute_sql', {
          query: statement + ';'
        });
        
        if (error) {
          throw new Error(`Failed to execute statement: ${error.message}`);
        }
      }

      // Record migration
      const executionTime = Date.now() - startTime;
      const { error: recordError } = await this.db
        .from('migrations')
        .insert({
          name: migration.name,
          checksum: migration.checksum,
          execution_time_ms: executionTime,
        });

      if (recordError) {
        throw new Error(`Failed to record migration: ${recordError.message}`);
      }

      logger.info(`✅ Applied migration: ${migration.name} (${executionTime}ms)`);
    } catch (error) {
      logger.error(`Failed to apply migration ${migration.name}`, { error });
      throw new Error(`Failed to apply migration ${migration.name}: ${error}`);
    }
  }

  private async rollbackMigration(migrationName: string): Promise<void> {
    try {
      logger.info(`Rolling back migration: ${migrationName}`);

      // For now, we just remove the migration record
      // In production, you'd want to have down migrations
      const { error } = await this.db
        .from('migrations')
        .delete()
        .eq('name', migrationName);

      if (error) {
        throw new Error(`Failed to rollback migration: ${error.message}`);
      }

      logger.info(`✅ Rolled back migration: ${migrationName}`);
    } catch (error) {
      logger.error(`Failed to rollback migration ${migrationName}`, { error });
      throw error;
    }
  }
}

// Standalone migration runner for CLI usage
export async function runMigrations(db: SupabaseClient): Promise<void> {
  const runner = new MigrationRunner(db);
  await runner.run();
}

export async function rollbackMigrations(db: SupabaseClient, steps: number = 1): Promise<void> {
  const runner = new MigrationRunner(db);
  await runner.rollback(steps);
}