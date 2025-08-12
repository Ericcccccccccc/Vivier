// Temporary adapter to fix schema mismatch
import { SupabaseAdapter } from '@email-ai/database';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

export class FixedSupabaseAdapter extends SupabaseAdapter {
  private supabaseClient: any;
  
  constructor(config: any) {
    super(config);
    this.supabaseClient = createClient(config.url, config.serviceKey);
  }
  
  // Override createUser to work with simple schema
  async createUser(data: any): Promise<any> {
    // Don't specify ID - let database auto-generate it
    // Don't include 'name' field - it doesn't exist in schema
    console.log('Creating user with data:', JSON.stringify(data, null, 2));
    
    const { data: user, error } = await this.supabaseClient
      .from('users')
      .insert({
        email: data.email,
        settings: data.settings || {
          notifications: true,
          aiModel: 'groq',
          responseStyle: 'professional',
          emailAccounts: []
        },
        subscription_tier: 'free'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error creating user:', error);
      if (error.code === '23505') {
        throw new Error('User already exists');
      }
      throw error;
    }
    
    console.log('User created successfully:', user);
    return user;
  }
  
  // Override getUserByEmail to work with simple schema  
  async getUserByEmail(email: string): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    return data;
  }
  
  // Override getUser to work with simple schema
  async getUser(id: string): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    return data;
  }
  
  // Add updateUser method
  async updateUser(id: string, updates: any): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user:', error);
      throw error;
    }
    
    return data;
  }
  
  // Add stub for missing methods
  async storeRefreshToken(userId: string, token: string): Promise<void> {
    // Sessions table doesn't exist - store in user settings as temporary solution
    console.log('Storing refresh token for user:', userId);
    
    // First get current settings
    const { data: user, error: fetchError } = await this.supabaseClient
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching user for refresh token:', fetchError);
      return;
    }
    
    // Update settings with refresh token
    const updatedSettings = {
      ...user.settings,
      refresh_token: token
    };
    
    const { error } = await this.supabaseClient
      .from('users')
      .update({ settings: updatedSettings })
      .eq('id', userId);
    
    if (error) {
      console.error('Error storing refresh token:', error);
      // Don't throw - this is not critical for registration
    }
  }
  
  async updateLastLogin(userId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', userId);
    
    if (error) throw error;
  }
  
  async validateRefreshToken(token: string): Promise<any> {
    // Sessions table doesn't exist - check in user settings
    // Note: This is inefficient but works as a temporary solution
    const { data: users, error } = await this.supabaseClient
      .from('users')
      .select('*');
    
    if (error || !users) return null;
    
    // Find user with matching refresh token
    const user = users.find(u => u.settings?.refresh_token === token);
    
    if (!user) return null;
    
    // Return a session-like object
    return {
      user_id: user.id,
      refresh_token: token
    };
  }
  
  async getUserById(id: string): Promise<any> {
    return this.getUser(id);
  }
  
  async revokeRefreshToken(token: string): Promise<void> {
    // Sessions table doesn't exist - clear from user settings
    // First find the user with this token
    const { data: users, error: fetchError } = await this.supabaseClient
      .from('users')
      .select('*');
    
    if (fetchError || !users) {
      console.error('Error fetching users for token revocation:', fetchError);
      return;
    }
    
    const user = users.find(u => u.settings?.refresh_token === token);
    if (!user) return;
    
    // Remove refresh_token from settings
    const { refresh_token, ...settingsWithoutToken } = user.settings || {};
    
    const { error } = await this.supabaseClient
      .from('users')
      .update({ settings: settingsWithoutToken })
      .eq('id', user.id);
    
    if (error) {
      console.error('Error revoking refresh token:', error);
    }
  }
  
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    // Sessions table doesn't exist - clear from user settings
    const { data: user, error: fetchError } = await this.supabaseClient
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single();
    
    if (fetchError || !user) {
      console.error('Error fetching user for token revocation:', fetchError);
      return;
    }
    
    // Remove refresh_token from settings
    const { refresh_token, ...settingsWithoutToken } = user.settings || {};
    
    const { error } = await this.supabaseClient
      .from('users')
      .update({ settings: settingsWithoutToken })
      .eq('id', userId);
    
    if (error) {
      console.error('Error revoking all refresh tokens:', error);
    }
  }
  
  // Email accounts stubs
  async getEmailAccounts(userId: string): Promise<any[]> {
    const { data, error } = await this.supabaseClient
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      // Table might not have data
      return [];
    }
    
    return data || [];
  }
  
  // Templates methods
  async getTemplates(userId: string, category?: string): Promise<any[]> {
    let query = this.supabaseClient
      .from('templates')
      .select('*')
      .eq('user_id', userId);
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return [];
    }
    
    return data || [];
  }
  
  async createTemplate(userId: string, template: any): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('templates')
      .insert({
        ...template,
        user_id: userId,
        id: crypto.randomBytes(16).toString('hex')
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  async getTemplate(id: string): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  }
  
  async deleteTemplate(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('templates')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
  
  // AI response logging
  async logAIGeneration(data: any): Promise<void> {
    const { error } = await this.supabaseClient
      .from('ai_responses')
      .insert({
        id: crypto.randomBytes(16).toString('hex'),
        user_id: data.userId,
        response: data.response,
        style: data.style,
        confidence: data.confidence || 0.95,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Failed to log AI generation:', error);
    }
  }
  
  // Usage metrics
  async getAllUsage(userId: string, start: Date, end: Date): Promise<any[]> {
    const { data, error } = await this.supabaseClient
      .from('usage_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('period_start', start.toISOString())
      .lte('period_end', end.toISOString());
    
    if (error) {
      return [];
    }
    
    return data || [];
  }
  
  // Emails
  async getEmails(accountId: string, options?: any): Promise<any> {
    const { data, error, count } = await this.supabaseClient
      .from('emails')
      .select('*', { count: 'exact' })
      .eq('user_id', accountId)
      .range(0, 19);
    
    if (error) {
      return { data: [], total: 0, page: 1, pageSize: 20 };
    }
    
    return {
      data: data || [],
      total: count || 0,
      page: 1,
      pageSize: 20
    };
  }
}