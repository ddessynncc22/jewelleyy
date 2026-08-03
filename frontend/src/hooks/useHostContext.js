import { useQuery } from "@tanstack/react-query";

import { getHostContext } from "../services/hostService";

// Which host the SPA is served from never changes while the page is open, so this
// is cached indefinitely and shared by every consumer.
export function useHostContext() {
  const { data, isLoading } = useQuery({
    queryKey: ["host-context"],
    queryFn: getHostContext,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return {
    host: data || null,
    loadingHost: isLoading,
    isShopHost: data?.hostType === "tenant",
    isMainHost: data?.hostType === "main",
    // Treat local dev and an unresolved host as permissive so nothing is hidden
    // during development or a transient API failure.
    allowsSuperadmin: !data || data.hostType === "main" || data.hostType === "local",
    shop: data?.shop || null,
  };
}
