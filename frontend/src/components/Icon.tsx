import { Brain, Cloud, Code, Cpu, Eye, Globe, Layers, MessageCircle, Shield, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  code: Code, brain: Brain, eye: Eye, cloud: Cloud, shield: Shield, cpu: Cpu,
  layers: Layers, globe: Globe, sparkles: Sparkles, "message-circle": MessageCircle,
};

export default function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Code;
  return <C className={className} aria-hidden />;
}
