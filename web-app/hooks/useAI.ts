import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, AIResponse, ResponseStyle } from '@/lib/api-client';
import { toast } from 'sonner';

interface GenerateResponseParams {
  emailId: string;
  style?: ResponseStyle;
}

export const useGenerateResponse = () => {
  const queryClient = useQueryClient();
  
  return useMutation<AIResponse, Error, GenerateResponseParams>({
    mutationFn: ({ emailId, style }) => apiClient.generateResponse(emailId, style),
    onSuccess: (data, variables) => {
      // Update the email with the new AI response
      queryClient.setQueryData(['email', variables.emailId], (old: any) => {
        if (!old) return old;
        return { ...old, aiResponse: data };
      });
      
      // Invalidate emails list to show AI response indicator
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      
      toast.success('Response generated successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to generate response: ${error.message}`);
    },
  });
};

export const useImproveResponse = () => {
  const queryClient = useQueryClient();
  
  return useMutation<AIResponse, Error, { responseId: string; feedback: string }>({
    mutationFn: ({ responseId, feedback }) => 
      apiClient.improveResponse(responseId, feedback),
    onSuccess: (data) => {
      // Update the AI response
      queryClient.setQueryData(['email', data.emailId], (old: any) => {
        if (!old) return old;
        return { ...old, aiResponse: data };
      });
      
      toast.success('Response improved successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to improve response: ${error.message}`);
    },
  });
};