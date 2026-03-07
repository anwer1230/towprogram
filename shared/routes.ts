import { z } from "zod";
import { insertTgGroupSchema, tgGroups, insertWaSettingsSchema, waSettings } from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  tg: {
    groups: {
      list: { method: "GET" as const, path: "/api/tg/groups" as const, responses: { 200: z.array(z.custom<typeof tgGroups.$inferSelect>()) } },
      create: { method: "POST" as const, path: "/api/tg/groups" as const, input: insertTgGroupSchema, responses: { 201: z.custom<typeof tgGroups.$inferSelect>(), 400: errorSchemas.validation } },
      delete: { method: "DELETE" as const, path: "/api/tg/groups/:id" as const, responses: { 204: z.void() } },
    },
    settings: {
      get: { method: "GET" as const, path: "/api/tg/settings/:key" as const, responses: { 200: z.object({ key: z.string(), value: z.string() }), 404: errorSchemas.validation } },
      update: { method: "POST" as const, path: "/api/tg/settings" as const, input: z.object({ key: z.string(), value: z.string() }), responses: { 200: z.object({ key: z.string(), value: z.string() }), 400: errorSchemas.validation } },
    },
    auth: {
      login: { method: "POST" as const, path: "/api/tg/auth/login" as const, input: z.object({ phoneNumber: z.string() }), responses: { 200: z.object({ message: z.string(), phoneCodeHash: z.string() }), 400: errorSchemas.validation, 500: errorSchemas.internal } },
      verifyCode: { method: "POST" as const, path: "/api/tg/auth/verify-code" as const, input: z.object({ phoneNumber: z.string(), phoneCodeHash: z.string(), code: z.string() }), responses: { 200: z.object({ message: z.string(), needsPassword: z.boolean().optional() }), 400: errorSchemas.validation, 500: errorSchemas.internal } },
      verifyPassword: { method: "POST" as const, path: "/api/tg/auth/verify-password" as const, input: z.object({ password: z.string() }), responses: { 200: z.object({ message: z.string() }), 400: errorSchemas.validation, 500: errorSchemas.internal } },
      status: { method: "GET" as const, path: "/api/tg/auth/status" as const, responses: { 200: z.object({ isLoggedIn: z.boolean(), isSenderRunning: z.boolean(), isMonitorRunning: z.boolean() }) } },
    },
    actions: {
      sender: { method: "POST" as const, path: "/api/tg/actions/sender" as const, input: z.object({ action: z.enum(["start", "stop"]) }), responses: { 200: z.object({ message: z.string() }), 400: errorSchemas.validation, 500: errorSchemas.internal } },
      monitor: { method: "POST" as const, path: "/api/tg/actions/monitor" as const, input: z.object({ action: z.enum(["start", "stop"]) }), responses: { 200: z.object({ message: z.string() }), 400: errorSchemas.validation, 500: errorSchemas.internal } },
      joinLinks: { method: "POST" as const, path: "/api/tg/actions/join-links" as const, input: z.object({ text: z.string() }), responses: { 200: z.object({ message: z.string(), linksFound: z.array(z.string()) }), 400: errorSchemas.validation, 500: errorSchemas.internal } },
      search: { method: "POST" as const, path: "/api/tg/actions/search" as const, input: z.object({ keyword: z.string() }), responses: { 200: z.array(z.object({ name: z.string(), username: z.string(), link: z.string(), description: z.string().optional() })), 400: errorSchemas.validation, 500: errorSchemas.internal } },
      joinChat: { method: "POST" as const, path: "/api/tg/actions/join-chat" as const, input: z.object({ link: z.string() }), responses: { 200: z.object({ message: z.string() }), 400: errorSchemas.validation, 500: errorSchemas.internal } },
    }
  },
  wa: {
    init: { method: 'GET' as const, path: '/api/wa/init' as const, responses: { 200: z.object({ currentUser: z.any(), predefinedUsers: z.record(z.any()), settings: z.any(), connectionStatus: z.string(), stats: z.object({ sent: z.number(), errors: z.number() }) }) } },
    connect: { method: 'POST' as const, path: '/api/wa/connect' as const, input: z.object({ method: z.enum(['qr', 'phone']).optional().default('qr'), phoneNumber: z.string().optional() }), responses: { 200: z.object({ success: z.boolean(), message: z.string() }) } },
    logout: { method: 'POST' as const, path: '/api/wa/logout' as const, responses: { 200: z.object({ success: z.boolean(), message: z.string() }) } },
    saveSettings: { method: 'POST' as const, path: '/api/wa/settings' as const, input: z.object({ message: z.string().optional(), groups: z.string().optional(), interval_seconds: z.union([z.string(), z.number()]).optional(), loop_interval_seconds: z.union([z.string(), z.number()]).optional(), watch_words: z.string().optional(), send_type: z.string().optional(), scheduled_time: z.string().optional(), }), responses: { 200: z.object({ success: z.boolean() }) } },
    sendNow: { method: 'POST' as const, path: '/api/wa/send-now' as const, input: z.object({ message: z.string().optional(), groups: z.string().optional(), images: z.array(z.object({ data: z.string(), type: z.string() })).optional() }), responses: { 200: z.object({ success: z.boolean(), message: z.string() }) } },
    extractLinks: { method: 'POST' as const, path: '/api/wa/extract-links' as const, input: z.object({ text: z.string().optional() }), responses: { 200: z.object({ success: z.boolean(), links: z.array(z.any()) }) } },
    autoJoin: { method: 'POST' as const, path: '/api/wa/auto-join' as const, input: z.object({ links: z.array(z.any()), delay: z.number().optional() }), responses: { 200: z.object({ success: z.boolean(), message: z.string() }) } },
    stats: { method: 'GET' as const, path: '/api/wa/stats' as const, responses: { 200: z.object({ sent: z.number(), errors: z.number() }) } },
    loginStatus: { method: 'GET' as const, path: '/api/wa/login-status' as const, responses: { 200: z.object({ logged_in: z.boolean(), connected: z.boolean(), is_running: z.boolean() }) } },
    switchUser: { method: 'POST' as const, path: '/api/wa/switch-user' as const, input: z.object({ userId: z.string() }), responses: { 200: z.object({ success: z.boolean(), message: z.string() }) } }
  }
};

export const ws = {
  send: {
    start_monitoring: z.object({}),
    stop_monitoring: z.object({}),
    switch_user: z.object({ userId: z.string() })
  },
  receive: {
    connection_confirmed: z.object({ user_id: z.string(), user_name: z.string() }),
    users_list: z.object({ current_user: z.string(), users: z.record(z.any()) }),
    qr_code: z.object({ qr: z.string().nullable() }),
    pairing_code: z.object({ code: z.string() }),
    user_switched: z.object({ current_user: z.string(), user_name: z.string() }),
    connection_status: z.object({ status: z.string() }),
    login_status: z.object({ logged_in: z.boolean(), connected: z.boolean(), awaiting_code: z.boolean(), awaiting_password: z.boolean(), is_running: z.boolean() }),
    log_update: z.object({ message: z.string() }),
    new_alert: z.object({ keyword: z.string(), group: z.string(), message: z.string(), timestamp: z.string(), sender: z.string(), message_time: z.string(), message_id: z.string(), full_message: z.string() }),
    show_notification: z.object({ title: z.string(), body: z.string(), icon: z.string() }),
    stats_update: z.object({ sent: z.number(), errors: z.number() }),
    join_progress: z.object({ current: z.number(), total: z.number(), link: z.string() }),
    join_stats: z.object({ success: z.number(), fail: z.number(), already_joined: z.number() }),
    auto_join_completed: z.object({ success: z.number(), fail: z.number(), already_joined: z.number(), total: z.number() }),
    user_info: z.object({ phone: z.string(), name: z.string() })
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(':' + key)) url = url.replace(':' + key, String(value));
    });
  }
  return url;
}