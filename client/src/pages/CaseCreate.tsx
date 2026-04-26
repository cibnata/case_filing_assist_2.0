import PoliceLayout from "@/components/PoliceLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { useLocation } from "wouter";
import { PlusCircle, QrCode, Copy, ExternalLink, ArrowLeft, Shield } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function CaseCreate() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [createdCase, setCreatedCase] = useState<any>(null);
  const [qrData, setQrData] = useState<any>(null);

  const createMutation = trpc.cases.create.useMutation({
    onSuccess: async (data) => {
      setCreatedCase(data.case);
      toast.success("案件建立成功！");
    },
    onError: (err) => {
      toast.error("建立失敗：" + err.message);
    },
  });

  const { data: qrCodeData, isLoading: qrLoading } = trpc.cases.getQrCode.useQuery(
    { caseId: createdCase?.id },
    { enabled: !!createdCase?.id }
  );

  const handleCreate = () => {
    const officerUser = user as any;
    if (!officerUser?.unit) {
      toast.error("請先至首頁設定您的單位名稱");
      return;
    }
    createMutation.mutate({ notes });
  };

  const handleCopyUrl = () => {
    if (qrCodeData?.reportUrl) {
      navigator.clipboard.writeText(qrCodeData.reportUrl);
      toast.success("報案連結已複製！");
    }
  };

  const handlePrint = () => {
    if (qrCodeData?.qrDataUrl) {
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`
        <html><head><title>案件 QR Code - ${createdCase?.caseNumber}</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 40px; }
          .title { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
          .sub { font-size: 14px; color: #666; margin-bottom: 24px; }
          img { width: 250px; height: 250px; }
          .url { font-size: 11px; color: #999; margin-top: 16px; word-break: break-all; }
          .instruction { font-size: 13px; margin-top: 16px; color: #333; }
        </style></head>
        <body>
          <div class="title">詐騙案件報案 QR Code</div>
          <div class="sub">案件編號：${createdCase?.caseNumber}</div>
          <img src="${qrCodeData.qrDataUrl}" alt="QR Code" />
          <div class="instruction">請使用手機掃描 QR Code，填寫報案資料並上傳相關截圖</div>
          <div class="url">${qrCodeData.reportUrl}</div>
        </body></html>
      `);
      win.document.close();
      win.print();
    }
  };

  return (
    <PoliceLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* 頁頭 */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/cases")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              新建案件
            </h1>
          </div>
        </div>

        {!createdCase ? (
          /* 建案表單 */
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                受理員警資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">受理員警</Label>
                  <Input
                    value={(user as any)?.name || "未設定"}
                    disabled
                    className="mt-1 bg-secondary/30 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">所屬單位</Label>
                  <Input
                    value={(user as any)?.unit || "請先設定單位"}
                    disabled
                    className="mt-1 bg-secondary/30 text-foreground"
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">案件備註（選填）</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="初步案情說明..."
                  className="mt-1 bg-secondary/50 border-border/50 resize-none"
                  rows={3}
                />
              </div>

              <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">建案後將自動：</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>產生唯一案件編號</li>
                  <li>產生 QR Code 供報案人掃描填寫</li>
                  <li>報案人完成填寫後自動通知您</li>
                </ul>
              </div>

              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !(user as any)?.unit}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {createMutation.isPending ? "建立中..." : "建立案件並產生 QR Code"}
              </Button>

              {!(user as any)?.unit && (
                <p className="text-xs text-destructive text-center">
                  請先至首頁設定您的單位名稱才能建案
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* QR Code 顯示 */
          <div className="space-y-4">
            <Card className="bg-card border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div>
                  <p className="text-sm font-semibold text-foreground">案件建立成功</p>
                  <p className="text-xs text-muted-foreground font-mono">{createdCase.caseNumber}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" />
                  報案人 QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {qrLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-muted-foreground text-sm">產生 QR Code 中...</div>
                  </div>
                ) : qrCodeData ? (
                  <>
                    <div className="flex justify-center">
                      <div className="p-4 bg-white rounded-xl">
                        <img
                          src={qrCodeData.qrDataUrl}
                          alt="QR Code"
                          className="w-56 h-56"
                        />
                      </div>
                    </div>

                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">報案連結</p>
                      <p className="text-xs font-mono text-foreground break-all">
                        {qrCodeData.reportUrl}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyUrl}
                        className="gap-1 text-xs"
                      >
                        <Copy className="h-3 w-3" />
                        複製連結
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="gap-1 text-xs"
                      >
                        <QrCode className="h-3 w-3" />
                        列印 QR Code
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setLocation(`/cases/${createdCase.id}`)}
                        className="gap-1 text-xs bg-primary hover:bg-primary/90"
                      >
                        <ExternalLink className="h-3 w-3" />
                        進入案件
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      請將此 QR Code 出示給報案人掃描，或傳送連結給報案人填寫
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PoliceLayout>
  );
}
