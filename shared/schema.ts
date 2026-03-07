import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Telegram
export const tgGroups = pgTable("tg_groups", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
});

export const tgAuthSession = pgTable("tg_auth_session", {
  id: serial("id").primaryKey(),
  sessionString: text("session_string").notNull(),
});

export const tgSettings = pgTable("tg_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertTgGroupSchema = createInsertSchema(tgGroups).pick({ url: true });
export type TgGroup = typeof tgGroups.$inferSelect;
export type TgAuthSession = typeof tgAuthSession.$inferSelect;
export type TgSetting = typeof tgSettings.$inferSelect;
export type InsertTgGroup = z.infer<typeof insertTgGroupSchema>;

// WhatsApp
export const waSettings = pgTable("wa_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  message: text("message").default(""),
  groups: text("groups").array().default([]),
  intervalSeconds: integer("interval_seconds").default(3600),
  watchWords: text("watch_words").array().default([]),
  sendType: text("send_type").default("manual"),
  scheduledTime: text("scheduled_time").default(""),
  loopIntervalSeconds: integer("loop_interval_seconds").default(0), 
});

export const insertWaSettingsSchema = createInsertSchema(waSettings).omit({ id: true });
export type WaSettings = typeof waSettings.$inferSelect;
export type InsertWaSettings = z.infer<typeof insertWaSettingsSchema>;