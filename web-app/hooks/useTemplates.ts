import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, Template } from '@/lib/api-client';
import { toast } from 'sonner';

export const useTemplates = () => {
  return useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => apiClient.getTemplates(),
  });
};

export const useTemplate = (id: string) => {
  return useQuery<Template>({
    queryKey: ['template', id],
    queryFn: () => apiClient.getTemplate(id),
    enabled: !!id,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (template: Omit<Template, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => 
      apiClient.createTemplate(template),
    onSuccess: (newTemplate) => {
      queryClient.setQueryData(['templates'], (old: Template[] | undefined) => {
        if (!old) return [newTemplate];
        return [...old, newTemplate];
      });
      toast.success('Template created successfully');
    },
    onError: () => {
      toast.error('Failed to create template');
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Template> }) => 
      apiClient.updateTemplate(id, updates),
    onSuccess: (updatedTemplate) => {
      queryClient.setQueryData(['template', updatedTemplate.id], updatedTemplate);
      queryClient.setQueryData(['templates'], (old: Template[] | undefined) => {
        if (!old) return old;
        return old.map(template => 
          template.id === updatedTemplate.id ? updatedTemplate : template
        );
      });
      toast.success('Template updated successfully');
    },
    onError: () => {
      toast.error('Failed to update template');
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTemplate(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(['templates'], (old: Template[] | undefined) => {
        if (!old) return old;
        return old.filter(template => template.id !== deletedId);
      });
      queryClient.removeQueries({ queryKey: ['template', deletedId] });
      toast.success('Template deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });
};