import { useState } from "react";
import { 
  useTgStatus, useTgLogin, useTgVerifyCode, useTgVerifyPassword, 
  useTgGroups, useTgCreateGroup, useTgDeleteGroup, useTgAction 
} from "@/hooks/use-telegram";
import { Loader2, Plus, Trash2, Play, Square, MessageCircle } from "lucide-react";

export default function TelegramDashboard() {
  const { data: status, isLoading } = useTgStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Telegram Console</h1>
          <p className="text-muted-foreground mt-1">Manage your active session and automation tasks.</p>
        </div>
        <div className="px-4 py-2 bg-card border rounded-full text-sm font-medium flex items-center gap-2 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${status?.isLoggedIn ? 'bg-green-500' : 'bg-yellow-500'}`} />
          {status?.isLoggedIn ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {!status?.isLoggedIn ? (
        <TgAuthFlow />
      ) : (
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-6">
            <TgControls status={status} />
          </div>
          <div className="md:col-span-8">
            <TgGroupsManager />
          </div>
        </div>
      )}
    </div>
  );
}

function TgAuthFlow() {
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [phoneHash, setPhoneHash] = useState("");

  const loginMut = useTgLogin();
  const verifyCodeMut = useTgVerifyCode();
  const verifyPassMut = useTgVerifyPassword();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await loginMut.mutateAsync({ phoneNumber: phone });
    setPhoneHash(res.phoneCodeHash);
    setStep("code");
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await verifyCodeMut.mutateAsync({ phoneNumber: phone, phoneCodeHash: phoneHash, code });
    if (res.needsPassword) {
      setStep("password");
    }
  };

  const handlePassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyPassMut.mutateAsync({ password });
  };

  return (
    <div className="bg-card rounded-2xl p-8 border shadow-sm max-w-md mx-auto">
      <div className="w-12 h-12 bg-[#0088cc]/10 rounded-xl flex items-center justify-center mb-6">
        <MessageCircle className="w-6 h-6 text-[#0088cc]" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Connect Account</h2>
      <p className="text-muted-foreground mb-8">Authenticate with your Telegram account to start automating.</p>

      {step === "phone" && (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input 
              type="text" 
              value={phone} 
              onChange={e => setPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-4 py-3 rounded-xl bg-background border focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] outline-none transition-all"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loginMut.isPending}
            className="w-full py-3 px-4 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-xl font-semibold shadow-lg shadow-[#0088cc]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center"
          >
            {loginMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Login Code</label>
            <input 
              type="text" 
              value={code} 
              onChange={e => setCode(e.target.value)}
              placeholder="12345"
              className="w-full px-4 py-3 rounded-xl bg-background border focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] outline-none transition-all"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={verifyCodeMut.isPending}
            className="w-full py-3 px-4 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-xl font-semibold shadow-lg shadow-[#0088cc]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center"
          >
            {verifyCodeMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={handlePassSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">2FA Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] outline-none transition-all"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={verifyPassMut.isPending}
            className="w-full py-3 px-4 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-xl font-semibold shadow-lg shadow-[#0088cc]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center"
          >
            {verifyPassMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Login"}
          </button>
        </form>
      )}
    </div>
  );
}

function TgControls({ status }: { status: any }) {
  const senderMut = useTgAction("sender");
  const monitorMut = useTgAction("monitor");

  const toggleSender = () => {
    senderMut.mutate({ action: status.isSenderRunning ? "stop" : "start" });
  };

  const toggleMonitor = () => {
    monitorMut.mutate({ action: status.isMonitorRunning ? "stop" : "start" });
  };

  return (
    <div className="bg-card rounded-2xl p-6 border shadow-sm space-y-6">
      <h3 className="text-lg font-bold">Automation Modules</h3>
      
      <div className="space-y-4">
        <div className="p-4 rounded-xl border bg-background/50 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Message Sender</p>
            <p className="text-xs text-muted-foreground mt-1">Broadcasts to configured groups</p>
          </div>
          <button 
            onClick={toggleSender}
            disabled={senderMut.isPending}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${status.isSenderRunning ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
          >
            {senderMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : status.isSenderRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
        </div>

        <div className="p-4 rounded-xl border bg-background/50 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Group Monitor</p>
            <p className="text-xs text-muted-foreground mt-1">Listens for keywords and links</p>
          </div>
          <button 
            onClick={toggleMonitor}
            disabled={monitorMut.isPending}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${status.isMonitorRunning ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
          >
            {monitorMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : status.isMonitorRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function TgGroupsManager() {
  const { data: groups, isLoading } = useTgGroups();
  const createMut = useTgCreateGroup();
  const deleteMut = useTgDeleteGroup();
  const [newUrl, setNewUrl] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    createMut.mutate({ url: newUrl }, {
      onSuccess: () => setNewUrl("")
    });
  };

  return (
    <div className="bg-card rounded-2xl p-6 border shadow-sm h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-bold">Target Groups</h3>
        <p className="text-sm text-muted-foreground">Manage the list of groups for the sender to target.</p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-3 mb-6">
        <input 
          type="url"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          placeholder="https://t.me/groupname"
          className="flex-1 px-4 py-2.5 rounded-xl bg-background border focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] outline-none text-sm"
          required
        />
        <button 
          type="submit"
          disabled={createMut.isPending}
          className="px-5 py-2.5 bg-foreground text-background rounded-xl font-medium flex items-center gap-2 hover:bg-foreground/90 transition-colors"
        >
          {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </form>

      <div className="flex-1 bg-background/50 border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : groups?.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No groups added yet.</div>
        ) : (
          <ul className="divide-y max-h-[400px] overflow-y-auto">
            {groups?.map(g => (
              <li key={g.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <span className="text-sm truncate pr-4">{g.url}</span>
                <button 
                  onClick={() => deleteMut.mutate(g.id)}
                  disabled={deleteMut.isPending}
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
