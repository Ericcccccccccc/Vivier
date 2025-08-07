import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './utils/logger';

export class SessionManager {
  private sessionPath: string;
  private backupPath: string;

  constructor(sessionPath: string) {
    this.sessionPath = sessionPath;
    this.backupPath = `${sessionPath}-backup`;
  }

  async saveSession(session: any): Promise<void> {
    try {
      await fs.mkdir(this.sessionPath, { recursive: true });
      
      const sessionFile = path.join(this.sessionPath, 'session.json');
      await fs.writeFile(
        sessionFile,
        JSON.stringify(session, null, 2),
        'utf-8'
      );
      
      logger.debug('Session saved successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to save session');
      throw error;
    }
  }

  async loadSession(): Promise<any> {
    try {
      const sessionFile = path.join(this.sessionPath, 'session.json');
      const exists = await this.fileExists(sessionFile);
      
      if (!exists) {
        logger.info('No existing session found');
        return null;
      }

      const data = await fs.readFile(sessionFile, 'utf-8');
      const session = JSON.parse(data);
      
      logger.info('Session loaded successfully');
      return session;
      
    } catch (error) {
      logger.error({ error }, 'Failed to load session');
      
      // Try to restore from backup
      const restored = await this.restoreFromBackup();
      if (restored) {
        logger.info('Session restored from backup');
        return restored;
      }
      
      return null;
    }
  }

  async clearSession(): Promise<void> {
    try {
      // Backup before clearing
      await this.backupSession();
      
      // Remove session directory
      await fs.rm(this.sessionPath, { recursive: true, force: true });
      
      logger.info('Session cleared successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to clear session');
      throw error;
    }
  }

  async backupSession(): Promise<void> {
    try {
      const sessionExists = await this.directoryExists(this.sessionPath);
      
      if (!sessionExists) {
        logger.debug('No session to backup');
        return;
      }

      // Remove old backup if exists
      await fs.rm(this.backupPath, { recursive: true, force: true });
      
      // Create backup
      await this.copyDirectory(this.sessionPath, this.backupPath);
      
      logger.debug('Session backed up successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to backup session');
    }
  }

  async restoreFromBackup(): Promise<any> {
    try {
      const backupExists = await this.directoryExists(this.backupPath);
      
      if (!backupExists) {
        logger.debug('No backup available');
        return null;
      }

      // Remove corrupted session
      await fs.rm(this.sessionPath, { recursive: true, force: true });
      
      // Restore from backup
      await this.copyDirectory(this.backupPath, this.sessionPath);
      
      // Try to load restored session
      return await this.loadSession();
      
    } catch (error) {
      logger.error({ error }, 'Failed to restore from backup');
      return null;
    }
  }

  async validateSession(): Promise<boolean> {
    try {
      const sessionFile = path.join(this.sessionPath, 'creds.json');
      const exists = await this.fileExists(sessionFile);
      
      if (!exists) {
        return false;
      }

      // Check if session files are valid
      const data = await fs.readFile(sessionFile, 'utf-8');
      const creds = JSON.parse(data);
      
      // Basic validation
      return !!(creds && creds.me);
      
    } catch (error) {
      logger.error({ error }, 'Session validation failed');
      return false;
    }
  }

  async getSessionInfo(): Promise<{
    exists: boolean;
    createdAt?: Date;
    size?: number;
    backupExists?: boolean;
  }> {
    try {
      const exists = await this.directoryExists(this.sessionPath);
      
      if (!exists) {
        return { exists: false };
      }

      const stats = await fs.stat(this.sessionPath);
      const backupExists = await this.directoryExists(this.backupPath);
      
      // Calculate total size
      const size = await this.getDirectorySize(this.sessionPath);
      
      return {
        exists: true,
        createdAt: stats.birthtime,
        size,
        backupExists,
      };
      
    } catch (error) {
      logger.error({ error }, 'Failed to get session info');
      return { exists: false };
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        size += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }
    
    return size;
  }
}