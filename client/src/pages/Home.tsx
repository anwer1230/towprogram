import { Link } from "wouter";
import { MessageCircle, Phone, ArrowRight, Zap, Shield, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="py-12 md:py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
          Command Center
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
          Manage your communication platforms from one unified, powerful interface. Choose a tool below to get started.
        </p>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid md:grid-cols-2 gap-8"
      >
        {/* Telegram Card */}
        <motion.div variants={itemVariants}>
          <Link href="/telegram" className="block h-full group">
            <div className="h-full bg-card rounded-[2rem] p-8 border border-border/50 shadow-lg shadow-black/[0.03] hover-elevate overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#0088cc]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-[#0088cc]/10 transition-colors duration-500" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#0088cc]/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                  <MessageCircle className="w-8 h-8 text-[#0088cc]" />
                </div>
                
                <h2 className="text-2xl font-bold mb-3">Telegram Manager</h2>
                <p className="text-muted-foreground mb-8 line-clamp-3">
                  Automate group monitoring, manage links, and run sender sequences seamlessly through your Telegram account.
                </p>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <Activity className="w-4 h-4 text-[#0088cc]" />
                    <span>Real-time link extraction</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <Zap className="w-4 h-4 text-[#0088cc]" />
                    <span>Automated sender routines</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 text-[#0088cc] font-semibold group-hover:translate-x-1 transition-transform">
                  Launch App <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* WhatsApp Card */}
        <motion.div variants={itemVariants}>
          <Link href="/whatsapp" className="block h-full group">
            <div className="h-full bg-card rounded-[2rem] p-8 border border-border/50 shadow-lg shadow-black/[0.03] hover-elevate overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#25D366]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-[#25D366]/10 transition-colors duration-500" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                  <Phone className="w-8 h-8 text-[#25D366]" />
                </div>
                
                <h2 className="text-2xl font-bold mb-3">WhatsApp Tools</h2>
                <p className="text-muted-foreground mb-8 line-clamp-3">
                  Connect via QR code to monitor chats, extract valuable group links, and manage scheduled messaging.
                </p>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <Shield className="w-4 h-4 text-[#25D366]" />
                    <span>Secure QR Code Session</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <Zap className="w-4 h-4 text-[#25D366]" />
                    <span>Keyword Watch & Auto-join</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 text-[#25D366] font-semibold group-hover:translate-x-1 transition-transform">
                  Launch App <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
