import { test, expect, Page } from '@playwright/test';

test.describe('Chat Functionality', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create new chat', async () => {
    // Click new chat button
    await page.click('[data-testid="new-chat"]');
    
    // Select AI provider
    await page.click('[data-testid="provider-select"]');
    await page.click('text=OpenAI');
    
    // Select model
    await page.click('[data-testid="model-select"]');
    await page.click('text=GPT-4');
    
    // Start chat
    await page.click('[data-testid="start-chat"]');
    
    // Should navigate to chat interface
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
  });

  test('should send and receive messages', async () => {
    // Navigate to existing chat or create new
    await page.click('[data-testid="new-chat"]');
    await page.click('[data-testid="quick-start"]');
    
    // Type message
    const messageInput = page.locator('[data-testid="message-input"]');
    await messageInput.fill('Hello, can you help me with JavaScript?');
    
    // Send message
    await page.click('[data-testid="send-message"]');
    
    // Wait for user message to appear
    await expect(page.locator('.message.user').last()).toContainText('Hello, can you help me with JavaScript?');
    
    // Wait for AI response
    await expect(page.locator('.message.assistant').last()).toBeVisible({ timeout: 30000 });
    
    // Response should contain some text
    const aiResponse = await page.locator('.message.assistant').last().textContent();
    expect(aiResponse?.length).toBeGreaterThan(10);
  });

  test('should handle streaming responses', async () => {
    await page.goto('/chat');
    
    // Enable streaming
    await page.click('[data-testid="settings-toggle"]');
    await page.check('[data-testid="streaming-enabled"]');
    await page.click('[data-testid="settings-close"]');
    
    // Send message
    await page.fill('[data-testid="message-input"]', 'Tell me a short story');
    await page.click('[data-testid="send-message"]');
    
    // Check for streaming indicator
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();
    
    // Wait for streaming to complete
    await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible({ timeout: 30000 });
  });

  test('should display chat history', async () => {
    // Open sidebar
    await page.click('[data-testid="toggle-sidebar"]');
    
    // Should show chat history
    await expect(page.locator('[data-testid="chat-history"]')).toBeVisible();
    
    // Should have at least one chat
    const chatItems = page.locator('[data-testid="chat-item"]');
    await expect(chatItems).toHaveCount(1, { timeout: 5000 });
  });

  test('should search through chats', async () => {
    // Open sidebar
    await page.click('[data-testid="toggle-sidebar"]');
    
    // Search for specific content
    await page.fill('[data-testid="search-chats"]', 'JavaScript');
    await page.press('[data-testid="search-chats"]', 'Enter');
    
    // Should filter chats
    await expect(page.locator('[data-testid="chat-item"]:visible')).toHaveCount(1);
  });

  test('should edit message', async () => {
    await page.goto('/chat');
    
    // Send a message
    await page.fill('[data-testid="message-input"]', 'Original message');
    await page.click('[data-testid="send-message"]');
    
    // Wait for message to appear
    await page.waitForSelector('.message.user');
    
    // Edit the message
    await page.hover('.message.user').last();
    await page.click('[data-testid="edit-message"]');
    
    const editInput = page.locator('[data-testid="edit-input"]');
    await editInput.clear();
    await editInput.fill('Edited message');
    await page.click('[data-testid="save-edit"]');
    
    // Check message was updated
    await expect(page.locator('.message.user').last()).toContainText('Edited message');
  });

  test('should delete message', async () => {
    await page.goto('/chat');
    
    // Send a message
    await page.fill('[data-testid="message-input"]', 'Message to delete');
    await page.click('[data-testid="send-message"]');
    
    // Wait for message
    await page.waitForSelector('.message.user');
    
    // Delete message
    await page.hover('.message.user').last();
    await page.click('[data-testid="delete-message"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');
    
    // Message should be gone
    await expect(page.locator('text=Message to delete')).not.toBeVisible();
  });

  test('should copy message to clipboard', async () => {
    await page.goto('/chat');
    
    // Send a message
    const testMessage = 'Copy this message';
    await page.fill('[data-testid="message-input"]', testMessage);
    await page.click('[data-testid="send-message"]');
    
    // Wait for message
    await page.waitForSelector('.message.user');
    
    // Copy message
    await page.hover('.message.user').last();
    await page.click('[data-testid="copy-message"]');
    
    // Check clipboard (would need permissions in real test)
    await expect(page.locator('[data-testid="copy-success"]')).toBeVisible();
  });

  test('should regenerate AI response', async () => {
    await page.goto('/chat');
    
    // Send message
    await page.fill('[data-testid="message-input"]', 'What is 2+2?');
    await page.click('[data-testid="send-message"]');
    
    // Wait for response
    await page.waitForSelector('.message.assistant');
    
    // Regenerate response
    await page.hover('.message.assistant').last();
    await page.click('[data-testid="regenerate-response"]');
    
    // Should show regenerating indicator
    await expect(page.locator('[data-testid="regenerating"]')).toBeVisible();
    
    // Wait for new response
    await expect(page.locator('[data-testid="regenerating"]')).not.toBeVisible({ timeout: 30000 });
  });

  test('should handle attachment uploads', async () => {
    await page.goto('/chat');
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf');
    
    // Should show file preview
    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-name"]')).toContainText('test-document.pdf');
    
    // Send message with attachment
    await page.fill('[data-testid="message-input"]', 'Please analyze this document');
    await page.click('[data-testid="send-message"]');
    
    // Should show attachment in message
    await expect(page.locator('.message.user [data-testid="attachment"]')).toBeVisible();
  });

  test('should export chat', async () => {
    await page.goto('/chat');
    
    // Send some messages
    await page.fill('[data-testid="message-input"]', 'Test message 1');
    await page.click('[data-testid="send-message"]');
    await page.waitForSelector('.message.assistant');
    
    // Open export menu
    await page.click('[data-testid="chat-menu"]');
    await page.click('[data-testid="export-chat"]');
    
    // Select format
    await page.click('[data-testid="export-json"]');
    
    // Download should start (check with download promise in real test)
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should switch between AI providers', async () => {
    await page.goto('/chat');
    
    // Open settings
    await page.click('[data-testid="chat-settings"]');
    
    // Switch provider
    await page.click('[data-testid="provider-dropdown"]');
    await page.click('text=Anthropic');
    
    // Switch model
    await page.click('[data-testid="model-dropdown"]');
    await page.click('text=Claude 3 Opus');
    
    // Apply changes
    await page.click('[data-testid="apply-settings"]');
    
    // Send message
    await page.fill('[data-testid="message-input"]', 'Hello Claude');
    await page.click('[data-testid="send-message"]');
    
    // Should show provider indicator
    await expect(page.locator('[data-testid="provider-badge"]')).toContainText('Claude');
  });

  test('should handle keyboard shortcuts', async () => {
    await page.goto('/chat');
    
    // Test new chat shortcut (Cmd/Ctrl + K)
    await page.keyboard.press('Control+K');
    await expect(page.locator('[data-testid="new-chat-modal"]')).toBeVisible();
    await page.keyboard.press('Escape');
    
    // Test search shortcut (Cmd/Ctrl + /)
    await page.keyboard.press('Control+/');
    await expect(page.locator('[data-testid="search-chats"]')).toBeFocused();
    
    // Test send message (Enter in input)
    await page.fill('[data-testid="message-input"]', 'Keyboard test');
    await page.keyboard.press('Enter');
    await expect(page.locator('.message.user').last()).toContainText('Keyboard test');
  });

  test('should show typing indicator', async () => {
    await page.goto('/chat');
    
    // Send message
    await page.fill('[data-testid="message-input"]', 'Long question requiring thought');
    await page.click('[data-testid="send-message"]');
    
    // Should show typing indicator
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
    
    // Should disappear when response arrives
    await expect(page.locator('[data-testid="typing-indicator"]')).not.toBeVisible({ timeout: 30000 });
  });

  test('should handle network errors gracefully', async () => {
    await page.goto('/chat');
    
    // Simulate offline
    await page.context().setOffline(true);
    
    // Try to send message
    await page.fill('[data-testid="message-input"]', 'Offline test');
    await page.click('[data-testid="send-message"]');
    
    // Should show error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/network|offline/i);
    
    // Go back online
    await page.context().setOffline(false);
    
    // Retry should work
    await page.click('[data-testid="retry-message"]');
    await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 30000 });
  });
});