import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Home, MessageCircle, Phone } from "lucide-react";
import { motion } from "framer-motion";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const isTg = location.startsWith("/telegram");
  const isWa = location.startsWith("/whatsapp");

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 glass-panel border-b border-border/50 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {location !== "/" && (
            <Link 
              href="/" 
              className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div className="flex items-center gap-2 font-display font-semibold text-lg tracking-tight">
            {location === "/" ? (
              <>
                <Home className="w-5 h-5 text-primary" />
                <span>CommHub Workspace</span>
              </>
            ) : isTg ? (
              <>
                <div className="w-8 h-8 rounded-md bg-[#0088cc]/10 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-[#0088cc]" />
                </div>
                <span>Telegram Manager</span>
              </>
            ) : isWa ? (
              <>
                <div className="w-8 h-8 rounded-md bg-[#25D366]/10 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-[#25D366]" />
                </div>
                <span>WhatsApp Tools</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span className="hidden sm:inline-block">Status: <span className="text-green-500">Operational</span></span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
