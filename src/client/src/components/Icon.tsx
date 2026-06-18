import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Zap, Home, LayoutGrid, BookOpen, Grid2x2, List, Menu, Search,
  SlidersHorizontal, ArrowUpDown, Plus, Upload, Download, RefreshCw,
  RotateCw, Settings, Cog, Bell, User, Users, ArrowLeft, ArrowRight,
  ArrowUp, ArrowDown, ChevronDown, ChevronRight, X, EllipsisVertical,
  Bookmark, Star, Folder, File, FileText, Pencil, FileType, FileType2,
  FileCheck, FileMinus, FileSpreadsheet, Copy as CopyIcon, Scissors,
  Link, ExternalLink, SquareArrowOutUpRight, Package, Box, Layers,
  CreditCard, IdCard, Wrench, Crosshair, SquareDashedMousePointer,
  Award, ShieldCheck as AgentBadge, GitFork, Cpu, Database, Server,
  Cloud, Globe as BrowserWindow, Terminal, Cat, Code, BookmarkCheck,
  Backpack, Shield, Target, Puzzle, Tag, MemoryStick,
  PlusSquare, Maximize, Network, Orbit, Shirt,
  Save, Scale, Files, Trash2, Clipboard, Link2,
  LogIn, Rocket, Play, Pause,
  Check, CircleCheck, CircleAlert, TriangleAlert, Info, HelpCircle,
  MessageCircle, MessageSquare, Mail, Megaphone, Flag, Pin, MapPin, Eye,
  Circle, CircleDot, PlugZap, Unplug as UnplugIcon, CircleCheckBig, CircleX,
  Clock, Loader, Lock, Unlock, ShieldCheck, ShieldAlert, Trophy,
  Crown, Medal, Ribbon, Gem, Gauge, LineChart, BarChart3,
  PieChart, Activity, ListOrdered, GanttChart, Spline, History,
  Share2, Workflow, Share, GitBranch,
  StickyNote, FileStack, ClipboardList, BookOpen as BookIcon,
  Bug, FlaskConical, CodeXml, AppWindow, SearchCode,
  CheckSquare, BadgeCheck, Bird, Globe, Cookie, Scan, LampDesk,
  HeartPulse, AudioWaveform, Webhook, Plug,
  KeyRound, DatabaseZap,
  ShieldX, LayoutDashboard, Layers3,
  TerminalSquare, Settings2, Monitor, Smartphone,
  Tablet, Container, Ship, CloudUpload, CloudDownload, Wifi,
  Languages,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "bolt-logo": Zap, home: Home, "dashboard-grid": LayoutGrid, "library-books": BookOpen,
  "app-grid": Grid2x2, "list-bullets": List, menu: Menu, search: Search,
  filter: SlidersHorizontal, sort: ArrowUpDown, add: Plus, upload: Upload,
  download: Download, refresh: RefreshCw,

  sync: RotateCw, settings: Settings, "gear-alt": Cog, "notification-bell": Bell,
  user: User, team: Users, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  "arrow-up": ArrowUp, "arrow-down": ArrowDown, "chevron-down": ChevronDown,
  "chevron-right": ChevronRight, close: X, "kebab-vertical": EllipsisVertical,
  "expand-arrow": ChevronDown,

  bookmark: Bookmark, "favorite-star": Star, folder: Folder, file: File,
  "file-alt": FileText, edit: Pencil, "file-s": FileType, "file-a": FileType2,
  "file-b": FileCheck, "file-c": FileMinus, document: FileSpreadsheet,
  duplicate: Files, copy: CopyIcon, cut: Scissors,

  link: Link, "external-link": ExternalLink, "open-new": SquareArrowOutUpRight,
  package: Package, cube: Box, layers: Layers, cards: CreditCard,
  "id-card": IdCard, toolbox: Wrench, focus: Crosshair,
  selection: SquareDashedMousePointer, "grid-2x2": Grid2x2, table: FileSpreadsheet,

  "rank-badge": Award, "agent-badge": AgentBadge, "dependency-nodes": GitFork,
  "memory-chip": Cpu, wrench: Wrench, database: Database, server: Server,
  cloud: Cloud, "browser-window": BrowserWindow, terminal: Terminal,
  "asset-animal": Cat, "code-brackets": Code, "bookmark-ribbon": BookmarkCheck,

  backpack: Backpack, "shield-hex": Shield, target: Target, puzzle: Puzzle,
  tag: Tag, "memory-card": MemoryStick, "layers-alt": Layers,
  "add-slot": PlusSquare, "expand-corners": Maximize, hierarchy: Network,
  network: Network, orbit: Orbit,

  shirt: Shirt, "shirt-dashed": Shirt, save: Save, "compare-scale": Scale,
  "docs-duplicate": Files, delete: Trash2, clipboard: Clipboard,
  "link-alt": Link2, "external-link-alt": ExternalLink, enter: LogIn,
  rocket: Rocket, play: Play, pause: Pause,

  check: Check, "check-circle": CircleCheck, "error-alert": CircleAlert,
  warning: TriangleAlert, info: Info, help: HelpCircle, chat: MessageCircle,
  comment: MessageSquare, mail: Mail, megaphone: Megaphone, flag: Flag,
  pin: Pin, "pin-filled": MapPin, eye: Eye,

  "online-dot": Circle, "offline-dot": CircleDot, connected: PlugZap,
  disconnected: UnplugIcon, "success-circle": CircleCheckBig, "error-circle": CircleX,
  "pending-clock": Clock, loading: Loader, lock: Lock, unlock: Unlock,
  shield: ShieldCheck, "shield-check": ShieldAlert, trophy: Trophy,

  lightning: Zap, crown: Crown, medal: Medal, "ribbon-award": Ribbon,
  gem: Gem, gauge: Gauge, "line-chart": LineChart, "bar-chart": BarChart3,
  "pie-chart": PieChart, activity: Activity, "list-dots": ListOrdered,
  timeline: GanttChart, "connector-line": Spline, history: History,

  "share-nodes": Share2, "linked-nodes": Workflow, "share-alt": Share,
  "workflow-nodes": GitBranch, "tag-purple": Tag, "tag-outline": Tag,
  note: StickyNote, "document-list": FileStack, "layers-stack": Layers3,
  "clipboard-list": ClipboardList, book: BookIcon, bug: Bug, flask: FlaskConical,

  code: CodeXml, "code-window": AppWindow, "code-search": SearchCode,
  "git-branch": GitBranch, "code-shield": ShieldCheck, checklist: CheckSquare,
  "qa-badge": BadgeCheck, canary: Bird, "launch-rocket": Rocket,
  "rocket-alt": Rocket, "web-globe": Globe, cookie: Cookie,
  scraper: Scan, lighthouse: LampDesk,

  speedometer: Gauge, health: HeartPulse, waveform: AudioWaveform,
  api: Webhook, plug: Plug, "chain-link": Link, "puzzle-piece": Puzzle,
  key: KeyRound, "database-key": DatabaseZap, "shield-key": ShieldCheck,
  "shield-x": ShieldX, "chart-window": LayoutDashboard, sitemap: Network,
  stack: Layers3,

  "terminal-window": TerminalSquare, "code-settings": Settings2, processor: Cpu,
  microchip: Cpu, globe: Globe, monitor: Monitor, mobile: Smartphone,
  tablet: Tablet, "command-prompt": Terminal, docker: Container,
  kubernetes: Ship, "cloud-upload": CloudUpload, "cloud-download": CloudDownload,
  wireless: Wifi,
  translate: Languages,
};

export type IconName = keyof typeof ICON_MAP | (string & {});

const SIZE_PX: Record<string, number> = {
  xs: 14, sm: 16, md: 20, lg: 24, xl: 32,
};

interface IconProps {
  name: IconName;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  title?: string;
}

export function Icon({ name, size = "md", className = "", title }: IconProps) {
  const px = SIZE_PX[size] ?? 20;
  const LucideComp = ICON_MAP[name];

  if (!LucideComp) {
    return (
      <span
        className={`inline-block shrink-0 ${className}`}
        style={{ width: px, height: px }}
        aria-hidden
      />
    );
  }

  const props: LucideProps = {
    size: px,
    strokeWidth: px <= 16 ? 2 : 1.75,
    className: `inline-block shrink-0 align-middle ${className}`,
    "aria-hidden": !title ? true : undefined,
    role: title ? "img" : undefined,
  };

  if (title) (props as Record<string, unknown>)["aria-label"] = title;

  return <LucideComp {...props} />;
}
