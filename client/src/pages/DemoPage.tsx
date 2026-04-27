/**
 * DemoPage — 系統展示頁（假資料預覽）
 * 路由：/demo
 * 無需登入，直接展示完整系統介面
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  FolderOpen, PlusCircle, Clock, CheckCircle2, AlertCircle,
  Shield, FileText, Cpu, Wallet, Image, User, ChevronRight,
  ArrowLeft, QrCode, Copy, ExternalLink, RefreshCw, FileSearch,
  Download, MessageSquare, Lightbulb
} from "lucide-react";
import { CASE_STATUS_LABELS, LOGO_URL, APP_TITLE } from "@/lib/constants";

// ─── 子頁面：案件列表 ─────────────────────────────────────────────────────────
function DemoCaseList({ onSelect }: { onSelect: (id: number) => void }) {
  const { data: cases = [], isLoading } = trpc.demo.getCases.useQuery();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{color:"#1a3a5c"}}>
            <FolderOpen className="h-5 w-5" style={{color:"#1a3a5c"}} />
            案件管理
          </h1>
          <p className="text-sm mt-0.5" style={{color:"#4a7aa0"}}>共 {cases.length} 件案件（示範資料）</p>
        </div>
        <Button className="gap-2 text-white" style={{backgroundColor:"#1a3a5c"}} disabled>
          <PlusCircle className="h-4 w-4" />新建案件
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">載入中...</div>
      ) : (
        <div className="space-y-2">
          {cases.map((c: any) => {
            const statusInfo = CASE_STATUS_LABELS[c.status] || { label: c.status, color: "" };
            return (
              <Card
                key={c.id}
                className="bg-card border cursor-pointer hover:shadow-md transition-all" style={{borderColor:"#d1dce8"}}
                onClick={() => onSelect(c.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-1 h-10 rounded-full shrink-0" style={{backgroundColor:"#1a3a5c"}} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm" style={{color:"#1a3a5c"}}>{c.caseNumber}</span>
                          <Badge className={`text-xs px-2 py-0 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs" style={{color:"#4a7aa0"}}>
                          <span>{c.officerName}</span>
                          <span>·</span>
                          <span>{c.officerUnit}</span>
                          <span>·</span>
                          <span>{new Date(c.createdAt).toLocaleString("zh-TW")}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{color:"#4a7aa0"}} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 子頁面：案件詳情 ─────────────────────────────────────────────────────────
function DemoCaseDetail({ onBack, onInterrogation }: { onBack: () => void; onInterrogation: () => void }) {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: detail, isLoading } = trpc.demo.getCaseDetail.useQuery();

  if (isLoading || !detail) {
    return <div className="text-center py-16 text-muted-foreground">載入中...</div>;
  }

  const c = detail.case as any;
  const reporter = detail.reporter as any;
  const evidenceFiles = detail.files as any[];
  const ocrResult = detail.ocr as any;
  const intelReport = detail.intel as any;
  const wallets = detail.wallets as any[];
  const statusInfo = CASE_STATUS_LABELS[c.status] || { label: c.status, color: "" };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* 頁頭 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="hover:bg-blue-50" style={{color:"#4a7aa0"}}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold font-mono" style={{color:"#1a3a5c"}}>{c.caseNumber}</h1>
              <Badge className={`text-xs px-2 py-0.5 ${statusInfo.color}`}>{statusInfo.label}</Badge>
              <Badge variant="outline" className="text-xs" style={{color:"#b45309", borderColor:"#b45309"}}>示範資料</Badge>
            </div>
            <p className="text-xs mt-0.5" style={{color:"#4a7aa0"}}>
              {c.officerName} · {c.officerUnit} · {new Date(c.createdAt).toLocaleString("zh-TW")}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onInterrogation} className="gap-1 text-xs text-white" style={{backgroundColor:"#1a3a5c"}}>
          <FileText className="h-3 w-3" />調查筆錄
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto border" style={{backgroundColor:"#eef3f8", borderColor:"#d1dce8"}}>
          <TabsTrigger value="overview" className="text-xs">概覽</TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs">證物 ({evidenceFiles.length})</TabsTrigger>
          <TabsTrigger value="ocr" className="text-xs">OCR 辨識</TabsTrigger>
          <TabsTrigger value="intel" className="text-xs">情資分析</TabsTrigger>
          <TabsTrigger value="wallets" className="text-xs">錢包分析 ({wallets.length})</TabsTrigger>
          <TabsTrigger value="report" className="text-xs">案件報告</TabsTrigger>
        </TabsList>

        {/* ── 概覽 ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{color:"#1a3a5c"}}>
                  <Shield className="h-4 w-4" style={{color:"#1a3a5c"}} />案件資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ["案件編號", c.caseNumber],
                  ["受理員警", c.officerName],
                  ["所屬單位", c.officerUnit],
                  ["建案時間", new Date(c.createdAt).toLocaleString("zh-TW")],
                  ["案件備註", c.notes],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-xs shrink-0" style={{color:"#4a7aa0"}}>{label}</span>
                    <span className="text-xs text-right" style={{color:"#1a3a5c"}}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{color:"#1a3a5c"}}>
                  <User className="h-4 w-4" style={{color:"#1a3a5c"}} />報案人資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {reporter ? (
                  <>
                    {[
                      ["姓名", reporter.name],
                      ["性別", reporter.gender],
                      ["出生日期", reporter.birthDate],
                      ["出生地", reporter.birthPlace],
                      ["身分證字號", reporter.idNumber],
                      ["職業", reporter.occupation],
                      ["戶籍地址", reporter.registeredAddress],
                      ["現住地址", reporter.address],
                      ["教育程度", reporter.education],
                      ["電話", reporter.phone],
                      ["家庭經濟狀況", reporter.economicStatus],
                      ["報案類別", reporter.caseType],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-2">
                        <span className="text-xs shrink-0" style={{color:"#4a7aa0"}}>{label}</span>
                        <span className="text-xs text-right" style={{color:"#1a3a5c"}}>{value || "—"}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-xs" style={{color:"#4a7aa0"}}>尚未填寫</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* QR Code 區塊 */}
          <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <QrCode className="h-4 w-4" style={{color:"#1a3a5c"}} />報案 QR Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg flex items-center justify-center border" style={{backgroundColor:"#eef3f8", borderColor:"#d1dce8"}}>
                  <QrCode className="h-12 w-12" style={{color:"#4a7aa0"}} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs" style={{color:"#4a7aa0"}}>掃描此 QR Code 讓民眾填寫報案資料</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-xs" disabled>
                      <Copy className="h-3 w-3" />複製連結
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" disabled>
                      <ExternalLink className="h-3 w-3" />開啟連結
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 證物 ── */}
        <TabsContent value="evidence" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{color:"#1a3a5c"}}>
              <Image className="h-4 w-4" style={{color:"#1a3a5c"}} />
              證物圖片（{evidenceFiles.length} 張）
            </h3>
            <Button size="sm" variant="outline" className="gap-1 text-xs" disabled>
              <RefreshCw className="h-3 w-3" />執行 OCR 辨識
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {evidenceFiles.map((f: any) => (
              <Card key={f.id} className="bg-card border overflow-hidden cursor-pointer hover:shadow-md transition-all" style={{borderColor:"#d1dce8"}}>
                <div className="relative">
                  <img
                    src={f.storageUrl}
                    alt={f.originalName}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                    <div className="bg-primary/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Cpu className="h-3 w-3" />點擊 OCR 辨識
                    </div>
                  </div>
                </div>
                <CardContent className="p-2">
                  <p className="text-xs text-foreground truncate">{f.originalName}</p>
                  <p className="text-xs" style={{color:"#4a7aa0"}}>{(f.fileSize / 1024).toFixed(0)} KB</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── OCR 辨識 ── */}
        <TabsContent value="ocr" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{color:"#1a3a5c"}}>
                <FileSearch className="h-4 w-4" style={{color:"#1a3a5c"}} />OCR 辨識結果
              </h3>
              <p className="text-xs" style={{color:"#4a7aa0"}}>
                狀態：<Badge className="text-xs ml-1 bg-green-500/20 text-green-400">已確認</Badge>
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1 text-xs" disabled>
                <RefreshCw className="h-3 w-3" />重新辨識
              </Button>
              <Button size="sm" className="gap-1 text-xs text-white" style={{backgroundColor:"#1a3a5c"}} disabled>
                <CheckCircle2 className="h-3 w-3" />確認全文
              </Button>
            </div>
          </div>
          <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
            <CardContent className="p-4">
              <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-secondary/30 rounded-lg p-4 max-h-80 overflow-y-auto">
                {ocrResult.confirmedText}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 情資分析 ── */}
        <TabsContent value="intel" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{color:"#1a3a5c"}}>
              <Cpu className="h-4 w-4" style={{color:"#1a3a5c"}} />情資分析結果
            </h3>
            <Button size="sm" variant="outline" className="gap-1 text-xs" disabled>
              <RefreshCw className="h-3 w-3" />重新分析
            </Button>
          </div>

          <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">案件摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed">{intelReport.caseSummary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 嫌疑人 */}
            <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">嫌疑人</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {intelReport.suspects?.map((s: any, i: number) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{color:"#1a3a5c"}}>{s.alias}</span>
                      <Badge variant="outline" className="text-xs">{s.role}</Badge>
                    </div>
                    <p className="" style={{color:"#4a7aa0"}}>平台：{s.platform}</p>
                    <p className="" style={{color:"#4a7aa0"}}>帳號：{s.accounts?.join(", ")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 相關帳號 */}
            <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">相關帳號與網址</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {intelReport.relatedAccounts?.map((a: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="text-xs shrink-0">{a.platform}</Badge>
                    <span className="text-foreground font-mono break-all">{a.account || a.url}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 時序 */}
          <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">事件時序</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {intelReport.timeline?.map((t: any, i: number) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-primary font-mono shrink-0 w-24">{t.datetime}</span>
                    <span className="" style={{color:"#1a3a5c"}}>{t.event}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 錢包地址 */}
          {intelReport.walletAddresses?.length > 0 && (
            <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">發現錢包地址</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {intelReport.walletAddresses.map((w: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge className={`text-xs ${w.chain === "ETH" ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"}`}>{w.chain}</Badge>
                    <span className="font-mono text-foreground break-all">{w.address}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── 錢包分析 ── */}
        <TabsContent value="wallets" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{color:"#1a3a5c"}}>
              <Wallet className="h-4 w-4" style={{color:"#1a3a5c"}} />錢包分析（{wallets.length} 個）
            </h3>
            <Button size="sm" variant="outline" className="gap-1 text-xs" disabled>
              <RefreshCw className="h-3 w-3" />重新查詢
            </Button>
          </div>
          {wallets.map((w: any) => (
            <Card key={w.id} className="bg-card border" style={{borderColor:"#d1dce8"}}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Badge className={`text-xs ${w.chain === "ETH" ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"}`}>{w.chain}</Badge>
                  <span className="font-mono text-foreground truncate">{w.address}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["建立時間", w.createTime ? new Date(w.createTime).toLocaleDateString("zh-TW") : "—"],
                    ["最後交易", w.lastTransactionDate ? new Date(w.lastTransactionDate).toLocaleDateString("zh-TW") : "—"],
                    ["交易次數", w.transactionTimes],
                    ["轉入金額", w.transInAmount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg p-2 text-center" style={{backgroundColor:"#eef3f8"}}>
                      <p className="text-xs" style={{color:"#4a7aa0"}}>{label}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {w.trc20Ledger?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">TRC-20 轉帳明細</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {w.trc20Ledger.map((tx: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-secondary/20 rounded p-2">
                          <Badge className={`text-xs shrink-0 ${tx.direction === "IN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                            {tx.direction === "IN" ? "轉入" : "轉出"}
                          </Badge>
                          <span className="font-semibold" style={{color:"#1a3a5c"}}>{tx.amount} {tx.tokenSymbol}</span>
                          <span className="" style={{color:"#4a7aa0"}}>{tx.date ? new Date(tx.date).toLocaleDateString("zh-TW") : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── 案件報告 ── */}
        <TabsContent value="report" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold" style={{color:"#1a3a5c"}}>案件報告</h3>
              <p className="text-xs" style={{color:"#4a7aa0"}}>整合案件所有資訊，可列印或儲存為 PDF</p>
            </div>
            <Button size="sm" className="gap-1 text-xs text-white" style={{backgroundColor:"#1a3a5c"}} disabled>
              <Download className="h-3 w-3" />列印 / PDF
            </Button>
          </div>
          <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
            <CardContent className="p-6 space-y-4">
              <div className="border-b pb-4" style={{borderColor:"#d1dce8"}}>
                <h2 className="text-lg font-bold text-center" style={{color:"#1a3a5c"}}>詐騙案件報告</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="" style={{color:"#4a7aa0"}}>案號：</span><span className="font-semibold" style={{color:"#1a3a5c"}}>{c.caseNumber}</span></div>
                <div><span className="" style={{color:"#4a7aa0"}}>受理日期：</span><span className="" style={{color:"#1a3a5c"}}>{new Date(c.createdAt).toLocaleDateString("zh-TW")}</span></div>
                <div><span className="" style={{color:"#4a7aa0"}}>受理單位：</span><span className="" style={{color:"#1a3a5c"}}>{c.officerUnit}</span></div>
                <div><span className="" style={{color:"#4a7aa0"}}>受理員警：</span><span className="" style={{color:"#1a3a5c"}}>{c.officerName}</span></div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">案件摘要</h3>
                <p className="text-sm text-foreground leading-relaxed">{intelReport.caseSummary}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">被害人資料</h3>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {reporter && [
                    ["姓名", reporter.name], ["身分證字號", reporter.idNumber],
                    ["出生日期", reporter.birthDate], ["現住地址", reporter.address],
                    ["電話", reporter.phone], ["報案類別", reporter.caseType],
                  ].map(([l, v]) => (
                    <div key={l}><span className="" style={{color:"#4a7aa0"}}>{l}：</span><span className="" style={{color:"#1a3a5c"}}>{v}</span></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── 子頁面：調查筆錄 ─────────────────────────────────────────────────────────
function DemoInterrogation({ onBack }: { onBack: () => void }) {
  const { data: interrogation, isLoading } = trpc.demo.getInterrogation.useQuery();
  const { data: detail } = trpc.demo.getCaseDetail.useQuery();

  if (isLoading || !interrogation || !detail) {
    return <div className="text-center py-16 text-muted-foreground">載入中...</div>;
  }

  const c = detail.case as any;
  const reporter = detail.reporter as any;
  const questions = (interrogation.record?.questions as any[]) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />調查筆錄
          </h1>
          <p className="text-xs" style={{color:"#4a7aa0"}}>{c.caseNumber} · 示範資料</p>
        </div>
      </div>

      <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold" style={{color:"#1a3a5c"}}>筆錄表頭</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-xs">
          {[
            ["詢問開始時間", interrogation.record?.startTime],
            ["詢問結束時間", interrogation.record?.endTime],
            ["詢問地點", interrogation.record?.location],
            ["受詢問人", reporter?.name],
            ["身分證字號", reporter?.idNumber],
            ["出生日期", reporter?.birthDate],
            ["現住地址", reporter?.address],
            ["家庭經濟狀況", reporter?.economicStatus],
          ].map(([l, v]) => (
            <div key={l} className="flex gap-2">
              <span className="text-muted-foreground shrink-0">{l}：</span>
              <span className="" style={{color:"#1a3a5c"}}>{v as string}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.map((q: any, i: number) => (
          <Card key={q.id} className="bg-card border" style={{borderColor:"#d1dce8"}}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                {q.type === "ai_suggested" ? (
                  <Lightbulb className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                )}
                <div className="space-y-2 w-full">
                  <p className="text-sm font-semibold" style={{color:"#1a3a5c"}}>{q.question}</p>
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-sm text-foreground leading-relaxed">{q.answer}</p>
                  </div>
                  {q.type === "ai_suggested" && (
                    <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/50">AI 建議追問</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── 主頁面 ───────────────────────────────────────────────────────────────────
type DemoView = "home" | "cases" | "detail" | "interrogation";

export default function DemoPage() {
  const [view, setView] = useState<DemoView>("home");
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.demo.getStats.useQuery();

  return (
    <div className="min-h-screen demo-light bg-background text-foreground">
      {/* 頂部 Banner */}
      <div className="px-4 py-2 text-center" style={{backgroundColor:"#1a3a5c"}}>
        <p className="text-xs text-blue-200">
          ⚠ 示範模式 — 以下為假資料展示，所有操作按鈕均已停用
        </p>
      </div>

      {/* 側邊欄 + 主內容 */}
      <div className="flex min-h-[calc(100vh-36px)]">
        {/* 側邊欄 */}
        <div className="w-56 flex flex-col shrink-0" style={{backgroundColor:"#1a3a5c"}}>
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="警察局" className="w-8 h-8 object-contain" />
              <div>
                <p className="text-xs font-bold leading-tight text-white">{APP_TITLE}</p>
                <p className="text-xs text-blue-200">示範模式</p>
              </div>
            </div>
          </div>
          <nav className="p-2 space-y-1 flex-1">
            {[
              { icon: FolderOpen, label: "首頁總覽", view: "home" as DemoView },
              { icon: FolderOpen, label: "案件管理", view: "cases" as DemoView },
              { icon: FileText, label: "調查筆錄", view: "interrogation" as DemoView },
            ].map(item => (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  view === item.view
                    ? "font-semibold"
                    : "hover:bg-blue-200"
                }`}
                style={view === item.view ? {backgroundColor:"rgba(255,255,255,0.15)", color:"#fff", fontWeight:600} : {color:"rgba(255,255,255,0.75)"}}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10">
            <Button
              size="sm"
              className="w-full text-xs bg-white/10 hover:bg-white/20 text-white border-0"
              onClick={() => setLocation("/")}
            >
              進入正式系統
            </Button>
          </div>
        </div>

        {/* 主內容 */}
        <div className="flex-1 overflow-auto p-6 bg-background">
          {view === "home" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={LOGO_URL} alt="警察局" className="w-12 h-12 object-contain" />
                  <div>
                    <h1 className="text-2xl font-bold" style={{color:"#1a3a5c"}}>歡迎，陳志明 員警</h1>
                    <p className="text-sm" style={{color:"#4a7aa0"}}>新北市政府警察局板橋分局 · 詐騙案件受理輔助系統</p>
                  </div>
                </div>
                <Button className="font-semibold gap-2 text-white" style={{backgroundColor:"#1a3a5c"}} disabled>
                  <PlusCircle className="h-4 w-4" />新建案件
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: <FolderOpen className="h-5 w-5" style={{color:"#2563eb"}} />, label: "案件總數", value: stats?.total ?? 5, color: "blue" },
                  { icon: <Clock className="h-5 w-5" style={{color:"#d97706"}} />, label: "待填寫", value: stats?.pending ?? 1, color: "yellow" },
                  { icon: <AlertCircle className="h-5 w-5" style={{color:"#ea580c"}} />, label: "待處理", value: stats?.submitted ?? 1, color: "orange" },
                  { icon: <CheckCircle2 className="h-5 w-5" style={{color:"#16a34a"}} />, label: "已完成分析", value: stats?.analyzed ?? 1, color: "green" },
                ].map(s => (
                  <Card key={s.label} className="bg-card border" style={{borderColor:"#d1dce8"}}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-${s.color}-500/10 flex items-center justify-center`}>
                          {s.icon}
                        </div>
                        <div>
                          <p className="text-2xl font-bold" style={{color:"#1a3a5c"}}>{s.value}</p>
                          <p className="text-xs" style={{color:"#4a7aa0"}}>{s.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-card border" style={{borderColor:"#d1dce8"}}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold" style={{color:"#1a3a5c"}}>最近案件</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { num: "2024-NTP-001234", officer: "陳志明", status: "analyzed", time: "2024/11/15" },
                      { num: "2024-NTP-001235", officer: "林美玲", status: "submitted", time: "2024/11/16" },
                      { num: "2024-NTP-001236", officer: "陳志明", status: "pending", time: "2024/11/17" },
                    ].map(c => {
                      const si = CASE_STATUS_LABELS[c.status] || { label: c.status, color: "" };
                      return (
                        <div key={c.num} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm" style={{color:"#1a3a5c"}}>{c.num}</span>
                            <Badge className={`text-xs ${si.color}`}>{si.label}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{color:"#4a7aa0"}}>
                            <span>{c.officer}</span>
                            <span>{c.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {view === "cases" && (
            <DemoCaseList onSelect={() => setView("detail")} />
          )}

          {view === "detail" && (
            <DemoCaseDetail
              onBack={() => setView("cases")}
              onInterrogation={() => setView("interrogation")}
            />
          )}

          {view === "interrogation" && (
            <DemoInterrogation onBack={() => setView("detail")} />
          )}
        </div>
      </div>
    </div>
  );
}
