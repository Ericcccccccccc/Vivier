import * as Imap from 'node-imap';
import { IMAPConfig } from './interface';

export interface IMAPConnection {
  id: string;
  config: IMAPConfig;
  connection: Imap;
  lastUsed: number;
  inUse: boolean;
  isConnected: boolean;
}

export interface ConnectionPoolOptions {
  maxConnections?: number;
  maxIdleTime?: number;
  connectionTimeout?: number;
  healthCheckInterval?: number;
}

export class ConnectionPool {
  private connections: Map<string, IMAPConnection> = new Map();
  private options: Required<ConnectionPoolOptions>;
  private healthCheckTimer?: NodeJS.Timer;

  constructor(options: ConnectionPoolOptions = {}) {
    this.options = {
      maxConnections: options.maxConnections || 10,
      maxIdleTime: options.maxIdleTime || 300000, // 5 minutes
      connectionTimeout: options.connectionTimeout || 30000, // 30 seconds
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
    };

    // Start health check timer
    this.startHealthCheck();
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(accountId: string, config: IMAPConfig): Promise<IMAPConnection> {
    // Check if we have an existing connection
    let connection = this.connections.get(accountId);

    if (connection) {
      if (connection.inUse) {
        throw new Error(`Connection for ${accountId} is already in use`);
      }

      if (!connection.isConnected) {
        // Reconnect if disconnected
        await this.reconnect(connection);
      }

      connection.inUse = true;
      connection.lastUsed = Date.now();
      return connection;
    }

    // Check if we've reached max connections
    if (this.connections.size >= this.options.maxConnections) {
      // Try to evict an idle connection
      const evicted = this.evictIdleConnection();
      if (!evicted) {
        throw new Error('Connection pool is full and no idle connections available');
      }
    }

    // Create new connection
    connection = await this.createConnection(accountId, config);
    this.connections.set(accountId, connection);
    
    connection.inUse = true;
    connection.lastUsed = Date.now();
    
    return connection;
  }

  /**
   * Release a connection back to the pool
   */
  release(accountId: string): void {
    const connection = this.connections.get(accountId);
    
    if (!connection) {
      console.warn(`No connection found for ${accountId}`);
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();
  }

  /**
   * Close a specific connection
   */
  async close(accountId: string): Promise<void> {
    const connection = this.connections.get(accountId);
    
    if (!connection) {
      return;
    }

    if (connection.inUse) {
      throw new Error(`Cannot close connection for ${accountId} while in use`);
    }

    await this.closeConnection(connection);
    this.connections.delete(accountId);
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Close all connections
    const closePromises: Promise<void>[] = [];
    
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        closePromises.push(this.closeConnection(connection));
      }
    }

    await Promise.all(closePromises);
    this.connections.clear();
  }

  /**
   * Perform health check on all connections
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [accountId, connection] of this.connections.entries()) {
      if (connection.inUse) {
        results.set(accountId, true);
        continue;
      }

      try {
        if (connection.isConnected) {
          // Try a simple NOOP command
          await this.sendNoop(connection);
          results.set(accountId, true);
        } else {
          results.set(accountId, false);
        }
      } catch (error) {
        console.error(`Health check failed for ${accountId}:`, error);
        results.set(accountId, false);
        connection.isConnected = false;
      }
    }

    return results;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    poolUtilization: number;
  } {
    let activeCount = 0;
    let idleCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.inUse) {
        activeCount++;
      } else {
        idleCount++;
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: activeCount,
      idleConnections: idleCount,
      poolUtilization: this.connections.size / this.options.maxConnections,
    };
  }

  /**
   * Create a new IMAP connection
   */
  private async createConnection(accountId: string, config: IMAPConfig): Promise<IMAPConnection> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: config.email,
        password: config.password,
        host: config.imapHost,
        port: config.imapPort || 993,
        tls: config.tls !== false,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: this.options.connectionTimeout,
        connTimeout: this.options.connectionTimeout,
      });

      const connection: IMAPConnection = {
        id: accountId,
        config,
        connection: imap,
        lastUsed: Date.now(),
        inUse: false,
        isConnected: false,
      };

      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.options.connectionTimeout);

      imap.once('ready', () => {
        clearTimeout(timeoutId);
        connection.isConnected = true;
        resolve(connection);
      });

      imap.once('error', (err: Error) => {
        clearTimeout(timeoutId);
        connection.isConnected = false;
        reject(err);
      });

      imap.once('end', () => {
        connection.isConnected = false;
      });

      imap.connect();
    });
  }

  /**
   * Reconnect an existing connection
   */
  private async reconnect(connection: IMAPConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Reconnection timeout'));
      }, this.options.connectionTimeout);

      connection.connection.once('ready', () => {
        clearTimeout(timeoutId);
        connection.isConnected = true;
        resolve();
      });

      connection.connection.once('error', (err: Error) => {
        clearTimeout(timeoutId);
        connection.isConnected = false;
        reject(err);
      });

      connection.connection.connect();
    });
  }

  /**
   * Close a connection
   */
  private async closeConnection(connection: IMAPConnection): Promise<void> {
    return new Promise((resolve) => {
      if (!connection.isConnected) {
        resolve();
        return;
      }

      connection.connection.once('end', () => {
        connection.isConnected = false;
        resolve();
      });

      connection.connection.end();

      // Force close after timeout
      setTimeout(() => {
        connection.isConnected = false;
        resolve();
      }, 5000);
    });
  }

  /**
   * Send NOOP command to keep connection alive
   */
  private async sendNoop(connection: IMAPConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!connection.isConnected) {
        reject(new Error('Connection not established'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('NOOP timeout'));
      }, 5000);

      (connection.connection as any)._send('NOOP', (err: Error) => {
        clearTimeout(timeoutId);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Evict the least recently used idle connection
   */
  private evictIdleConnection(): boolean {
    let oldestIdle: IMAPConnection | null = null;
    let oldestTime = Date.now();

    for (const connection of this.connections.values()) {
      if (!connection.inUse && connection.lastUsed < oldestTime) {
        oldestIdle = connection;
        oldestTime = connection.lastUsed;
      }
    }

    if (oldestIdle) {
      this.closeConnection(oldestIdle);
      this.connections.delete(oldestIdle.id);
      return true;
    }

    return false;
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performMaintenance();
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform maintenance tasks
   */
  private async performMaintenance(): Promise<void> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [accountId, connection] of this.connections.entries()) {
      // Skip connections in use
      if (connection.inUse) {
        continue;
      }

      // Close idle connections
      if (now - connection.lastUsed > this.options.maxIdleTime) {
        toClose.push(accountId);
        continue;
      }

      // Send NOOP to keep alive
      if (connection.isConnected && now - connection.lastUsed > 60000) {
        try {
          await this.sendNoop(connection);
        } catch (error) {
          console.error(`Failed to send NOOP to ${accountId}:`, error);
          connection.isConnected = false;
        }
      }
    }

    // Close idle connections
    for (const accountId of toClose) {
      try {
        await this.close(accountId);
      } catch (error) {
        console.error(`Failed to close idle connection ${accountId}:`, error);
      }
    }
  }

  /**
   * Wait for a connection to become available
   */
  async waitForConnection(accountId: string, config: IMAPConfig, timeout: number = 30000): Promise<IMAPConnection> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        return await this.acquire(accountId, config);
      } catch (error: any) {
        if (error.message.includes('already in use')) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(`Timeout waiting for connection for ${accountId}`);
  }
}