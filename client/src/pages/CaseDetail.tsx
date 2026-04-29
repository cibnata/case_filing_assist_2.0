import PoliceLayout from "@/components/PoliceLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, QrCode, FileText, Cpu, Wallet, Copy, ExternalLink,
  Image, CheckCircle2, AlertCircle, Clock, User, Shield,
  RefreshCw, FileSearch, ChevronRight, Download, Eye
} from "lucide-react";
import { CASE_STATUS_LABELS } from "@/lib/constants";

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const caseId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingOcr, setEditingOcr] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [processingFileIds, setProcessingFileIds] = useState<Set<number>>(new Set());
  const [selectedOcrFile, setSelectedOcrFile] = useState<{ id: number; name: string; ocrText: string; storageUrl: string } | null>(null);

  const utils = trpc.useUtils();

  const { data: caseData, isLoading } = trpc.cases.getById.useQuery({ id: caseId });
  const { data: qrData } = trpc.cases.getQrCode.useQuery(
    { caseId },
    { enabled: !!caseId }
  );
  const { data: evidenceFiles } = trpc.upload.getEvidenceFiles.useQuery({ caseId });
  const { data: ocrResult } = trpc.ocr.get.useQuery({ caseId });
  const { data: intelReport } = trpc.ocr.getIntel.useQuery({ caseId });
  const { data: wallets } = trpc.wallets.list.useQuery({ caseId });

  const ocrMutation = trpc.ocr.process.useMutation({
    onSuccess: () => {
      toast.success("OCR 辨識完成");
      utils.ocr.get.invalidate({ caseId });
      utils.upload.getEvidenceFiles.invalidate({ caseId });
      utils.cases.getById.invalidate({ id: caseId });
    },
    onError: (err) => toast.error("OCR 失敗：" + err.message),
  });
  const processSingleMutation = trpc.ocr.processSingle.useMutation({
    onSuccess: (data) => {
      toast.success("辨識完成！請切換至 OCR 辨識 Tab 查看結果");
      setProcessingFileIds(prev => { const s = new Set(prev); s.delete(data.fileId); return s; });
      utils.ocr.get.invalidate({ caseId });
      utils.upload.getEvidenceFiles.invalidate({ caseId });
    },
    onError: (err, vars) => {
      toast.error("辨識失敗：" + err.message);
      setProcessingFileIds(prev => { const s = new Set(prev); s.delete(vars.fileId); return s; });
    },
  });
  const handleOcrSingleFile = (fileId: number) => {
    if (processingFileIds.has(fileId)) return;
    setProcessingFileIds(prev => new Set(prev).add(fileId));
    processSingleMutation.mutate({ fileId, caseId });
  };
  const handleImageClick = (f: any) => {
    if (processingFileIds.has(f.id)) return;
    if (f.ocrStatus === "done" && f.ocrText) {
      setSelectedOcrFile({ id: f.id, name: f.originalName, ocrText: f.ocrText, storageUrl: f.storageUrl });
    } else {
      handleOcrSingleFile(f.id);
    }
  };

  const confirmOcrMutation = trpc.ocr.confirm.useMutation({
    onSuccess: () => {
      toast.success("OCR 全文已確認");
      setEditingOcr(false);
      utils.ocr.get.invalidate({ caseId });
    },
    onError: (err) => toast.error("確認失敗：" + err.message),
  });

  const analyzeMutation = trpc.ocr.analyze.useMutation({
    onSuccess: () => {
      toast.success("情資分析完成");
      utils.ocr.getIntel.invalidate({ caseId });
      utils.cases.getById.invalidate({ id: caseId });
    },
    onError: (err) => toast.error("分析失敗：" + err.message),
  });

  const walletQueryMutation = trpc.wallets.query.useMutation({
    onSuccess: () => {
      toast.success("錢包查詢完成");
      utils.wallets.list.invalidate({ caseId });
    },
    onError: (err) => toast.error("查詢失敗：" + err.message),
  });

  const handleStartOcr = () => {
    ocrMutation.mutate({ caseId });
  };

  const handleConfirmOcr = () => {
    confirmOcrMutation.mutate({ caseId, confirmedText: ocrText });
  };

  const handleAnalyze = () => {
    analyzeMutation.mutate({ caseId });
  };

  const handleQueryWallets = () => {
    const walletAddresses = (intelReport as any)?.walletAddresses || [];
    if (walletAddresses.length === 0) {
      toast.error("情資分析中未找到錢包地址");
      return;
    }
    walletQueryMutation.mutate({
      caseId,
      addresses: walletAddresses.map((w: any) => w.address),
    });
  };

  const handleCopyUrl = () => {
    if (qrData?.reportUrl) {
      navigator.clipboard.writeText(qrData.reportUrl);
      toast.success("連結已複製");
    }
  };

  if (isLoading) {
    return (
      <PoliceLayout>
        <div className="text-center py-16 text-muted-foreground">載入中...</div>
      </PoliceLayout>
    );
  }

  if (!caseData) {
    return (
      <PoliceLayout>
        <div className="text-center py-16">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">找不到此案件</p>
        </div>
      </PoliceLayout>
    );
  }

  const c = caseData as any;
  const statusInfo = CASE_STATUS_LABELS[c.status] || { label: c.status, color: "" };
  const walletAddresses = (intelReport as any)?.walletAddresses || [];

  return (
    <PoliceLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* 頁頭 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/cases")}
              className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground font-mono">{c.caseNumber}</h1>
                <Badge className={`text-xs px-2 py-0.5 ${statusInfo.color}`}>{statusInfo.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.officerName} · {c.officerUnit} · {new Date(c.createdAt).toLocaleString("zh-TW")}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setLocation(`/cases/${caseId}/interrogation`)}
            className="gap-1 text-xs bg-primary hover:bg-primary/90"
          >
            <FileText className="h-3 w-3" />調查筆錄
          </Button>
        </div>

        {/* 主要 Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="overview" className="text-xs">概覽</TabsTrigger>
            <TabsTrigger value="evidence" className="text-xs">
              證物 {evidenceFiles?.length ? `(${evidenceFiles.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="ocr" className="text-xs">OCR 辨識</TabsTrigger>
            <TabsTrigger value="intel" className="text-xs">情資分析</TabsTrigger>
            <TabsTrigger value="wallets" className="text-xs">
              錢包分析 {wallets?.length ? `(${wallets.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs">案件報告</TabsTrigger>
          </TabsList>

          {/* ─── 概覽 ─────────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 案件資訊 */}
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />案件資訊
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["案件編號", c.caseNumber],
                    ["受理員警", c.officerName],
                    ["所屬單位", c.officerUnit],
                    ["建案時間", new Date(c.createdAt).toLocaleString("zh-TW")],
                    ["案件備註", c.notes || "無"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
                      <span className="text-foreground text-xs text-right">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 報案人資訊 */}
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />報案人資訊
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {c.reporter ? (
                    <>
                      {[
                        ["姓名", c.reporter.name],
                        ["性別", c.reporter.gender],
                        ["身分證字號", c.reporter.idNumber],
                        ["出生日期", c.reporter.birthDate],
                        ["出生地", c.reporter.birthPlace],
                        ["職業", c.reporter.occupation],
                        ["教育程度", c.reporter.education],
                        ["戶籍地址", c.reporter.registeredAddress],
                        ["現住地址", c.reporter.address],
                        ["電話", c.reporter.phone],
                        ["家庭經濟狀況", c.reporter.economicStatus],
                        ["報案類別", c.reporter.caseType],
                      ].map(([label, value]) => value ? (
                        <div key={label} className="flex justify-between gap-2">
                          <span className="text-muted-foreground text-xs shrink-0">{label}</span>
                          <span className="text-foreground text-xs text-right">{value}</span>
                        </div>
                      ) : null)}
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      <Clock className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      等待報案人填寫資料
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* QR Code */}
            {qrData && (
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />報案 QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="p-3 bg-white rounded-lg shrink-0">
                      <img src={qrData.qrDataUrl} alt="QR Code" className="w-28 h-28" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-xs text-muted-foreground">報案連結</p>
                      <p className="text-xs font-mono text-foreground break-all bg-secondary/30 rounded p-2">
                        {qrData.reportUrl}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopyUrl} className="text-xs gap-1">
                          <Copy className="h-3 w-3" />複製
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => window.open(qrData.reportUrl, "_blank")}
                          className="text-xs gap-1">
                          <ExternalLink className="h-3 w-3" />開啟
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 處理流程 */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">處理流程</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: "pending", label: "建案" },
                    { key: "submitted", label: "報案人填寫" },
                    { key: "ocr_done", label: "OCR 辨識" },
                    { key: "analyzed", label: "情資分析" },
                    { key: "closed", label: "結案" },
                  ].map((step, i) => {
                    const statusOrder = ["pending", "submitted", "ocr_pending", "ocr_done", "analyzing", "analyzed", "closed"];
                    const currentIdx = statusOrder.indexOf(c.status);
                    const stepIdx = statusOrder.indexOf(step.key);
                    const isDone = currentIdx >= stepIdx;
                    return (
                      <div key={step.key} className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                          isDone ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary/50 text-muted-foreground border border-border/30"
                        }`}>
                          {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {step.label}
                        </div>
                        {i < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── 證物 ─────────────────────────────────────────────────────── */}
          <TabsContent value="evidence" className="mt-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    證物圖片 ({evidenceFiles?.length || 0})
                  </CardTitle>
                  {(evidenceFiles?.length || 0) > 0 && (
                    <span className="text-xs text-muted-foreground">點擊圖片即可觸發 OCR 辨識</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!evidenceFiles || evidenceFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    尚無證物圖片
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {evidenceFiles.map((f: any) => {
                      const isProcessing = processingFileIds.has(f.id);
                      const isDone = f.ocrStatus === "done";
                      const isFailed = f.ocrStatus === "failed";
                      return (
                        <div key={f.id} className="group relative">
                          <div className="relative">
                            <img
                              src={f.storageUrl}
                              alt={f.originalName}
                              className={`w-full h-32 object-cover rounded-lg border transition-all cursor-pointer
                                ${isProcessing ? "opacity-60 border-yellow-500/50" : ""}
                                ${isDone ? "border-green-500/60 hover:border-green-400" : "border-border/50 hover:border-primary/50"}
                                ${isFailed ? "border-red-500/50" : ""}
                              `}
                              onClick={() => handleImageClick(f)}
                              title={f.ocrStatus === "done" ? "點擊查看 OCR 結果" : "點擊開始 OCR 辨識"}
                            />
                            {/* 狀態覆蓋層 */}
                            {isProcessing && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                                <Cpu className="h-6 w-6 text-yellow-300 animate-pulse" />
                              </div>
                            )}
                            {isDone && !isProcessing && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="h-4 w-4 text-green-400 drop-shadow" />
                              </div>
                            )}
                            {isFailed && !isProcessing && (
                              <div className="absolute top-1 right-1">
                                <AlertCircle className="h-4 w-4 text-red-400 drop-shadow" />
                              </div>
                            )}
                            {/* hover 提示 */}
                            <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <span className="text-xs bg-black/70 text-white px-2 py-0.5 rounded-full">
                                {isProcessing ? "辨識中..." : isDone ? "重新辨識" : "點擊 OCR"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">{f.originalName}</p>
                          {isDone && f.ocrText && (
                            <p className="text-xs text-green-600 truncate">✓ 已辨識 {f.ocrText.length} 字</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── OCR 辨識 ─────────────────────────────────────────────────── */}
          <TabsContent value="ocr" className="mt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">OCR 文字辨識結果</h3>
                <p className="text-xs text-muted-foreground">使用 VLM 視覺語言模型辨識圖片中的文字</p>
              </div>
              <div className="flex gap-2">
                {ocrResult && !ocrResult.confirmedText && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setOcrText(ocrResult.rawText || "");
                      setEditingOcr(true);
                      setActiveTab("ocr");
                    }}
                    className="text-xs bg-primary hover:bg-primary/90 gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />確認全文
                  </Button>
                )}
              </div>
            </div>

            {ocrMutation.isPending && (
              <Card className="bg-card border-border/50">
                <CardContent className="py-8 text-center">
                  <Cpu className="h-8 w-8 text-primary mx-auto mb-3 animate-pulse" />
                  <p className="text-muted-foreground text-sm">VLM 正在辨識圖片文字...</p>
                </CardContent>
              </Card>
            )}

            {ocrResult ? (
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileSearch className="h-4 w-4 text-primary" />
                      {ocrResult.confirmedText ? "已確認全文" : "辨識結果（待確認）"}
                    </CardTitle>
                    {ocrResult.confirmedText && (
                      <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />已確認
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingOcr ? (
                    <div className="space-y-3">
                      <Textarea
                        value={ocrText}
                        onChange={e => setOcrText(e.target.value)}
                        className="bg-secondary/50 border-border/50 font-mono text-xs resize-none min-h-64"
                        rows={20}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleConfirmOcr}
                          disabled={confirmOcrMutation.isPending}
                          className="bg-primary hover:bg-primary/90 text-xs gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {confirmOcrMutation.isPending ? "確認中..." : "確認此全文"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingOcr(false)} className="text-xs">
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <pre className="bg-secondary/30 rounded-lg p-3 text-xs font-mono text-foreground whitespace-pre-wrap max-h-96 overflow-auto">
                        {ocrResult.confirmedText || ocrResult.rawText}
                      </pre>
                      {!ocrResult.confirmedText && (
                        <Button
                          onClick={() => {
                            setOcrText(ocrResult.rawText || "");
                            setEditingOcr(true);
                          }}
                          className="text-xs bg-primary hover:bg-primary/90 gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />編輯並確認全文
                        </Button>
                      )}
                      {ocrResult.confirmedText && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setOcrText(ocrResult.confirmedText || "");
                              setEditingOcr(true);
                            }}
                            className="text-xs gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />重新編輯全文
                          </Button>
                          <Button
                            onClick={handleAnalyze}
                            disabled={analyzeMutation.isPending}
                            className="text-xs bg-primary hover:bg-primary/90 gap-1"
                          >
                            <Cpu className="h-3 w-3" />
                            {analyzeMutation.isPending ? "分析中..." : "開始情資分析"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border/50 border-dashed">
                <CardContent className="py-10 text-center">
                  <FileSearch className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground text-sm">尚未進行 OCR 辨識</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    請切換至「證物」 Tab，點擊圖片即可觸發 OCR 辨識
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── 情資分析 ─────────────────────────────────────────────────── */}
          <TabsContent value="intel" className="mt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">情資分析報告</h3>
                <p className="text-xs text-muted-foreground">LLM 自動萃取詐騙案件關鍵情資</p>
              </div>
              <div className="flex gap-2">
                {ocrResult?.confirmedText && (
                  <Button
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={analyzeMutation.isPending}
                    className="text-xs bg-primary hover:bg-primary/90 gap-1"
                  >
                    <Cpu className={`h-3 w-3 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
                    {analyzeMutation.isPending ? "分析中..." : intelReport ? "重新分析" : "開始情資分析"}
                  </Button>
                )}
                {intelReport && walletAddresses.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleQueryWallets}
                    disabled={walletQueryMutation.isPending}
                    className="text-xs gap-1"
                  >
                    <Wallet className="h-3 w-3" />
                    {walletQueryMutation.isPending ? "查詢中..." : `查詢 ${walletAddresses.length} 個錢包`}
                  </Button>
                )}
              </div>
            </div>

            {analyzeMutation.isPending && (
              <Card className="bg-card border-border/50">
                <CardContent className="py-8 text-center">
                  <Cpu className="h-8 w-8 text-primary mx-auto mb-3 animate-pulse" />
                  <p className="text-muted-foreground text-sm">LLM 正在分析情資...</p>
                </CardContent>
              </Card>
            )}

            {intelReport ? (
              <IntelReportView report={intelReport as any} />
            ) : (
              <Card className="bg-card border-border/50 border-dashed">
                <CardContent className="py-10 text-center">
                  <Cpu className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground text-sm">尚未進行情資分析</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    請先完成 OCR 辨識並確認全文後，再進行情資分析
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── 錢包分析 ─────────────────────────────────────────────────── */}
          <TabsContent value="wallets" className="mt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">加密貨幣錢包分析</h3>
                <p className="text-xs text-muted-foreground">ETH / TRON / TRC-20 鏈上資料查詢</p>
              </div>
              {intelReport && walletAddresses.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleQueryWallets}
                  disabled={walletQueryMutation.isPending}
                  className="text-xs bg-primary hover:bg-primary/90 gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${walletQueryMutation.isPending ? "animate-spin" : ""}`} />
                  {walletQueryMutation.isPending ? "查詢中..." : "重新查詢"}
                </Button>
              )}
            </div>

            {wallets && wallets.length > 0 ? (
              <div className="space-y-4">
                {wallets.map((w: any) => (
                  <WalletCard key={w.id} wallet={w} />
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border/50 border-dashed">
                <CardContent className="py-10 text-center">
                  <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground text-sm">尚無錢包分析資料</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {walletAddresses.length > 0
                      ? `情資分析發現 ${walletAddresses.length} 個錢包地址，點擊上方按鈕查詢`
                      : "請先完成情資分析以識別錢包地址"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── 案件報告 ─────────────────────────────────────────────────── */}
          <TabsContent value="report" className="mt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">案件報告</h3>
                <p className="text-xs text-muted-foreground">整合案件所有資訊，可列印或儲存為 PDF</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (!printWindow) return;
                  const r = intelReport as any;
                  const reporter = c.reporter as any;
                  const walletList = (wallets || []) as any[];
                  const html = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>案件報告 - ${c.caseNumber}</title><style>body{font-family:'Microsoft JhengHei',Arial,sans-serif;font-size:12px;line-height:1.6;color:#111;margin:0;padding:20px}h1{font-size:18px;text-align:center;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:16px}h2{font-size:14px;background:#1a1a2e;color:#fff;padding:4px 8px;margin:16px 0 8px}h3{font-size:13px;color:#333;margin:12px 0 6px;border-left:3px solid #c0392b;padding-left:8px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:11px}th{background:#f0f0f0;font-weight:bold}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:12px}.meta-item{font-size:11px}.meta-label{color:#666}.meta-value{font-weight:bold}.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px}.badge-eth{background:#dbeafe;color:#1d4ed8}.badge-tron{background:#fee2e2;color:#b91c1c}ul{margin:0;padding-left:18px}li{margin-bottom:2px}@media print{body{margin:0}}</style></head><body>
                  <h1>詐騙案件報告</h1>
                  <div class="meta">
                    <div class="meta-item"><span class="meta-label">案號：</span><span class="meta-value">${c.caseNumber}</span></div>
                    <div class="meta-item"><span class="meta-label">受理日期：</span><span class="meta-value">${new Date(c.createdAt).toLocaleDateString("zh-TW")}</span></div>
                    <div class="meta-item"><span class="meta-label">受理單位：</span><span class="meta-value">${c.officerUnit}</span></div>
                    <div class="meta-item"><span class="meta-label">受理員警：</span><span class="meta-value">${c.officerName}</span></div>
                  </div>
                  ${r ? `<h2>1. 案件摘要</h2><p>${r.caseSummary || ""}</p>` : ""}
                  ${reporter ? `<h2>2. 被害人</h2><table><tr><th>姓名</th><th>身分證字號</th><th>出生日期</th><th>現住地址</th><th>電話</th></tr><tr><td>${reporter.name||""}</td><td>${reporter.idNumber||""}</td><td>${reporter.birthDate||""}</td><td>${reporter.address||""}</td><td>${reporter.phone||""}</td></tr></table>` : ""}
                  ${r?.suspects?.length ? `<h2>3. 嫌疑人</h2><table><tr><th>就稱</th><th>平台</th><th>帳號</th><th>角色</th></tr>${r.suspects.map((s:any)=>`<tr><td>${s.alias||""}</td><td>${s.platform||""}</td><td>${(s.accounts||[]).join(", ")}</td><td>${s.role||""}</td></tr>`).join("")}</table>` : ""}
                  ${r?.relatedAccounts?.length ? `<h2>4. 相關帳號與網址</h2><table><tr><th>平台</th><th>帳號/網址</th><th>類型</th></tr>${r.relatedAccounts.map((a:any)=>`<tr><td>${a.platform||""}</td><td>${a.account||a.url||""}</td><td>${a.type||""}</td></tr>`).join("")}</table>` : ""}
                  ${r?.timeline?.length ? `<h2>5. 事件時序</h2><table><tr><th>時間</th><th>事件</th></tr>${r.timeline.map((t:any)=>`<tr><td>${t.datetime||""}</td><td>${t.event||""}</td></tr>`).join("")}</table>` : ""}
                  ${walletList.length ? `<h2>6. 錢包分析</h2>${walletList.map((w:any)=>`<h3><span class="badge ${w.chain==="ETH"?"badge-eth":"badge-tron"}">${w.chain}</span> ${w.address}</h3><table><tr><th>建立時間</th><th>最後交易</th><th>交易次數</th><th>轉入金額</th><th>轉出金額</th></tr><tr><td>${w.createTime?new Date(w.createTime).toLocaleDateString("zh-TW"):""}</td><td>${w.lastTransactionDate?new Date(w.lastTransactionDate).toLocaleDateString("zh-TW"):""}</td><td>${w.transactionTimes||0}</td><td>${w.transInAmount||0}</td><td>${w.transOutAmount||0}</td></tr></table>${(w.trc20Ledger||[]).length?`<p><strong>TRC-20 明細</strong></p><table><tr><th>代幣</th><th>方向</th><th>金額</th><th>日期</th><th>對象</th></tr>${(w.trc20Ledger||[]).map((tx:any)=>`<tr><td>${tx.tokenSymbol}</td><td>${tx.direction==="IN"?"轉入":"轉出"}</td><td>${tx.amount}</td><td>${tx.date?new Date(tx.date).toLocaleDateString("zh-TW"):""}</td><td>${tx.direction==="IN"?tx.from:tx.to}</td></tr>`).join("")}</table>`:""}`).join("")}` : ""}
                  ${r?.unverified?.length ? `<h2>7. 待確認事項</h2><ul>${r.unverified.map((u:string)=>`<li>${u}</li>`).join("")}</ul>` : ""}
                  <p style="margin-top:24px;font-size:10px;color:#999;text-align:right">報告產生時間：${new Date().toLocaleString("zh-TW")}</p>
                  </body></html>`;
                  printWindow.document.write(html);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => printWindow.print(), 500);
                }}
                className="text-xs bg-primary hover:bg-primary/90 gap-1"
              >
                <Download className="h-3 w-3" />
                列印 / 儲存 PDF
              </Button>
            </div>

            {intelReport ? (
              <div className="space-y-4">
                <IntelReportView report={intelReport as any} />
                {wallets && wallets.length > 0 && (
                  <Card className="bg-card border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        錢包分析摘要
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(wallets as any[]).map((w: any) => (
                          <div key={w.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${w.chain === "ETH" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>{w.chain}</Badge>
                              <code className="text-xs font-mono text-foreground truncate max-w-48">{w.address}</code>
                            </div>
                            <div className="text-xs text-muted-foreground">交易 {w.transactionTimes || 0} 次</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="bg-card border-border/50 border-dashed">
                <CardContent className="py-10 text-center">
                  <FileSearch className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground text-sm">尚無情資分析報告</p>
                  <p className="text-xs text-muted-foreground mt-1">請先完成 OCR 確認與情資分析</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* OCR 文字查看 Dialog */}
      <Dialog open={!!selectedOcrFile} onOpenChange={(open) => !open && setSelectedOcrFile(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              OCR 辨識結果：{selectedOcrFile?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedOcrFile && (
            <div className="space-y-3">
              <img
                src={selectedOcrFile.storageUrl}
                alt={selectedOcrFile.name}
                className="w-full max-h-48 object-contain rounded-lg border border-border/50"
              />
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2">辨識文字：</p>
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {selectedOcrFile.ocrText}
                </pre>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => {
                    handleOcrSingleFile(selectedOcrFile.id);
                    setSelectedOcrFile(null);
                  }}
                >
                  <RefreshCw className="h-3 w-3" />重新辨識
                </Button>
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedOcrFile(null)}
                >
                  關閉
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PoliceLayout>
  );
}
// ─── 情資報告子元件件 ───────────────────────────────────────────────────────────
function IntelReportView({ report }: { report: any }) {
  return (
    <div className="space-y-4">
      {/* 案件摘要 */}
      {report.caseSummary && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">案件摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed">{report.caseSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* 嫌疑人 */}
      {report.suspects?.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              嫌疑人資訊 ({report.suspects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.suspects.map((s: any, i: number) => (
                <div key={i} className="bg-secondary/30 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{s.alias || "未知"}</span>
                    <Badge className="text-xs bg-destructive/20 text-red-400 border-destructive/30">{s.platform}</Badge>
                    {s.role && <span className="text-xs text-muted-foreground">{s.role}</span>}
                  </div>
                  {s.accounts?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.accounts.map((acc: string, j: number) => (
                        <code key={j} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-foreground">{acc}</code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 相關帳號與網址 */}
      {report.relatedAccounts?.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">相關帳號與網址</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.relatedAccounts.map((acc: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge className="text-xs shrink-0 bg-secondary text-muted-foreground border-border/50">
                    {acc.platform}
                  </Badge>
                  <code className="text-xs text-foreground flex-1 min-w-0 truncate">{acc.account}</code>
                  {acc.url && (
                    <a href={acc.url} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs shrink-0">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 事件時序 */}
      {report.timeline?.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />事件時序
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.timeline.map((t: any, i: number) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    {i < report.timeline.length - 1 && <div className="w-0.5 flex-1 bg-border/50 mt-1" />}
                  </div>
                  <div className="pb-2 flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{t.datetime}</p>
                    <p className="text-sm text-foreground mt-0.5">{t.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 錢包地址 */}
      {report.walletAddresses?.length > 0 && (
        <Card className="bg-card border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-400" />
              加密貨幣錢包地址 ({report.walletAddresses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.walletAddresses.map((w: any, i: number) => (
                <div key={i} className="bg-secondary/30 rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">{w.chain}</Badge>
                    {w.context && <span className="text-muted-foreground">{w.context}</span>}
                  </div>
                  <code className="text-foreground break-all">{w.address}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 待確認 */}
      {report.unverified?.length > 0 && (
        <Card className="bg-card border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              待確認事項
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {report.unverified.map((item: string, i: number) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-yellow-400 shrink-0 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── 錢包卡片子元件 ───────────────────────────────────────────────────────────
function WalletCard({ wallet }: { wallet: any }) {
  const [showLedger, setShowLedger] = useState(false);
  const trc20Ledger = (wallet.trc20Ledger as any[]) || [];

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${wallet.chain === "ETH" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
              {wallet.chain}
            </Badge>
            <code className="text-xs text-foreground font-mono break-all">{wallet.address}</code>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["建立時間", wallet.createTime ? new Date(wallet.createTime).toLocaleDateString("zh-TW") : "未知"],
            ["最後交易", wallet.lastTransactionDate ? new Date(wallet.lastTransactionDate).toLocaleDateString("zh-TW") : "未知"],
            ["交易次數", wallet.transactionTimes?.toString() || "0"],
            ["轉入次數", wallet.transInTimes?.toString() || "0"],
            ["轉入金額", wallet.transInAmount || "0"],
            ["轉出次數", wallet.transOutTimes?.toString() || "0"],
            ["轉出金額", wallet.transOutAmount || "0"],
          ].map(([label, value]) => (
            <div key={label} className="bg-secondary/30 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {trc20Ledger.length > 0 && (
          <div>
            <button
              onClick={() => setShowLedger(!showLedger)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              TRC-20 代幣交易明細 ({trc20Ledger.length} 筆)
              {showLedger ? " ▲" : " ▼"}
            </button>
            {showLedger && (
              <div className="mt-2 overflow-auto max-h-64">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left p-1.5 text-muted-foreground font-medium">代幣</th>
                      <th className="text-left p-1.5 text-muted-foreground font-medium">方向</th>
                      <th className="text-right p-1.5 text-muted-foreground font-medium">金額</th>
                      <th className="text-left p-1.5 text-muted-foreground font-medium">日期</th>
                      <th className="text-left p-1.5 text-muted-foreground font-medium">對象</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trc20Ledger.map((tx: any, i: number) => (
                      <tr key={i} className="border-t border-border/30 hover:bg-secondary/20">
                        <td className="p-1.5 text-foreground font-mono">{tx.tokenSymbol}</td>
                        <td className="p-1.5">
                          <Badge className={`text-xs ${tx.direction === "IN" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                            {tx.direction === "IN" ? "轉入" : "轉出"}
                          </Badge>
                        </td>
                        <td className="p-1.5 text-right text-foreground font-mono">{tx.amount}</td>
                        <td className="p-1.5 text-muted-foreground">{tx.date ? new Date(tx.date).toLocaleDateString("zh-TW") : ""}</td>
                        <td className="p-1.5 text-muted-foreground font-mono truncate max-w-24">
                          {tx.direction === "IN" ? tx.from : tx.to}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
