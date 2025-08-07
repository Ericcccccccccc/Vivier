import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, UserSettings, EmailAccount } from '@/lib/api-client';
import { toast } from 'sonner';

export const useSettings = () => {
  return useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) => 
      apiClient.updateSettings(settings),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update settings');
    },
  });
};

export const useAddEmailAccount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (account: Omit<EmailAccount, 'id'>) => 
      apiClient.addEmailAccount(account),
    onSuccess: (newAccount) => {
      queryClient.setQueryData(['settings'], (old: UserSettings | undefined) => {
        if (!old) return old;
        return {
          ...old,
          emailAccounts: [...(old.emailAccounts || []), newAccount],
        };
      });
      toast.success('Email account added successfully');
    },
    onError: () => {
      toast.error('Failed to add email account');
    },
  });
};

export const useRemoveEmailAccount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.removeEmailAccount(id),
    onSuccess: (_, removedId) => {
      queryClient.setQueryData(['settings'], (old: UserSettings | undefined) => {
        if (!old) return old;
        return {
          ...old,
          emailAccounts: old.emailAccounts?.filter(acc => acc.id !== removedId),
        };
      });
      toast.success('Email account removed successfully');
    },
    onError: () => {
      toast.error('Failed to remove email account');
    },
  });
};

export const useToggleEmailAccount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      apiClient.toggleEmailAccount(id, isActive),
    onSuccess: (updatedAccount) => {
      queryClient.setQueryData(['settings'], (old: UserSettings | undefined) => {
        if (!old) return old;
        return {
          ...old,
          emailAccounts: old.emailAccounts?.map(acc => 
            acc.id === updatedAccount.id ? updatedAccount : acc
          ),
        };
      });
      toast.success(`Email account ${updatedAccount.isActive ? 'activated' : 'deactivated'}`);
    },
    onError: () => {
      toast.error('Failed to toggle email account');
    },
  });
};