import os
import json
import time
import logging
import asyncio
import threading
import queue
import re
import uuid
from threading import Lock
from datetime import datetime
from flask import Flask, session, request, jsonify, render_template, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "telegram_secret_2024")
app.config['PERMANENT_SESSION_LIFETIME'] = 3600 * 24 * 30
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    ping_timeout=60,
    ping_interval=25,
    logger=False,
    engineio_logger=False
)

SESSIONS_DIR = "sessions"
UPLOADS_DIR = "static/uploads"
os.makedirs(SESSIONS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

API_ID = os.environ.get('TELEGRAM_API_ID')
API_HASH = os.environ.get('TELEGRAM_API_HASH')

PREDEFINED_USERS = {
    "user_1": {"id": "user_1", "name": "المستخدم الأول", "icon": "fas fa-user", "color": "#5865f2"},
    "user_2": {"id": "user_2", "name": "المستخدم الثاني", "icon": "fas fa-user-tie", "color": "#3ba55c"},
    "user_3": {"id": "user_3", "name": "المستخدم الثالث", "icon": "fas fa-user-graduate", "color": "#faa81a"},
    "user_4": {"id": "user_4", "name": "المستخدم الرابع", "icon": "fas fa-user-cog", "color": "#ed4245"},
    "user_5": {"id": "user_5", "name": "المستخدم الخامس", "icon": "fas fa-user-astronaut", "color": "#6f42c1"},
}

USERS = {}
USERS_LOCK = Lock()


def save_settings(user_id, settings):
    try:
        path = os.path.join(SESSIONS_DIR, f"{user_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"Save settings error: {e}")
        return False


def load_settings(user_id):
    try:
        path = os.path.join(SESSIONS_DIR, f"{user_id}.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Load settings error: {e}")
    return {}


class UserData:
    def __init__(self, user_id):
        self.user_id = user_id
        self.client_manager = None
        self.settings = {}
        self.stats = {"sent": 0, "errors": 0, "alerts": 0}
        self.connected = False
        self.authenticated = False
        self.awaiting_code = False
        self.awaiting_password = False
        self.phone_code_hash = None
        self.monitoring_active = False
        self.is_running = False
        self.thread = None
        self.phone_number = None
        self.auto_replies = []


class TelegramClientManager:
    def __init__(self, user_id):
        self.user_id = user_id
        self.client = None
        self.loop = None
        self.thread = None
        self.stop_flag = threading.Event()
        self.is_ready = threading.Event()
        self.event_handlers_registered = False
        self.scheduled_thread = None
        self.scheduled_stop = threading.Event()

    def start_client_thread(self):
        if self.thread and self.thread.is_alive():
            return True
        self.stop_flag.clear()
        self.is_ready.clear()
        self.thread = threading.Thread(target=self._run_client_loop, daemon=True)
        self.thread.start()
        return self.is_ready.wait(timeout=30)

    def _run_client_loop(self):
        try:
            from telethon import TelegramClient, events
            from telethon.sessions import StringSession

            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

            session_file = os.path.join(SESSIONS_DIR, f"{self.user_id}_session")
            if API_ID and API_HASH:
                self.client = TelegramClient(session_file, int(API_ID), API_HASH, loop=self.loop)
            else:
                logger.error("API_ID or API_HASH not set")
                self.is_ready.set()
                return

            self.loop.run_until_complete(self._client_main())
        except Exception as e:
            logger.error(f"Client thread error: {e}")
            self.is_ready.set()
        finally:
            if self.loop and not self.loop.is_closed():
                self.loop.close()

    async def _client_main(self):
        try:
            await self.client.connect()
            self.is_ready.set()

            if await self.client.is_user_authorized():
                with USERS_LOCK:
                    ud = USERS.get(self.user_id)
                    if ud:
                        ud.authenticated = True
                        ud.connected = True
                await self._register_event_handlers()
                logger.info(f"✅ {self.user_id} auto-authorized")

            while not self.stop_flag.is_set():
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Client main error: {e}")
        finally:
            if self.client:
                try:
                    await self.client.disconnect()
                except:
                    pass

    async def _register_event_handlers(self):
        if self.event_handlers_registered:
            return
        try:
            from telethon import events

            @self.client.on(events.NewMessage)
            async def handler(event):
                await self._handle_message(event)

            self.event_handlers_registered = True
            logger.info(f"✅ Event handlers registered for {self.user_id}")
        except Exception as e:
            logger.error(f"Register handlers error: {e}")

    async def _handle_message(self, event):
        try:
            if not event.message.text:
                return

            chat = await event.get_chat()
            chat_title = getattr(chat, 'title', None) or getattr(chat, 'first_name', 'مستخدم')

            with USERS_LOCK:
                ud = USERS.get(self.user_id)
                if not ud:
                    return
                settings = ud.settings
                monitoring = ud.monitoring_active
                auto_replies = ud.auto_replies or settings.get('auto_replies', [])

            msg_text = event.message.text
            msg_lower = msg_text.lower()

            if monitoring:
                watch_words = settings.get('watch_words', [])
                for kw in watch_words:
                    if kw and kw.lower() in msg_lower:
                        sender = await event.get_sender()
                        sender_name = getattr(sender, 'first_name', '') or getattr(sender, 'username', '') or 'غير معروف'
                        alert = {
                            "keyword": kw,
                            "group": chat_title,
                            "message": msg_text[:300],
                            "sender": sender_name,
                            "timestamp": datetime.now().strftime('%H:%M:%S')
                        }
                        with USERS_LOCK:
                            ud2 = USERS.get(self.user_id)
                            if ud2:
                                ud2.stats['alerts'] = ud2.stats.get('alerts', 0) + 1
                        socketio.emit('new_alert', alert, to=self.user_id)
                        socketio.emit('log_update', {"message": f"🚨 تنبيه: '{kw}' في {chat_title}"}, to=self.user_id)
                        try:
                            notif = f"🚨 تنبيه: {kw}\n📊 {chat_title}\n👤 {sender_name}\n💬 {msg_text[:200]}"
                            await self.client.send_message('me', notif)
                        except:
                            pass

            for rule in auto_replies:
                kw = rule.get('keyword', '')
                reply = rule.get('reply', '')
                if kw and reply and kw.lower() in msg_lower:
                    try:
                        await self.client.send_message(await event.get_chat(), reply)
                        socketio.emit('log_update', {"message": f"🤖 رد تلقائي في {chat_title}"}, to=self.user_id)
                    except:
                        pass
                    break
        except Exception as e:
            logger.error(f"Handle message error: {e}")

    def run_coroutine(self, coro, timeout=30):
        if not self.loop:
            raise Exception("Event loop not initialized")
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return future.result(timeout=timeout)

    def stop(self):
        self.stop_flag.set()
        self.scheduled_stop.set()

    def start_scheduled(self, groups, message, image_path, interval_minutes):
        self.scheduled_stop.clear()
        self.scheduled_thread = threading.Thread(
            target=self._scheduled_worker,
            args=(groups, message, image_path, interval_minutes),
            daemon=True
        )
        self.scheduled_thread.start()

    def stop_scheduled(self):
        self.scheduled_stop.set()

    def _scheduled_worker(self, groups, message, image_path, interval_minutes):
        socketio.emit('log_update', {"message": f"📅 بدأ الإرسال المجدول كل {interval_minutes} دقيقة"}, to=self.user_id)
        while not self.scheduled_stop.is_set():
            try:
                self.run_coroutine(self._send_to_groups(groups, message, image_path))
            except Exception as e:
                logger.error(f"Scheduled send error: {e}")
            self.scheduled_stop.wait(timeout=interval_minutes * 60)
        socketio.emit('log_update', {"message": "⏹ تم إيقاف الإرسال المجدول"}, to=self.user_id)

    async def _send_to_groups(self, groups, message, image_path):
        sent = 0
        errors = 0
        for group in groups:
            try:
                entity = group.strip()
                if not entity.startswith('@') and not entity.lstrip('-').isdigit():
                    entity = '@' + entity

                try:
                    chat = await self.client.get_entity(entity)
                except:
                    chat = await self.client.get_entity(int(entity) if entity.lstrip('-').isdigit() else entity)

                if image_path and os.path.exists(image_path):
                    await self.client.send_file(chat, image_path, caption=message or "")
                elif message:
                    await self.client.send_message(chat, message)

                sent += 1
                socketio.emit('log_update', {"message": f"✅ أُرسل إلى {group}"}, to=self.user_id)
                await asyncio.sleep(2)
            except Exception as e:
                errors += 1
                socketio.emit('log_update', {"message": f"❌ خطأ في {group}: {str(e)[:60]}"}, to=self.user_id)

        with USERS_LOCK:
            ud = USERS.get(self.user_id)
            if ud:
                ud.stats['sent'] = ud.stats.get('sent', 0) + sent
                ud.stats['errors'] = ud.stats.get('errors', 0) + errors

        socketio.emit('log_update', {"message": f"📊 اكتمل: {sent} ناجح، {errors} خطأ"}, to=self.user_id)


def get_or_create_user(user_id):
    with USERS_LOCK:
        if user_id not in USERS:
            ud = UserData(user_id)
            ud.settings = load_settings(user_id)
            ud.auto_replies = ud.settings.get('auto_replies', [])
            if ud.settings.get('phone'):
                ud.phone_number = ud.settings['phone']
            USERS[user_id] = ud
        return USERS[user_id]


def get_current_user_id():
    uid = session.get('user_id', 'user_1')
    if uid not in PREDEFINED_USERS:
        uid = 'user_1'
        session['user_id'] = uid
    return uid


@app.route("/")
def index():
    uid = get_current_user_id()
    get_or_create_user(uid)
    settings = load_settings(uid)
    settings['api_configured'] = bool(API_ID and API_HASH)
    return render_template('index.html',
                           settings=settings,
                           predefined_users=PREDEFINED_USERS,
                           current_user_id=uid)


@app.route("/static/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOADS_DIR, filename)


@app.route("/api/get_login_status")
def api_get_login_status():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)
    return jsonify({
        "logged_in": ud.authenticated,
        "connected": ud.connected,
        "awaiting_code": ud.awaiting_code,
        "awaiting_password": ud.awaiting_password,
        "is_running": ud.is_running,
        "phone": ud.phone_number or "",
        "no_user_selected": False
    })


@app.route("/api/get_stats")
def api_get_stats():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)
    return jsonify({"success": True, **ud.stats})


@app.route("/api/get_settings")
def api_get_settings():
    uid = get_current_user_id()
    settings = load_settings(uid)
    return jsonify({"success": True, "settings": settings})


@app.route("/api/get_auto_replies")
def api_get_auto_replies():
    uid = get_current_user_id()
    settings = load_settings(uid)
    return jsonify({"success": True, "auto_replies": settings.get('auto_replies', [])})


@app.route("/api/switch_user", methods=["POST"])
def api_switch_user():
    data = request.json or {}
    new_uid = data.get('user_id')
    if not new_uid or new_uid not in PREDEFINED_USERS:
        return jsonify({"success": False, "message": "مستخدم غير صالح"})
    session['user_id'] = new_uid
    session.permanent = True
    ud = get_or_create_user(new_uid)
    settings = load_settings(new_uid)
    return jsonify({
        "success": True,
        "message": f"✅ تم التبديل إلى {PREDEFINED_USERS[new_uid]['name']}",
        "settings": settings,
        "logged_in": ud.authenticated,
        "awaiting_code": ud.awaiting_code,
        "awaiting_password": ud.awaiting_password,
        "is_running": ud.is_running
    })


@app.route("/api/save_login", methods=["POST"])
def api_save_login():
    uid = get_current_user_id()
    data = request.json or {}
    phone = data.get('phone', '').strip()

    if not phone:
        return jsonify({"success": False, "message": "أدخل رقم الهاتف"})

    if not API_ID or not API_HASH:
        return jsonify({"success": False, "message": "⚠️ TELEGRAM_API_ID و TELEGRAM_API_HASH غير محددة في المتغيرات البيئية"})

    try:
        from telethon.errors import FloodWaitError

        ud = get_or_create_user(uid)
        socketio.emit('log_update', {"message": "🔄 جارٍ إعداد الاتصال..."}, to=uid)

        if not ud.client_manager:
            ud.client_manager = TelegramClientManager(uid)

        if not ud.client_manager.start_client_thread():
            return jsonify({"success": False, "message": "❌ فشل في تشغيل العميل"})

        is_auth = ud.client_manager.run_coroutine(ud.client_manager.client.is_user_authorized())

        if is_auth:
            with USERS_LOCK:
                ud.authenticated = True
                ud.connected = True
                ud.phone_number = phone
            settings = load_settings(uid)
            settings['phone'] = phone
            save_settings(uid, settings)
            socketio.emit('log_update', {"message": "✅ تم الدخول تلقائياً (جلسة محفوظة)"}, to=uid)
            return jsonify({"success": True, "message": "✅ أنت مسجل دخول بالفعل", "status": "already_authorized"})

        socketio.emit('log_update', {"message": f"📱 إرسال كود إلى {phone}..."}, to=uid)

        try:
            sent = ud.client_manager.run_coroutine(ud.client_manager.client.send_code_request(phone))
        except FloodWaitError as e:
            return jsonify({"success": False, "message": f"⏳ انتظر {e.seconds} ثانية"})

        with USERS_LOCK:
            ud.awaiting_code = True
            ud.phone_code_hash = sent.phone_code_hash
            ud.phone_number = phone
            ud.connected = True

        settings = load_settings(uid)
        settings['phone'] = phone
        save_settings(uid, settings)

        socketio.emit('log_update', {"message": "📱 تم إرسال كود التحقق"}, to=uid)
        return jsonify({"success": True, "message": "📱 تم إرسال كود التحقق إلى هاتفك", "status": "code_sent"})

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"success": False, "message": f"❌ خطأ: {str(e)}"})


@app.route("/api/verify_code", methods=["POST"])
def api_verify_code():
    uid = get_current_user_id()
    data = request.json or {}
    code = data.get('code', '').strip()

    if not code:
        return jsonify({"success": False, "message": "أدخل كود التحقق"})

    try:
        from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError, PhoneCodeExpiredError

        ud = get_or_create_user(uid)
        if not ud.client_manager or not ud.awaiting_code:
            return jsonify({"success": False, "message": "❌ لا يوجد طلب كود نشط"})

        user = ud.client_manager.run_coroutine(
            ud.client_manager.client.sign_in(ud.phone_number, code, phone_code_hash=ud.phone_code_hash)
        )

        with USERS_LOCK:
            ud.authenticated = True
            ud.connected = True
            ud.awaiting_code = False

        ud.client_manager.run_coroutine(ud.client_manager._register_event_handlers())
        socketio.emit('log_update', {"message": "✅ تم تسجيل الدخول بنجاح"}, to=uid)
        return jsonify({"success": True, "message": "✅ تم تسجيل الدخول بنجاح", "status": "success"})

    except Exception as e:
        err_name = type(e).__name__
        if 'SessionPasswordNeeded' in err_name:
            with USERS_LOCK:
                ud = USERS.get(uid)
                if ud:
                    ud.awaiting_code = False
                    ud.awaiting_password = True
            return jsonify({"success": True, "message": "🔒 أدخل كلمة مرور التحقق بخطوتين", "status": "password_required"})
        elif 'PhoneCodeInvalid' in err_name:
            return jsonify({"success": False, "message": "❌ كود غير صحيح"})
        elif 'PhoneCodeExpired' in err_name:
            return jsonify({"success": False, "message": "❌ انتهت صلاحية الكود"})
        return jsonify({"success": False, "message": f"❌ {str(e)}", "status": "error"})


@app.route("/api/verify_password", methods=["POST"])
def api_verify_password():
    uid = get_current_user_id()
    data = request.json or {}
    password = data.get('password', '')

    if not password:
        return jsonify({"success": False, "message": "أدخل كلمة المرور"})

    try:
        from telethon.errors import PasswordHashInvalidError

        ud = get_or_create_user(uid)
        if not ud.client_manager:
            return jsonify({"success": False, "message": "❌ العميل غير متصل"})

        ud.client_manager.run_coroutine(
            ud.client_manager.client.sign_in(password=password)
        )

        with USERS_LOCK:
            ud.authenticated = True
            ud.connected = True
            ud.awaiting_password = False

        ud.client_manager.run_coroutine(ud.client_manager._register_event_handlers())
        socketio.emit('log_update', {"message": "✅ تم التحقق من كلمة المرور"}, to=uid)
        return jsonify({"success": True, "message": "✅ تم تسجيل الدخول بنجاح"})

    except Exception as e:
        err_name = type(e).__name__
        if 'PasswordHashInvalid' in err_name:
            return jsonify({"success": False, "message": "❌ كلمة المرور غير صحيحة"})
        return jsonify({"success": False, "message": f"❌ {str(e)}"})


@app.route("/api/reset_login", methods=["POST"])
def api_reset_login():
    uid = get_current_user_id()
    try:
        ud = get_or_create_user(uid)
        if ud.client_manager:
            ud.client_manager.stop()
            ud.client_manager = None

        session_file = os.path.join(SESSIONS_DIR, f"{uid}_session.session")
        if os.path.exists(session_file):
            os.remove(session_file)

        with USERS_LOCK:
            ud.authenticated = False
            ud.connected = False
            ud.awaiting_code = False
            ud.awaiting_password = False
            ud.phone_code_hash = None
            ud.is_running = False
            ud.monitoring_active = False

        socketio.emit('log_update', {"message": "🔓 تم تسجيل الخروج"}, to=uid)
        return jsonify({"success": True, "message": "✅ تم تسجيل الخروج"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/api/save_settings", methods=["POST"])
def api_save_settings():
    uid = get_current_user_id()
    data = request.json or {}
    settings = load_settings(uid)
    settings.update(data)
    save_settings(uid, settings)
    with USERS_LOCK:
        ud = USERS.get(uid)
        if ud:
            ud.settings = settings
    return jsonify({"success": True, "message": "✅ تم حفظ الإعدادات"})


@app.route("/api/save_auto_replies", methods=["POST"])
def api_save_auto_replies():
    uid = get_current_user_id()
    data = request.json or {}
    auto_replies = data.get('auto_replies', [])
    settings = load_settings(uid)
    settings['auto_replies'] = auto_replies
    save_settings(uid, settings)
    with USERS_LOCK:
        ud = USERS.get(uid)
        if ud:
            ud.auto_replies = auto_replies
            ud.settings = settings
    return jsonify({"success": True, "message": f"✅ تم حفظ {len(auto_replies)} قاعدة رد تلقائي"})


@app.route("/api/upload_image", methods=["POST"])
def api_upload_image():
    uid = get_current_user_id()
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "لا توجد صورة"})

    file = request.files['image']
    if not file.filename:
        return jsonify({"success": False, "message": "اختر ملفاً"})

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
        return jsonify({"success": False, "message": "صيغة غير مدعومة"})

    filename = f"{uid}_{int(time.time())}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    file.save(filepath)

    settings = load_settings(uid)
    settings['image_path'] = filepath
    settings['image_filename'] = file.filename
    settings['image_paths'] = [filepath]
    save_settings(uid, settings)

    with USERS_LOCK:
        ud = USERS.get(uid)
        if ud:
            ud.settings = settings

    return jsonify({
        "success": True,
        "message": "✅ تم رفع الصورة",
        "filepath": filepath,
        "filename": file.filename
    })


@app.route("/api/remove_image", methods=["POST"])
def api_remove_image():
    uid = get_current_user_id()
    settings = load_settings(uid)
    img = settings.get('image_path')
    if img and os.path.exists(img):
        try:
            os.remove(img)
        except:
            pass
    settings.pop('image_path', None)
    settings.pop('image_filename', None)
    settings.pop('image_paths', None)
    save_settings(uid, settings)
    return jsonify({"success": True, "message": "✅ تم حذف الصورة"})


@app.route("/api/send_now", methods=["POST"])
def api_send_now():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)

    if not ud.authenticated:
        return jsonify({"success": False, "message": "❌ يجب تسجيل الدخول أولاً"})

    data = request.json or {}
    groups = data.get('groups', [])
    message = data.get('message', '')

    if not groups:
        return jsonify({"success": False, "message": "❌ أضف مجموعات أولاً"})

    settings = load_settings(uid)
    image_path = settings.get('image_path')

    socketio.emit('log_update', {"message": f"📤 بدء الإرسال إلى {len(groups)} مجموعة..."}, to=uid)

    def send_async():
        try:
            ud.client_manager.run_coroutine(
                ud.client_manager._send_to_groups(groups, message, image_path)
            )
        except Exception as e:
            socketio.emit('log_update', {"message": f"❌ خطأ: {str(e)[:100]}"}, to=uid)

    threading.Thread(target=send_async, daemon=True).start()
    return jsonify({"success": True, "message": "✅ جارٍ الإرسال..."})


@app.route("/api/start_monitoring", methods=["POST"])
def api_start_monitoring():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)

    if not ud.authenticated:
        return jsonify({"success": False, "message": "❌ يجب تسجيل الدخول أولاً"})

    with USERS_LOCK:
        ud.monitoring_active = True
        ud.is_running = True

    settings = load_settings(uid)
    watch_words = settings.get('watch_words', [])
    socketio.emit('log_update', {"message": f"🚀 بدأت المراقبة - {len(watch_words)} كلمة"}, to=uid)
    socketio.emit('monitoring_status', {"is_running": True, "monitoring_active": True}, to=uid)
    return jsonify({"success": True, "message": "✅ تم تشغيل المراقبة"})


@app.route("/api/stop_monitoring", methods=["POST"])
def api_stop_monitoring():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)
    with USERS_LOCK:
        ud.monitoring_active = False
        ud.is_running = False
    socketio.emit('log_update', {"message": "⏹ تم إيقاف المراقبة"}, to=uid)
    socketio.emit('monitoring_status', {"is_running": False, "monitoring_active": False}, to=uid)
    return jsonify({"success": True, "message": "✅ تم إيقاف المراقبة"})


@app.route("/api/start_scheduled", methods=["POST"])
def api_start_scheduled():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)

    if not ud.authenticated:
        return jsonify({"success": False, "message": "❌ يجب تسجيل الدخول أولاً"})

    data = request.json or {}
    groups = data.get('groups', [])
    message = data.get('message', '')
    interval = int(data.get('interval', 60))

    if not groups:
        return jsonify({"success": False, "message": "❌ أضف مجموعات أولاً"})

    settings = load_settings(uid)
    image_path = settings.get('image_path')

    ud.client_manager.start_scheduled(groups, message, image_path, interval)
    return jsonify({"success": True, "message": f"✅ بدأ الإرسال المجدول كل {interval} دقيقة"})


@app.route("/api/stop_scheduled", methods=["POST"])
def api_stop_scheduled():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)
    if ud.client_manager:
        ud.client_manager.stop_scheduled()
    return jsonify({"success": True, "message": "✅ تم إيقاف الإرسال المجدول"})


@app.route("/api/join_group", methods=["POST"])
def api_join_group():
    uid = get_current_user_id()
    ud = get_or_create_user(uid)

    if not ud.authenticated:
        return jsonify({"success": False, "message": "❌ يجب تسجيل الدخول أولاً"})

    data = request.json or {}
    link = data.get('link', '').strip()

    if not link:
        return jsonify({"success": False, "message": "أدخل رابط المجموعة"})

    async def do_join():
        from telethon import functions
        try:
            if 't.me/+' in link or 'joinchat' in link:
                hash_part = link.split('+')[-1] if '+' in link else link.split('/')[-1]
                await ud.client_manager.client(functions.messages.ImportChatInviteRequest(hash=hash_part))
            else:
                entity = link.split('/')[-1]
                await ud.client_manager.client(functions.channels.JoinChannelRequest(channel=entity))
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    try:
        result = ud.client_manager.run_coroutine(do_join())
        if result['success']:
            socketio.emit('log_update', {"message": f"✅ تم الانضمام إلى {link}"}, to=uid)
            return jsonify({"success": True, "message": "✅ تم الانضمام بنجاح"})
        else:
            return jsonify({"success": False, "message": f"❌ {result.get('error', 'خطأ')}"})
    except Exception as e:
        return jsonify({"success": False, "message": f"❌ {str(e)}"})


@socketio.on('connect')
def handle_connect():
    uid = session.get('user_id', 'user_1')
    if uid not in PREDEFINED_USERS:
        uid = 'user_1'
        session['user_id'] = uid
    join_room(uid)
    get_or_create_user(uid)
    emit('connection_confirmed', {'user_id': uid})
    logger.info(f"✅ Connected: {uid}")


@socketio.on('join_user_room')
def handle_join_room(data):
    uid = data.get('user_id', session.get('user_id', 'user_1'))
    if uid in PREDEFINED_USERS:
        join_room(uid)


@socketio.on('disconnect')
def handle_disconnect():
    uid = session.get('user_id', 'user_1')
    leave_room(uid)


@socketio.on('heartbeat')
def handle_heartbeat(data):
    pass


def load_all_sessions():
    logger.info("Loading existing sessions...")
    for filename in os.listdir(SESSIONS_DIR):
        if filename.endswith('.json'):
            uid = filename.split('.')[0]
            if uid in PREDEFINED_USERS:
                settings = load_settings(uid)
                if settings.get('phone'):
                    ud = get_or_create_user(uid)
                    logger.info(f"Loaded settings for {uid}")


if __name__ == '__main__':
    load_all_sessions()
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"🚀 Starting on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
