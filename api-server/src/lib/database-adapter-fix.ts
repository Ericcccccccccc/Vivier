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
    const userId = crypto.randomBytes(16).toString('hex');
    
    const { data: user, error } = await this.supabaseClient
      .from('users')
      .insert({
        id: userId,
        email: data.email,
        password: data.password || '',
        name: data.name || '',
        settings: data.settings || {
          notifications: true,
          aiModel: 'groq',
          responseStyle: 'professional',
          emailAccounts: []
        }
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        throw new Error('User already exists');
      }
      throw error;
    }
    
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
  
  // Add stub for missing methods
  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('sessions')
      .insert({
        id: crypto.randomBytes(16).toString('hex'),
        user_id: userId,
        access_token: token,
        refresh_token: token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    
    if (error) throw error;
  }
  
  async updateLastLogin(userId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', userId);
    
    if (error) throw error;
  }
  
  async validateRefreshToken(token: string): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('sessions')
      .select('*')
      .eq('refresh_token', token)
      .single();
    
    if (error || !data) return null;
    
    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return null;
    }
    
    return data;
  }
  
  async getUserById(id: string): Promise<any> {
    return this.getUser(id);
  }
  
  async revokeRefreshToken(token: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('sessions')
      .delete()
      .eq('refresh_token', token);
    
    if (error) throw error;
  }
  
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('sessions')
      .delete()
      .eq('user_id', userId);
    
    if (error) throw error;
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