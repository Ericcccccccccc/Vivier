import {
  User,
  CreateUserInput,
  UpdateUserInput,
  EmailAccount,
  EmailAccountInput,
  Email,
  CreateEmailInput,
  AIResponse,
  AIResponseInput,
  ResponseTemplate,
  TemplateInput,
  NotificationLog,
  NotificationInput,
  UsageMetric,
  MetricType,
  QueryOptions,
  PaginatedResult,
  SubscriptionCallback,
  UnsubscribeFunction
} from './types';

// Re-export types for external use
export {
  User,
  CreateUserInput,
  UpdateUserInput,
  EmailAccount,
  EmailAccountInput,
  Email,
  CreateEmailInput,
  AIResponse,
  AIResponseInput,
  ResponseTemplate,
  TemplateInput,
  NotificationLog,
  NotificationInput,
  UsageMetric,
  MetricType,
  QueryOptions,
  PaginatedResult,
  SubscriptionCallback,
  UnsubscribeFunction
} from './types';

/**
 * Database adapter interface that all database implementations must follow.
 * This allows for easy swapping between different database providers.
 */
export interface DatabaseAdapter {
  // Connection Management
  
  /**
   * Establishes connection to the database
   * @throws {DatabaseConnectionError} If connection fails
   */
  connect(): Promise<void>;
  
  /**
   * Closes the database connection and cleans up resources
   */
  disconnect(): Promise<void>;
  
  /**
   * Checks if the database connection is healthy
   * @returns true if connection is healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;
  
  // User Operations
  
  /**
   * Creates a new user in the database
   * @param data - User creation data
   * @returns The created user
   * @throws {ValidationError} If data is invalid
   * @throws {DatabaseOperationError} If user already exists
   */
  createUser(data: CreateUserInput): Promise<User>;
  
  /**
   * Retrieves a user by their ID
   * @param id - User ID
   * @returns User if found, null otherwise
   */
  getUser(id: string): Promise<User | null>;
  
  /**
   * Retrieves a user by their email address
   * @param email - User email address
   * @returns User if found, null otherwise
   */
  getUserByEmail(email: string): Promise<User | null>;
  
  /**
   * Updates an existing user
   * @param id - User ID
   * @param data - Update data
   * @returns Updated user
   * @throws {DatabaseOperationError} If user not found
   */
  updateUser(id: string, data: UpdateUserInput): Promise<User>;
  
  /**
   * Deletes a user and all their associated data
   * @param id - User ID
   * @throws {DatabaseOperationError} If user not found
   */
  deleteUser(id: string): Promise<void>;
  
  // Email Account Operations
  
  /**
   * Adds a new email account for a user
   * @param userId - User ID
   * @param data - Email account data
   * @returns Created email account
   * @throws {ValidationError} If data is invalid
   * @throws {DatabaseOperationError} If account already exists
   */
  addEmailAccount(userId: string, data: EmailAccountInput): Promise<EmailAccount>;
  
  /**
   * Retrieves all email accounts for a user
   * @param userId - User ID
   * @returns Array of email accounts
   */
  getEmailAccounts(userId: string): Promise<EmailAccount[]>;
  
  /**
   * Retrieves a specific email account
   * @param id - Email account ID
   * @returns Email account if found, null otherwise
   */
  getEmailAccount(id: string): Promise<EmailAccount | null>;
  
  /**
   * Updates an email account
   * @param id - Email account ID
   * @param data - Update data
   * @returns Updated email account
   * @throws {DatabaseOperationError} If account not found
   */
  updateEmailAccount(id: string, data: Partial<EmailAccountInput>): Promise<EmailAccount>;
  
  /**
   * Deletes an email account and all associated emails
   * @param id - Email account ID
   * @throws {DatabaseOperationError} If account not found
   */
  deleteEmailAccount(id: string): Promise<void>;
  
  // Email Operations
  
  /**
   * Creates a new email record
   * @param data - Email data
   * @returns Created email
   * @throws {ValidationError} If data is invalid
   */
  createEmail(data: CreateEmailInput): Promise<Email>;
  
  /**
   * Creates multiple email records in a batch
   * @param data - Array of email data
   * @returns Array of created emails
   */
  createEmails(data: CreateEmailInput[]): Promise<Email[]>;
  
  /**
   * Retrieves emails for an account with pagination
   * @param accountId - Email account ID
   * @param options - Query options for filtering and pagination
   * @returns Paginated email results
   */
  getEmails(accountId: string, options?: QueryOptions): Promise<PaginatedResult<Email>>;
  
  /**
   * Retrieves emails by thread ID
   * @param threadId - Thread ID
   * @returns Array of emails in the thread
   */
  getEmailsByThread(threadId: string): Promise<Email[]>;
  
  /**
   * Retrieves a specific email
   * @param id - Email ID
   * @returns Email if found, null otherwise
   */
  getEmail(id: string): Promise<Email | null>;
  
  /**
   * Marks an email as processed
   * @param id - Email ID
   * @throws {DatabaseOperationError} If email not found
   */
  markEmailProcessed(id: string): Promise<void>;
  
  /**
   * Updates email metadata
   * @param id - Email ID
   * @param metadata - Metadata to update
   * @returns Updated email
   */
  updateEmailMetadata(id: string, metadata: Record<string, any>): Promise<Email>;
  
  /**
   * Deletes an email and all associated responses
   * @param id - Email ID
   * @throws {DatabaseOperationError} If email not found
   */
  deleteEmail(id: string): Promise<void>;
  
  // AI Response Operations
  
  /**
   * Saves an AI-generated response
   * @param data - AI response data
   * @returns Created AI response
   * @throws {ValidationError} If data is invalid
   */
  saveAIResponse(data: AIResponseInput): Promise<AIResponse>;
  
  /**
   * Retrieves the AI response for an email
   * @param emailId - Email ID
   * @returns AI response if found, null otherwise
   */
  getAIResponse(emailId: string): Promise<AIResponse | null>;
  
  /**
   * Retrieves all AI responses for a user
   * @param userId - User ID
   * @param options - Query options
   * @returns Paginated AI response results
   */
  getAIResponses(userId: string, options?: QueryOptions): Promise<PaginatedResult<AIResponse>>;
  
  /**
   * Updates an AI response
   * @param id - AI response ID
   * @param data - Update data
   * @returns Updated AI response
   * @throws {DatabaseOperationError} If response not found
   */
  updateAIResponse(id: string, data: Partial<AIResponseInput>): Promise<AIResponse>;
  
  /**
   * Marks an AI response as sent
   * @param id - AI response ID
   * @param sentAt - Timestamp when sent
   * @throws {DatabaseOperationError} If response not found
   */
  markAIResponseSent(id: string, sentAt: Date): Promise<void>;
  
  // Template Operations
  
  /**
   * Creates a new response template
   * @param userId - User ID
   * @param data - Template data
   * @returns Created template
   * @throws {ValidationError} If data is invalid
   */
  createTemplate(userId: string, data: TemplateInput): Promise<ResponseTemplate>;
  
  /**
   * Retrieves all templates for a user
   * @param userId - User ID
   * @param category - Optional category filter
   * @returns Array of templates
   */
  getTemplates(userId: string, category?: string): Promise<ResponseTemplate[]>;
  
  /**
   * Retrieves a specific template
   * @param id - Template ID
   * @returns Template if found, null otherwise
   */
  getTemplate(id: string): Promise<ResponseTemplate | null>;
  
  /**
   * Updates a template
   * @param id - Template ID
   * @param data - Update data
   * @returns Updated template
   * @throws {DatabaseOperationError} If template not found
   */
  updateTemplate(id: string, data: Partial<TemplateInput>): Promise<ResponseTemplate>;
  
  /**
   * Increments the usage count for a template
   * @param id - Template ID
   * @throws {DatabaseOperationError} If template not found
   */
  incrementTemplateUsage(id: string): Promise<void>;
  
  /**
   * Deletes a template
   * @param id - Template ID
   * @throws {DatabaseOperationError} If template not found
   */
  deleteTemplate(id: string): Promise<void>;
  
  // Notification Operations
  
  /**
   * Logs a notification
   * @param data - Notification data
   * @returns Created notification log
   */
  logNotification(data: NotificationInput): Promise<NotificationLog>;
  
  /**
   * Updates notification status
   * @param id - Notification ID
   * @param status - New status
   * @param errorMessage - Optional error message if failed
   * @returns Updated notification log
   */
  updateNotificationStatus(
    id: string,
    status: 'sent' | 'failed' | 'delivered',
    errorMessage?: string
  ): Promise<NotificationLog>;
  
  /**
   * Retrieves notifications for a user
   * @param userId - User ID
   * @param options - Query options
   * @returns Paginated notification results
   */
  getNotifications(userId: string, options?: QueryOptions): Promise<PaginatedResult<NotificationLog>>;
  
  // Usage Tracking
  
  /**
   * Increments a usage metric for a user
   * @param userId - User ID
   * @param metric - Metric type to increment
   * @param amount - Amount to increment by (default: 1)
   */
  incrementUsage(userId: string, metric: MetricType, amount?: number): Promise<void>;
  
  /**
   * Retrieves usage metrics for a user in a specific period
   * @param userId - User ID
   * @param metric - Metric type
   * @param period - Period start date
   * @returns Usage metric if found, null otherwise
   */
  getUsage(userId: string, metric: MetricType, period: Date): Promise<UsageMetric | null>;
  
  /**
   * Retrieves all usage metrics for a user
   * @param userId - User ID
   * @param periodStart - Period start date
   * @param periodEnd - Period end date
   * @returns Array of usage metrics
   */
  getAllUsage(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageMetric[]>;
  
  /**
   * Checks if user has exceeded usage limits
   * @param userId - User ID
   * @param metric - Metric type
   * @param limit - Usage limit
   * @returns true if limit exceeded, false otherwise
   */
  checkUsageLimit(userId: string, metric: MetricType, limit: number): Promise<boolean>;
  
  // Real-time Subscriptions
  
  /**
   * Subscribes to new emails for an account
   * @param accountId - Email account ID
   * @param callback - Function to call when new email arrives
   * @returns Unsubscribe function
   */
  subscribeToEmails(accountId: string, callback: SubscriptionCallback<Email>): UnsubscribeFunction;
  
  /**
   * Subscribes to AI responses for a user
   * @param userId - User ID
   * @param callback - Function to call when new response is generated
   * @returns Unsubscribe function
   */
  subscribeToResponses(userId: string, callback: SubscriptionCallback<AIResponse>): UnsubscribeFunction;
  
  /**
   * Subscribes to notification updates for a user
   * @param userId - User ID
   * @param callback - Function to call when notification status changes
   * @returns Unsubscribe function
   */
  subscribeToNotifications(userId: string, callback: SubscriptionCallback<NotificationLog>): UnsubscribeFunction;
  
  // Transaction Support
  
  /**
   * Executes operations within a database transaction
   * @param callback - Function containing operations to run in transaction
   * @returns Result of the transaction
   * @throws {DatabaseOperationError} If transaction fails
   */
  transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>): Promise<T>;
  
  // Utility Operations
  
  /**
   * Executes a raw SQL query (use with caution)
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Query results
   */
  rawQuery<T = any>(query: string, params?: any[]): Promise<T[]>;
  
  /**
   * Gets database statistics
   * @returns Object containing database stats
   */
  getStats(): Promise<{
    totalUsers: number;
    totalEmails: number;
    totalResponses: number;
    activeConnections: number;
    databaseSize: number;
  }>;
  
  /**
   * Performs database cleanup operations
   * @param olderThan - Delete data older than this date
   * @returns Number of records cleaned up
   */
  cleanup(olderThan: Date): Promise<number>;
}