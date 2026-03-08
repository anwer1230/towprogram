import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram";

// Default configuration for the bot
const API_ID = 22043994;
const API_HASH = '56f64582b363d367280db96586b97801';

// Global state for Telegram
let client: TelegramClient | null = null;
let senderInterval: NodeJS.Timeout | null = null;
let isSenderRunning = false;
let isMonitorRunning = false;

const KEYWORDS = [
  "اريد مساعدة", "ابي مساعدة", "من يسوي تكليف", "من يحل", "عندي بحث", "معي واجب",
  "عندي اسايمنت", "من يسوي اسايمنت", "ابي رسالةر", "من يسوي سكليف",
  "ابي شخص مضمون", "ابي مختص", "هيليب", "من يستطيع", "تعرفون احد", "تعرفون شخص",
  "من يساعدني", "من يعرف مختص", "ابي مختص", "مين يعرف يحل واجب", "من يحل واجبات الجامعه",
  "أحتاج مساعدتكم", "ابي احد يسوي بحث", "اريد مساعدة", "ابي مساعدة", "من يسوي تكليف",
  "من يحل", "عندي بحث", "معي واجب", "عندي اسايمنت", "من يسوي اسايمنت", "ابي سكليف",
  "ابي عذر", "من يسوي سكليف", "ابي شخص مضمون", "ابي مختص", "هيليب", "من يستطيع",
  "تعرفون احد", "تعرفون شخص", "من يساعدني", "من يعرف مختص", "ابي مختص", "مين يعرف يحل واجب",
  "من يحل واجبات الجامعه", "أحتاج مساعدتكم", "ابي احد يسوي بحث", "عندي بحث", "مين يعرف مختص",
  "من يعرف احد كويس", "طلب تعليمي", "خدمه تعليمية", "مساعدة دراسية", "حل واجبات", "عمل بحوث"
];

const DEFAULT_MESSAGE_TEXT = `
📚 السلام عليكم 
للخدمات الطلابيه المتكامله
💞من خدمتنا💞
✅بحوث جامعية(عربي ✅+إنجليزي)
✅ رسائل ماجستير 
✅ اعذار طبيه صحتي ورقي pdf
✅واجبات وأنشطة
✅عروض باوربوينت power point
✅تقارير وتكاليف 
✅ *حل كويزات /ميد/فاينل* 
✅ محاسبة + ادارة أعمال
✅ حاسوب + برمجة 
✅ مشاريع تخرج Project 
✅تلخيص محاضرات
✅تصميم سيره ذاتيه احترافيه 
✅تصاميم بوستر وبروشور
✅كتابه تقارير تدريب
اسعار مناسبه للجميع
↩️للتواصل واتس اب
https://wa.me/+966562570935
`;

async function getMessageText() {
  const setting = await storage.getTgSetting("message_text");
  return setting?.value || DEFAULT_MESSAGE_TEXT;
}

async function initTelegramClient() {
  const sessionData = await storage.getTgSetting("session");
  const session = new StringSession(sessionData?.value || "");
  
  client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  if (sessionData?.value) {
    try {
      await client.connect();
      if (await client.checkAuthorization()) {
         console.log("Telegram connected with existing session.");
      } else {
         console.log("Telegram session expired or invalid.");
      }
    } catch (err) {
      console.error("Failed to connect with existing session", err);
    }
  }
}

import { PREDEFINED_USERS, users, WhatsAppClientManager } from "./whatsapp";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize Telegram client globally
  initTelegramClient().catch(console.error);

  const io = app.get("io");

  // ==========================================
  // Telegram Routes
  // ==========================================
  app.get(api.tg.groups.list.path, async (req, res) => {
    const groups = await storage.getTgGroups();
    res.json(groups);
  });
  
  app.post(api.tg.groups.create.path, async (req, res) => {
    try {
      const inputData = api.tg.groups.create.input.parse(req.body);
      const group = await storage.createTgGroup(inputData);
      res.status(201).json(group);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });
  
  app.delete(api.tg.groups.delete.path, async (req, res) => {
    await storage.deleteTgGroup(Number(req.params.id));
    res.status(204).end();
  });
  
  app.get(api.tg.settings.get.path, async (req, res) => {
    const setting = await storage.getTgSetting(req.params.key);
    if (!setting) return res.status(404).json({ message: "Not found" });
    res.json(setting);
  });
  
  app.post(api.tg.settings.update.path, async (req, res) => {
    try {
      const inputData = api.tg.settings.update.input.parse(req.body);
      const setting = await storage.setTgSetting(inputData.key, inputData.value);
      res.json(setting);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get(api.tg.auth.status.path, async (req, res) => {
    const isLoggedIn = client ? await client.checkAuthorization() : false;
    res.json({ isLoggedIn, isSenderRunning, isMonitorRunning });
  });

  app.post(api.tg.auth.login.path, async (req, res) => {
    try {
      const { phoneNumber } = api.tg.auth.login.input.parse(req.body);
      client = new TelegramClient(new StringSession(""), API_ID, API_HASH, {
        connectionRetries: 5,
      });
      await client.connect();

      const { phoneCodeHash } = await client.sendCode(
        {
          apiId: API_ID,
          apiHash: API_HASH,
        },
        phoneNumber
      );

      res.json({ message: "Code sent", phoneCodeHash });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to send code" });
    }
  });

  app.post(api.tg.auth.verifyCode.path, async (req, res) => {
    try {
      const { phoneNumber, phoneCodeHash, code } = api.tg.auth.verifyCode.input.parse(req.body);
      if (!client) {
        return res.status(400).json({ message: "Client not initialized" });
      }

      try {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash,
            phoneCode: code,
          })
        );
      } catch (signInErr: any) {
        if (signInErr.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          return res.json({ message: "Password required", needsPassword: true });
        }
        throw signInErr;
      }

      const sessionString = (client.session as StringSession).save();
      await storage.setTgSetting("session", sessionString);
      
      res.json({ message: "Logged in successfully", needsPassword: false });
    } catch (err: any) {
      console.error("Verify code error:", err);
      res.status(400).json({ message: err.errorMessage || err.message || "Invalid code" });
    }
  });

  app.post(api.tg.auth.verifyPassword.path, async (req, res) => {
    try {
      const { password } = api.tg.auth.verifyPassword.input.parse(req.body);
      if (!client) {
        return res.status(400).json({ message: "Client not initialized" });
      }

      // Get password info from server
      const pwData = await client.invoke(new Api.account.GetPassword());
      console.log("Password data from server:", { hasCurrentAlgo: !!pwData.currentAlgo });
      
      let passwordInput: any;

      // Check if account has 2FA with SRP
      if (pwData.currentAlgo && pwData.currentAlgo.className !== 'PasswordKdfAlgoUnknown') {
        try {
          // Use SRP for 2FA password
          const newAlgo = await client.computeNewPasswordHash(pwData.currentAlgo, Buffer.from(password, 'utf-8'));
          passwordInput = new Api.auth.PasswordInputSRP({
            srpId: pwData.srpId,
            a: newAlgo.a,
            m1: newAlgo.m1,
          });
        } catch (srpErr: any) {
          console.warn("SRP failed:", srpErr.message);
          // Fallback to simpler method
          passwordInput = new Api.auth.PasswordInputNoSRP({
            srpsessionid: pwData.srpId,
            password: Buffer.from(password, 'utf-8'),
          });
        }
      } else {
        // No SRP, use simple password
        passwordInput = new Api.auth.PasswordInputNoSRP({
          srpsessionid: pwData.srpId || 0,
          password: Buffer.from(password, 'utf-8'),
        });
      }

      // Send the password input
      await client.invoke(
        new Api.auth.CheckPassword({
          password: passwordInput,
        })
      );

      const sessionString = (client.session as StringSession).save();
      await storage.setTgSetting("session", sessionString);
      
      res.json({ message: "Logged in successfully" });
    } catch (err: any) {
      console.error("Password verification error:", err);
      const errorMsg = err.errorMessage || err.message || "Invalid password or 2FA code";
      res.status(400).json({ message: errorMsg });
    }
  });

  app.post(api.tg.actions.sender.path, async (req, res) => {
    try {
      const { action } = api.tg.actions.sender.input.parse(req.body);
      
      if (!client || !await client.checkAuthorization()) {
        return res.status(401).json({ message: "Not logged in" });
      }

      if (action === "start") {
        if (isSenderRunning) return res.json({ message: "Already running" });
        
        isSenderRunning = true;
        const messageText = await getMessageText();
        const groups = await storage.getTgGroups();
        
        const sendMessages = async () => {
          for (const group of groups) {
            try {
              let target = group.url;
              if (target.includes('joinchat')) {
                const hash = target.split('/').pop();
                if (hash) {
                   target = hash; // Handle joinchat properly or join first
                }
              } else {
                target = target.split('/').pop() || target;
              }
              await client?.sendMessage(target, { message: messageText });
            } catch (err) {
              console.error(`Failed to send to ${group.url}:`, err);
            }
          }
        };

        await sendMessages();
        senderInterval = setInterval(sendMessages, 1000 * 60 * 60); // Every hour
        
        res.json({ message: "Sender started" });
      } else {
        isSenderRunning = false;
        if (senderInterval) clearInterval(senderInterval);
        res.json({ message: "Sender stopped" });
      }
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });


  // ==========================================
  // WhatsApp Routes
  // ==========================================

  app.get(api.wa.init.path, async (req, res) => {
    const userId = "user_1"; // Default
    if (!users[userId]) {
      users[userId] = {
        is_running: false,
        stats: { sent: 0, errors: 0 }
      };
    }
    
    if (!users[userId].clientManager) {
      users[userId].clientManager = new WhatsAppClientManager(userId, io);
    }

    const settings = await storage.getWaSettings(userId) || {
      userId,
      message: "",
      groups: [],
      intervalSeconds: 3600,
      watchWords: [],
      sendType: "manual",
      scheduledTime: "",
      loopIntervalSeconds: 0
    };

    res.json({
      currentUser: PREDEFINED_USERS[userId],
      predefinedUsers: PREDEFINED_USERS,
      settings,
      connectionStatus: users[userId].clientManager.connectionState,
      stats: users[userId].stats
    });
  });

  app.post(api.wa.connect.path, async (req, res) => {
    const userId = "user_1";
    try {
      const { method, phoneNumber } = api.wa.connect.input.parse(req.body);
      
      if (!users[userId]) {
        users[userId] = { is_running: false, stats: { sent: 0, errors: 0 } };
      }
      if (!users[userId].clientManager) {
        users[userId].clientManager = new WhatsAppClientManager(userId, io);
      }
      
      await users[userId].clientManager.connect(method as "qr" | "phone", phoneNumber);
      res.json({ success: true, message: "Started connection process" });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get(api.wa.loginStatus.path, (req, res) => {
    const userId = "user_1";
    const manager = users[userId]?.clientManager;
    
    res.json({
      logged_in: manager?.connectionState === 'connected',
      connected: manager?.connectionState === 'connected',
      is_running: users[userId]?.is_running || false
    });
  });

  app.post(api.wa.saveSettings.path, async (req, res) => {
    const userId = "user_1";
    try {
      const data = api.wa.saveSettings.input.parse(req.body);
      
      let groupsArr: string[] = [];
      if (data.groups) {
        groupsArr = data.groups.split('\n').map((g: string) => g.trim()).filter((g: string) => g);
      }
      let watchWordsArr: string[] = [];
      if (data.watch_words) {
        watchWordsArr = data.watch_words.split('\n').map((g: string) => g.trim()).filter((g: string) => g);
      }

      await storage.updateWaSettings(userId, {
        message: data.message,
        groups: groupsArr,
        intervalSeconds: Number(data.interval_seconds) || 3600,
        loopIntervalSeconds: Number(data.loop_interval_seconds) || 0,
        watchWords: watchWordsArr,
        sendType: data.send_type,
        scheduledTime: data.scheduled_time
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get(api.wa.stats.path, (req, res) => {
    const userId = "user_1";
    res.json(users[userId]?.stats || { sent: 0, errors: 0 });
  });

  app.post(api.wa.logout.path, async (req, res) => {
    const userId = "user_1";
    const manager = users[userId]?.clientManager;
    if (manager) {
      await manager.logout();
    }
    res.json({ success: true, message: "Logged out" });
  });


  return httpServer;
}
