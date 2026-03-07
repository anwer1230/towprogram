import { useState, useEffect } from "react";
import { 
  useWaInit, useWaLogout, useWaSaveSettings, useWaSendNow 
} from "@/hooks/use-whatsapp";
import { useAppWebSocket } from "@/hooks/use-websocket";
import { Loader2, Phone, LogOut, Settings, Send, Terminal } from "lucide-react";
import { format } from "date-fns";

export default function WhatsappDashboard() {
  const { data: initState, isLoading } = useWaInit();
  const { isConnected, subscribe } = useAppWebSocket();
  const [logs, setLogs] = useState<{time: Date, msg: string}[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // WS Subscriptions
  useEffect(() => {
    const unsubLog = subscribe("log_update", (data) => {
      setLogs(prev => [{time: new Date(), msg: data.message}, ...prev].slice(0, 50));
    });
    
    const unsubQr = subscribe("qr_code", (data) => {
      setQrCode(data.qr);
    });

    const unsubConn = subscribe("connection_confirmed", (data) => {
      setQrCode(null);
      setLogs(prev => [{time: new Date(), msg: `Connected as ${data.user_name}`}, ...prev]);
    });

    return () => {
      unsubLog();
      unsubQr();
      unsubConn();
    };
  }, [subscribe]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#25D366]" />
      </div>
    );
  }

  const isLoggedIn = initState?.connectionStatus === "connected" || !qrCode;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">WhatsApp Node</h1>
          <p className="text-muted-foreground mt-1">Connect your device to manage broadcasts and groups.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium bg-card px-3 py-1.5 rounded-full border">
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
             WS: {isConnected ? 'Live' : 'Dropped'}
          </div>
          {isLoggedIn && <WaLogoutButton />}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          {qrCode ? (
            <div className="bg-card rounded-2xl p-8 border shadow-sm text-center">
              <div className="w-12 h-12 bg-[#25D366]/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Phone className="w-6 h-6 text-[#25D366]" />
              </div>
              <h2 className="text-xl font-bold mb-2">Scan to Connect</h2>
              <p className="text-sm text-muted-foreground mb-6">Open WhatsApp on your phone, go to Linked Devices, and scan this code.</p>
              <div className="bg-white p-4 inline-block rounded-xl border">
                 <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
              </div>
            </div>
          ) : (
            <WaSettingsPanel settings={initState?.settings} />
          )}
        </div>

        <div className="lg:col-span-8 space-y-8">
          {isLoggedIn && <WaQuickActions />}
          <WaConsole logs={logs} />
        </div>
      </div>
    </div>
  );
}

function WaLogoutButton() {
  const logoutMut = useWaLogout();
  return (
    <button 
      onClick={() => logoutMut.mutate()}
      disabled={logoutMut.isPending}
      className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-full text-sm font-medium transition-colors"
    >
      {logoutMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
      Disconnect
    </button>
  );
}

function WaSettingsPanel({ settings }: { settings: any }) {
  const [interval, setIntervalVal] = useState(settings?.interval_seconds || 3600);
  const saveMut = useWaSaveSettings();

  const handleSave = () => {
    saveMut.mutate({ interval_seconds: interval });
  };

  return (
    <div className="bg-card rounded-2xl p-6 border shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-secondary rounded-lg"><Settings className="w-5 h-5 text-foreground" /></div>
        <h3 className="text-lg font-bold">Node Settings</h3>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">Loop Interval (Seconds)</label>
          <input 
            type="number"
            value={interval}
            onChange={e => setIntervalVal(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl bg-background border outline-none text-sm focus:border-[#25D366]"
          />
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="w-full py-2.5 bg-foreground text-background rounded-xl font-medium hover:bg-foreground/90 transition-colors flex justify-center items-center"
        >
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function WaQuickActions() {
  const [msg, setMsg] = useState("");
  const sendMut = useWaSendNow();

  const handleSend = () => {
    if(!msg) return;
    sendMut.mutate({ message: msg }, {
      onSuccess: () => setMsg("")
    });
  };

  return (
    <div className="bg-card rounded-2xl p-6 border shadow-sm flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <input 
          type="text"
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Type a broadcast message..."
          className="w-full px-4 py-3 rounded-xl bg-background border outline-none focus:border-[#25D366] transition-colors h-full"
        />
      </div>
      <button 
        onClick={handleSend}
        disabled={sendMut.isPending || !msg}
        className="px-6 py-3 bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-xl font-semibold shadow-lg shadow-[#25D366]/20 transition-all disabled:opacity-50 flex items-center gap-2"
      >
        {sendMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        Broadcast Now
      </button>
    </div>
  );
}

function WaConsole({ logs }: { logs: {time: Date, msg: string}[] }) {
  return (
    <div className="bg-[#0a0a0a] rounded-2xl border shadow-lg overflow-hidden flex flex-col h-[400px]">
      <div className="bg-[#1a1a1a] border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-mono text-gray-300">node_console.log</span>
      </div>
      <div className="p-4 font-mono text-sm overflow-y-auto flex-1 space-y-2">
        {logs.length === 0 ? (
          <p className="text-gray-600 italic">Waiting for events...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-4 group">
              <span className="text-gray-500 shrink-0">{format(log.time, 'HH:mm:ss')}</span>
              <span className="text-green-400 group-hover:text-green-300 transition-colors break-all">
                {log.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
