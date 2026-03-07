import { db } from "./db";
import {
  tgGroups, tgAuthSession, tgSettings,
  waSettings,
  type TgGroup, type InsertTgGroup,
  type TgSetting,
  type WaSettings, type InsertWaSettings
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Telegram
  getTgGroups(): Promise<TgGroup[]>;
  createTgGroup(group: InsertTgGroup): Promise<TgGroup>;
  deleteTgGroup(id: number): Promise<void>;
  getTgSetting(key: string): Promise<TgSetting | undefined>;
  setTgSetting(key: string, value: string): Promise<TgSetting>;

  // WhatsApp
  getWaSettings(userId: string): Promise<WaSettings | undefined>;
  updateWaSettings(userId: string, settings: Partial<InsertWaSettings>): Promise<WaSettings>;
}

export class DatabaseStorage implements IStorage {
  // Telegram
  async getTgGroups(): Promise<TgGroup[]> {
    return await db.select().from(tgGroups);
  }
  async createTgGroup(group: InsertTgGroup): Promise<TgGroup> {
    const [created] = await db.insert(tgGroups).values(group).returning();
    return created;
  }
  async deleteTgGroup(id: number): Promise<void> {
    await db.delete(tgGroups).where(eq(tgGroups.id, id));
  }
  async getTgSetting(key: string): Promise<TgSetting | undefined> {
    const [setting] = await db.select().from(tgSettings).where(eq(tgSettings.key, key));
    return setting;
  }
  async setTgSetting(key: string, value: string): Promise<TgSetting> {
    const existing = await this.getTgSetting(key);
    if (existing) {
      const [updated] = await db.update(tgSettings).set({ value }).where(eq(tgSettings.key, key)).returning();
      return updated;
    } else {
      const [created] = await db.insert(tgSettings).values({ key, value }).returning();
      return created;
    }
  }

  // WhatsApp
  async getWaSettings(userId: string): Promise<WaSettings | undefined> {
    const [settings] = await db.select().from(waSettings).where(eq(waSettings.userId, userId));
    return settings;
  }
  async updateWaSettings(userId: string, settings: Partial<InsertWaSettings>): Promise<WaSettings> {
    const existing = await this.getWaSettings(userId);
    if (existing) {
      const [updated] = await db.update(waSettings).set(settings).where(eq(waSettings.userId, userId)).returning();
      return updated;
    } else {
      const [created] = await db.insert(waSettings).values({ userId, ...settings }).returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
