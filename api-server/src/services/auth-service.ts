import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config';
import { db } from '../lib/database';
import { 
  AuthResponse, 
  ConflictError, 
  UnauthorizedError,
  ValidationError 
} from '../types';

export class AuthService {
  async register(email: string, password: string): Promise<AuthResponse> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
    
    // Validate password strength
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    
    // Check if user exists
    const existing = await db.getUserByEmail(email);
    if (existing) {
      throw new ConflictError('User already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user (password will be stored separately in auth system)
    const user = await db.createUser({
      email,
      settings: {
        notifications_enabled: true,
        auto_reply: false,
        language: 'en',
        theme: 'light',
        ai_tone: 'professional'
      }
    });
    
    // Store password hash separately (would normally use Supabase Auth)
    // For now, we'll store it in user metadata
    await db.updateUser(user.id, {
      settings: {
        ...user.settings,
        passwordHash: hashedPassword // Temporary solution
      }
    });
    
    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);
    
    // Store refresh token
    await db.storeRefreshToken(user.id, refreshToken);
    
    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }
  
  async login(email: string, password: string): Promise<AuthResponse> {
    // Get user
    const user = await db.getUserByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }
    
    // Verify password (temporary: stored in settings)
    const passwordHash = user.settings?.passwordHash;
    if (!passwordHash) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }
    
    // Update last login
    await db.updateLastLogin(user.id);
    
    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);
    
    // Store refresh token
    await db.storeRefreshToken(user.id, refreshToken);
    
    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.JWT_SECRET) as {
        userId: string;
        email: string;
      };
      
      // Check if refresh token is stored
      const isValid = await db.validateRefreshToken(payload.userId, refreshToken);
      if (!isValid) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      
      // Get user
      const user = await db.getUserById(payload.userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }
      
      // Generate new tokens
      const tokens = this.generateTokens(user);
      
      // Store new refresh token
      await db.storeRefreshToken(user.id, tokens.refreshToken);
      
      return {
        user: this.sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      }
      throw error;
    }
  }
  
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await db.revokeRefreshToken(userId, refreshToken);
    } else {
      await db.revokeAllRefreshTokens(userId);
    }
  }
  
  private generateTokens(user: any) {
    const payload = {
      userId: user.id,
      email: user.email,
    };
    
    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as string | number,
    });
    
    const refreshToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.REFRESH_TOKEN_EXPIRES_IN as string | number,
    });
    
    return { accessToken, refreshToken };
  }
  
  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return {
      id: sanitized.id,
      email: sanitized.email,
      createdAt: sanitized.created_at,
      updatedAt: sanitized.updated_at,
    };
  }
  
  async validateToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as {
        userId: string;
        email: string;
      };
      return payload;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }
}

export const authService = new AuthService();