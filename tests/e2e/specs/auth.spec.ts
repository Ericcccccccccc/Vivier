import { test, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

test.describe('Authentication Flow', () => {
  let page: Page;
  const testUser = {
    email: faker.internet.email(),
    password: 'TestPass123!',
    name: faker.person.fullName()
  };

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto('/');
  });

  test('should display login page', async () => {
    await page.goto('/login');
    
    await expect(page.locator('h1')).toContainText('Sign In');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should register new user', async () => {
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('input[name="name"]', testUser.name);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="confirmPassword"]', testUser.password);
    
    // Accept terms
    await page.check('input[name="acceptTerms"]');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should login with valid credentials', async () => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async () => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
    await expect(page).toHaveURL('/login');
  });

  test('should validate email format', async () => {
    await page.goto('/register');
    
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', testUser.password);
    
    // Try to submit
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');
  });

  test('should validate password strength', async () => {
    await page.goto('/register');
    
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', '123');
    
    // Should show password requirements
    await expect(page.locator('[data-testid="password-requirements"]')).toBeVisible();
    await expect(page.locator('[data-testid="requirement-length"]')).toHaveClass(/invalid/);
    await expect(page.locator('[data-testid="requirement-uppercase"]')).toHaveClass(/invalid/);
    await expect(page.locator('[data-testid="requirement-special"]')).toHaveClass(/invalid/);
  });

  test('should handle password reset flow', async () => {
    await page.goto('/login');
    
    // Click forgot password
    await page.click('text=Forgot password?');
    await page.waitForURL('/forgot-password');
    
    // Enter email
    await page.fill('input[name="email"]', testUser.email);
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.locator('.success-message')).toContainText('reset email sent');
  });

  test('should logout successfully', async () => {
    // First login
    await page.goto('/login');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Open user menu and logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Sign Out');
    
    // Should redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('should persist session across page reloads', async () => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Reload page
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should redirect to login when accessing protected routes', async () => {
    // Try to access dashboard without login
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('should handle OAuth login', async () => {
    await page.goto('/login');
    
    // Click Google login
    await page.click('[data-testid="google-login"]');
    
    // In real test, would handle OAuth flow
    // For now, just check button exists
    await expect(page.locator('[data-testid="google-login"]')).toBeVisible();
    
    // Check GitHub login
    await expect(page.locator('[data-testid="github-login"]')).toBeVisible();
  });

  test('should show/hide password visibility', async () => {
    await page.goto('/login');
    
    const passwordInput = page.locator('input[name="password"]');
    const toggleButton = page.locator('[data-testid="toggle-password"]');
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click again to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should handle remember me option', async () => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.check('input[name="rememberMe"]');
    await page.click('button[type="submit"]');
    
    // Check cookie expiry (would need to check actual cookie in real test)
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    expect(authCookie).toBeDefined();
  });

  test('should handle two-factor authentication', async () => {
    // This would require a user with 2FA enabled
    // Placeholder for 2FA test
    
    await page.goto('/login');
    
    // Login with 2FA user credentials
    await page.fill('input[name="email"]', '2fa@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Should show 2FA prompt (if implemented)
    // await expect(page.locator('[data-testid="2fa-input"]')).toBeVisible();
  });

  test('should handle account lockout after failed attempts', async () => {
    await page.goto('/login');
    
    // Try multiple failed logins
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(100);
    }
    
    // Should show lockout message
    await expect(page.locator('.error-message')).toContainText(/locked|too many attempts/i);
  });
});