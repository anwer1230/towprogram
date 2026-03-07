import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Fetchers
export function useTgStatus() {
  return useQuery({
    queryKey: [api.tg.auth.status.path],
    queryFn: async () => {
      const res = await fetch(api.tg.auth.status.path);
      if (!res.ok) throw new Error("Failed to fetch TG status");
      return api.tg.auth.status.responses[200].parse(await res.json());
    }
  });
}

export function useTgGroups() {
  return useQuery({
    queryKey: [api.tg.groups.list.path],
    queryFn: async () => {
      const res = await fetch(api.tg.groups.list.path);
      if (!res.ok) throw new Error("Failed to fetch groups");
      return api.tg.groups.list.responses[200].parse(await res.json());
    }
  });
}

// Auth Mutations
export function useTgLogin() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.tg.auth.login.input>) => {
      const res = await fetch(api.tg.auth.login.path, {
        method: api.tg.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Login failed");
      return api.tg.auth.login.responses[200].parse(json);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}

export function useTgVerifyCode() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.tg.auth.verifyCode.input>) => {
      const res = await fetch(api.tg.auth.verifyCode.path, {
        method: api.tg.auth.verifyCode.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Verification failed");
      return api.tg.auth.verifyCode.responses[200].parse(json);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tg.auth.status.path] }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}

export function useTgVerifyPassword() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.tg.auth.verifyPassword.input>) => {
      const res = await fetch(api.tg.auth.verifyPassword.path, {
        method: api.tg.auth.verifyPassword.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Password failed");
      return api.tg.auth.verifyPassword.responses[200].parse(json);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tg.auth.status.path] }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}

// Group Mutations
export function useTgCreateGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.tg.groups.create.input>) => {
      const res = await fetch(api.tg.groups.create.path, {
        method: api.tg.groups.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add group");
      return api.tg.groups.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tg.groups.list.path] });
      toast({ title: "Group added successfully" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}

export function useTgDeleteGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.tg.groups.delete.path, { id });
      const res = await fetch(url, { method: api.tg.groups.delete.method });
      if (!res.ok) throw new Error("Failed to delete group");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tg.groups.list.path] }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}

// Action Mutations
export function useTgAction(actionName: "sender" | "monitor") {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const endpoint = api.tg.actions[actionName];
  
  return useMutation({
    mutationFn: async (data: z.infer<typeof endpoint.input>) => {
      const res = await fetch(endpoint.path, {
        method: endpoint.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Action failed");
      return endpoint.responses[200].parse(json);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.tg.auth.status.path] });
      toast({ title: "Success", description: data.message });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}
