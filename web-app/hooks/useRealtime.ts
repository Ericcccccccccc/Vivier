import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Email } from '@/lib/api-client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function useEmailSubscription(userId: string | undefined) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!supabase || !userId) return;
    
    const channel = supabase
      .channel('emails')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'emails',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        // Add new email to cache
        queryClient.setQueryData(['emails'], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            emails: [payload.new as Email, ...old.emails],
            total: old.total + 1,
          };
        });
        
        // Show notification
        const email = payload.new as Email;
        toast.info(`New email from ${email.from}`, {
          description: email.subject,
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'emails',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const updatedEmail = payload.new as Email;
        
        // Update email in cache
        queryClient.setQueryData(['email', updatedEmail.id], updatedEmail);
        queryClient.setQueryData(['emails'], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            emails: old.emails.map((email: Email) =>
              email.id === updatedEmail.id ? updatedEmail : email
            ),
          };
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_responses',
      }, (payload) => {
        // Update email with AI response
        queryClient.invalidateQueries({ queryKey: ['email', payload.new.email_id] });
        toast.success('AI response generated!');
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

export function useConnectionStatus() {
  useEffect(() => {
    if (!supabase) return;
    
    const handleConnectionChange = (state: string) => {
      if (state === 'disconnected') {
        toast.error('Connection lost. Retrying...', {
          duration: 3000,
        });
      } else if (state === 'connected') {
        toast.success('Connection restored', {
          duration: 2000,
        });
      }
    };
    
    // Listen to connection state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clean up subscriptions on logout
        supabase.removeAllChannels();
      }
    });
    
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);
}