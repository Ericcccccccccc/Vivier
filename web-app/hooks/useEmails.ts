import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, GetEmailsOptions, PaginatedEmails, Email } from '@/lib/api-client';
import { toast } from 'sonner';

export const useEmails = (options?: GetEmailsOptions) => {
  return useQuery<PaginatedEmails>({
    queryKey: ['emails', options],
    queryFn: () => apiClient.getEmails(options),
    placeholderData: (previousData) => previousData,
  });
};

export const useEmail = (id: string) => {
  return useQuery<Email>({
    queryKey: ['email', id],
    queryFn: () => apiClient.getEmail(id),
    enabled: !!id,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (emailId: string) => apiClient.markAsRead(emailId),
    onMutate: async (emailId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['emails'] });
      await queryClient.cancelQueries({ queryKey: ['email', emailId] });
      
      // Snapshot previous values
      const previousEmails = queryClient.getQueryData(['emails']);
      const previousEmail = queryClient.getQueryData(['email', emailId]);
      
      // Optimistically update
      queryClient.setQueriesData({ queryKey: ['emails'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          emails: old.emails.map((email: Email) =>
            email.id === emailId ? { ...email, isRead: true } : email
          ),
        };
      });
      
      queryClient.setQueryData(['email', emailId], (old: any) => {
        if (!old) return old;
        return { ...old, isRead: true };
      });
      
      return { previousEmails, previousEmail };
    },
    onError: (err, emailId, context) => {
      // Rollback on error
      if (context?.previousEmails) {
        queryClient.setQueryData(['emails'], context.previousEmails);
      }
      if (context?.previousEmail) {
        queryClient.setQueryData(['email', emailId], context.previousEmail);
      }
      toast.error('Failed to mark email as read');
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
};

export const useMarkAsUnread = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (emailId: string) => apiClient.markAsUnread(emailId),
    onMutate: async (emailId) => {
      await queryClient.cancelQueries({ queryKey: ['emails'] });
      await queryClient.cancelQueries({ queryKey: ['email', emailId] });
      
      const previousEmails = queryClient.getQueryData(['emails']);
      const previousEmail = queryClient.getQueryData(['email', emailId]);
      
      queryClient.setQueriesData({ queryKey: ['emails'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          emails: old.emails.map((email: Email) =>
            email.id === emailId ? { ...email, isRead: false } : email
          ),
        };
      });
      
      queryClient.setQueryData(['email', emailId], (old: any) => {
        if (!old) return old;
        return { ...old, isRead: false };
      });
      
      return { previousEmails, previousEmail };
    },
    onError: (err, emailId, context) => {
      if (context?.previousEmails) {
        queryClient.setQueryData(['emails'], context.previousEmails);
      }
      if (context?.previousEmail) {
        queryClient.setQueryData(['email', emailId], context.previousEmail);
      }
      toast.error('Failed to mark email as unread');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
};

export const useDeleteEmail = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (emailId: string) => apiClient.deleteEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      toast.success('Email deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete email');
    },
  });
};

export const useProcessEmail = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (emailId: string) => apiClient.processEmail(emailId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email', variables] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      toast.success('Email processed successfully!');
    },
    onError: () => {
      toast.error('Failed to process email');
    },
  });
};