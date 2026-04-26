import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import PoliceLayout from "@/components/PoliceLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Shield,
  ExternalLink,
  Trash2,
  Save,
} from "lucide-react";

interface ApiKeyCardProps {
  settingKey: string;
  title: string;
  description: string;
  docsUrl: string;
  isSet: boolean;
  maskedValue: string;
  onSave: (key: string, value: string) => Promise<void>;
  onClear: (key: string) => Promise<void>;
  isSaving: boolean;
}

function ApiKeyCard({
  settingKey,
  title,
  description,
  docsUrl,
  isSet,
  maskedValue,
  onSave,
  onClear,
  isSaving,
}: ApiKeyCardProps) {
  const [newKey, setNewKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showValue, setShowValue] = useState(false);

  const handleSave = async () => {
    if (!newKey.trim()) {
      toast.error("請輸入 API Key");
      return;
    }
    await onSave(settingKey, newKey.trim());
    setNewKey("");
    setShowInput(false);
  };

  return (
    <Card className="border border-border/60 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSet ? (
              <Badge variant="default" className="bg-green-600/20 text-green-400 border-green-600/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                已設定
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1">
                <XCircle className="h-3 w-3" />
                未設定
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 目前 Key 顯示 */}
        {isSet && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">目前 API Key</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-muted-foreground">
                {showValue ? maskedValue : "••••••••••••••••"}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowValue(!showValue)}
              >
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* 更換 Key 區域 */}
        {showInput ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isSet ? "輸入新的 API Key" : "輸入 API Key"}
              </Label>
              <Input
                type="password"
                placeholder="貼上您的 API Key..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") {
                    setShowInput(false);
                    setNewKey("");
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                按 Enter 儲存，按 Esc 取消
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !newKey.trim()}
                className="gap-1.5"
              >
                {isSaving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                儲存
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowInput(false);
                  setNewKey("");
                }}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInput(true)}
              className="gap-1.5"
            >
              <Key className="h-3.5 w-3.5" />
              {isSet ? "更換 API Key" : "設定 API Key"}
            </Button>

            {isSet && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>確認清除 API Key？</AlertDialogTitle>
                    <AlertDialogDescription>
                      清除後，{title} 的查詢功能將使用免費公開 API（速率較低）。
                      此操作可隨時重新設定 Key 來恢復。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onClear(settingKey)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      確認清除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto"
            >
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
                取得 API Key
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: settings, refetch, isLoading: settingsLoading, isError: settingsError } = trpc.settings.getAll.useQuery(undefined, {
    enabled: isAdmin,
  });

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("API Key 已成功儲存");
      refetch();
    },
    onError: (err) => {
      toast.error("儲存失敗：" + err.message);
    },
  });

  const clearMutation = trpc.settings.clear.useMutation({
    onSuccess: () => {
      toast.success("API Key 已清除");
      refetch();
    },
    onError: (err) => {
      toast.error("清除失敗：" + err.message);
    },
  });

  const handleSave = async (key: string, value: string) => {
    await updateMutation.mutateAsync({ key, value });
  };

  const handleClear = async (key: string) => {
    await clearMutation.mutateAsync({ key });
  };

  const getSettingInfo = (key: string) => {
    return settings?.find((s) => s.settingKey === key);
  };

  const ethSetting = getSettingInfo("ETHERSCAN_API_KEY");
  const tronSetting = getSettingInfo("TRONSCAN_API_KEY");

  return (
    <PoliceLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 頁面標題 */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">系統設定</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理外部 API 金鑰與系統參數設定
          </p>
        </div>

        <Separator />

        {!isAdmin ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-amber-400">
                <Shield className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">需要管理員權限</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    系統設定僅限管理員存取。請聯繫系統管理員提升您的帳號權限。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : settingsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <p className="text-sm">載入設定中...</p>
            </div>
          </div>
        ) : settingsError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <XCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">載入設定失敗</p>
                  <p className="text-xs text-muted-foreground mt-0.5">無法取得系統設定，請重新整理頁面。</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* 區塊標題 */}
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                區塊鏈查詢 API 金鑰
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                設定 API Key 可提升查詢速率限制，避免因公開 API 頻率限制導致查詢失敗。
                Key 儲存於資料庫中，僅伺服器端使用，不會傳送至前端。
              </p>
            </div>

            {/* Etherscan API Key */}
            <ApiKeyCard
              settingKey="ETHERSCAN_API_KEY"
              title="Etherscan API Key"
              description="用於查詢以太坊（ETH）錢包的交易紀錄與餘額"
              docsUrl="https://etherscan.io/apis"
              isSet={ethSetting?.isSet ?? false}
              maskedValue={ethSetting?.settingValue ?? ""}
              onSave={handleSave}
              onClear={handleClear}
              isSaving={updateMutation.isPending || clearMutation.isPending}
            />

            {/* Tronscan API Key */}
            <ApiKeyCard
              settingKey="TRONSCAN_API_KEY"
              title="Tronscan API Key"
              description="用於查詢 TRON 鏈錢包的交易紀錄與 TRC-20 代幣轉帳明細"
              docsUrl="https://docs.tronscan.org/"
              isSet={tronSetting?.isSet ?? false}
              maskedValue={tronSetting?.settingValue ?? ""}
              onSave={handleSave}
              onClear={handleClear}
              isSaving={updateMutation.isPending || clearMutation.isPending}
            />

            {/* 說明區塊 */}
            <Card className="border-border/40 bg-muted/20">
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/70">關於 API Key 安全性</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>API Key 僅儲存於伺服器端資料庫，不會暴露於前端程式碼</li>
                    <li>顯示時僅呈現遮罩版本（前 4 碼 + 後 4 碼），完整 Key 不會傳送至瀏覽器</li>
                    <li>若未設定 Key，系統將使用公開免費 API（每日查詢次數有限制）</li>
                    <li>建議定期更換 API Key 以維護安全性</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PoliceLayout>
  );
}
