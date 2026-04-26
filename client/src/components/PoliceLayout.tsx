import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  FolderOpen,
  PlusCircle,
  LogOut,
  Shield,
  ChevronDown,
  Settings,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { LOGO_URL, APP_TITLE } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "首頁總覽", path: "/" },
  { icon: FolderOpen, label: "案件管理", path: "/cases" },
  { icon: PlusCircle, label: "新建案件", path: "/cases/new" },
  { icon: Settings, label: "系統設定", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "police-sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

/** 簡易登入表單 */
function SimpleLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.simpleAuth.login.useMutation({
    onSuccess: async () => {
      toast.success("登入成功");
      // 重新整理 auth.me 以更新登入狀態
      await utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error("登入失敗：" + err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("請輸入帳號與密碼");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password: password.trim() });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-8 p-8 max-w-sm w-full">
        {/* Logo + 標題 */}
        <div className="flex flex-col items-center gap-4">
          <img src={LOGO_URL} alt="警察局" className="w-24 h-24 drop-shadow-lg" />
          <h1 className="text-2xl font-bold text-foreground text-center">{APP_TITLE}</h1>
          <p className="text-sm text-muted-foreground text-center">
            本系統限授權員警使用，請輸入帳號密碼登入。
          </p>
        </div>

        {/* 登入表單 */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">帳號</Label>
            <Input
              id="username"
              type="text"
              placeholder="請輸入帳號"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loginMutation.isPending}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">密碼</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loginMutation.isPending}
                className="bg-background/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />登入中...</>
            ) : (
              <><Shield className="mr-2 h-4 w-4" />員警登入</>
            )}
          </Button>
        </form>

        {/* 提示文字 */}
        <p className="text-xs text-muted-foreground/60 text-center">
          測試帳號：test ／ 密碼：test
        </p>
      </div>
    </div>
  );
}

export default function PoliceLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src={LOGO_URL} alt="警察局" className="w-16 h-16 animate-pulse" />
          <p className="text-muted-foreground text-sm">系統載入中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <SimpleLoginForm />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <PoliceLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </PoliceLayoutContent>
    </SidebarProvider>
  );
}

function PoliceLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // 取得員警資料（含單位）
  const { data: meData } = trpc.auth.me.useQuery();
  const officerUser = meData as any;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border/50" disableTransition={isResizing}>
          {/* Sidebar Header */}
          <SidebarHeader className="h-16 justify-center border-b border-border/50">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent/20 rounded-lg transition-colors shrink-0"
              >
                <img src={LOGO_URL} alt="Logo" className="h-7 w-7 object-contain" />
              </button>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-foreground truncate leading-tight">
                    {APP_TITLE}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {officerUser?.unit || "警察局"}
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Sidebar Menu */}
          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path ||
                  (item.path === "/cases" && location.startsWith("/cases") && location !== "/cases/new" && !location.startsWith("/cases/new"));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={isActive ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Sidebar Footer */}
          <SidebarFooter className="p-3 border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/20 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                      {user?.name?.charAt(0)?.toUpperCase() || "P"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none text-foreground">
                        {user?.name || "員警"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {officerUser?.unit || "未設定單位"}
                      </p>
                    </div>
                  )}
                  {!isCollapsed && <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>系統設定</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>登出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border/50 h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8 rounded-lg" />
              <img src={LOGO_URL} alt="Logo" className="h-6 w-6 object-contain" />
              <span className="font-semibold text-sm text-foreground">{APP_TITLE}</span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </SidebarInset>
    </>
  );
}
