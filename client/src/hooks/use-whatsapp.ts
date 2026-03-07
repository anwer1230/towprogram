import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export function useWaInit() {
  return useQuery({
    queryKey: [api.wa.init.path],
    queryFn: async () => {
      const res = await fetch(api.wa.init.path);
      if (!res.ok) throw new Error("Failed to init WA");
      return api.wa.init.responses[200].parse(await res.json());
    }
  });
}

export function useWaConnect() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.wa.connect.input>) => {
      const res = await fetch(api.wa.connect.path, {
        method: api.wa.connect.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Connection request failed");
      return api.wa.connect.responses[200].parse(json);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}

export function useWaLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.wa.logout.path, { method: api.wa.logout.method });
      if (!res.ok) throw new Error("Logout failed");
      return api.wa.logout.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.wa.init.path] });
      toast({ title: "Logged out successfully" });
    }
  });
}

export function useWaSaveSettings() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.wa.saveSettings.input>) => {
      const res = await fetch(api.wa.saveSettings.path, {
        method: api.wa.saveSettings.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return api.wa.saveSettings.responses[200].parse(await res.json());
    },
    onSuccess: () => toast({ title: "Settings saved successfully" }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}

export function useWaSendNow() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.wa.sendNow.input>) => {
      const res = await fetch(api.wa.sendNow.path, {
        method: api.wa.sendNow.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send");
      return api.wa.sendNow.responses[200].parse(json);
    },
    onSuccess: (data) => toast({ title: "Sent", description: data.message }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
}
