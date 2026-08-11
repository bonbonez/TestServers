import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "./client";
import type { ConfigResponse, OAuthClient, Settings } from "./types";

const CONFIG_KEY = ["config"];

export function useConfigQuery() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => apiGet<ConfigResponse>("/api/config"),
  });
}

export function useUpdateSettingsMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Settings) =>
      apiPut<Settings>("/api/settings", settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
      onSuccess?.();
    },
  });
}

export function useSaveClientMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ client, originalId }: { client: OAuthClient; originalId?: string }) =>
      originalId
        ? apiPut<OAuthClient>(`/api/clients/${encodeURIComponent(originalId)}`, client)
        : apiPost<OAuthClient>("/api/clients", client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
      onSuccess?.();
    },
  });
}

export function useDeleteClientMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      apiDelete(`/api/clients/${encodeURIComponent(clientId)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
      onSuccess?.();
    },
  });
}
