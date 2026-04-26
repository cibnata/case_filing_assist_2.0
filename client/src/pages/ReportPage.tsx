import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { useParams } from "wouter";
import {
  Shield, Upload, X, CheckCircle2, AlertCircle, ImageIcon, ChevronRight
} from "lucide-react";
import { LOGO_URL, APP_TITLE, CASE_TYPES, ECONOMIC_STATUS_OPTIONS, EDUCATION_OPTIONS } from "@/lib/constants";

type Step = "verify" | "form" | "upload" | "done";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export default function ReportPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("verify");
  const [form, setForm] = useState({
    name: "", idNumber: "", birthDate: "", address: "", registeredAddress: "",
    caseType: "", phone: "", gender: "", birthPlace: "", occupation: "",
    education: "", economicStatus: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 驗證 token
  const { data: caseInfo, isLoading: verifying, error: verifyError } =
    trpc.cases.validateQrToken.useQuery({ token: token || "" }, { enabled: !!token });

  const submitReporterMutation = trpc.cases.submitReporter.useMutation({
    onSuccess: () => { setStep("upload"); },
    onError: (err) => { toast.error("提交失敗：" + err.message); },
  });

  const uploadMutation = trpc.upload.uploadEvidence.useMutation();
  const notifyMutation = trpc.cases.notifyComplete.useMutation();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.idNumber || !form.birthDate || !form.address || !form.caseType) {
      toast.error("請填寫所有必填欄位");
      return;
    }
    if (!/^[A-Z][12]\d{8}$/.test(form.idNumber)) {
      toast.error("身分證字號格式不正確");
      return;
    }
    submitReporterMutation.mutate({ token: token || "", ...form });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} 超過 10MB 限制`); return false; }
      if (!f.type.startsWith("image/")) { toast.error(`${f.name} 不是圖片格式`); return false; }
      return true;
    });
    setFiles(prev => [...prev, ...valid]);
  };

  const handleUploadAll = async () => {
    if (files.length === 0) {
      toast.error("請至少上傳一張截圖");
      return;
    }
    setUploading(true);
    let done = 0;
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        await uploadMutation.mutateAsync({
          token: token || "",
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64,
          fileSize: file.size,
        });
        done++;
        setUploadProgress(Math.round((done / files.length) * 100));
      } catch (err: any) {
        toast.error(`上傳 ${file.name} 失敗`);
      }
    }
    // 通知員警
    await notifyMutation.mutateAsync({ token: token || "" });
    setUploading(false);
    setStep("done");
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ─── 驗證中 ─────────────────────────────────────────────────────────────
  if (verifying) {
    return <ReportLayout><div className="text-center py-12 text-muted-foreground">驗證報案連結中...</div></ReportLayout>;
  }

  if (verifyError || !caseInfo) {
    return (
      <ReportLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-foreground font-semibold">無效的報案連結</p>
          <p className="text-muted-foreground text-sm mt-1">請確認連結是否正確，或聯繫受理員警</p>
        </div>
      </ReportLayout>
    );
  }

  if (!caseInfo.valid) {
    return (
      <ReportLayout>
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-foreground font-semibold">此案件已完成報案資料填寫</p>
          <p className="text-muted-foreground text-sm mt-1">案件編號：{caseInfo.caseNumber}</p>
        </div>
      </ReportLayout>
    );
  }

  // ─── 完成頁 ─────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <ReportLayout>
        <div className="text-center py-8 space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-foreground">資料提交完成</h2>
            <p className="text-muted-foreground text-sm mt-2">
              感謝您的配合，受理員警已收到通知，<br />將盡快處理您的案件。
            </p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-4 text-sm text-muted-foreground">
            <p>案件編號：<span className="font-mono text-foreground">{caseInfo.caseNumber}</span></p>
            <p className="mt-1">受理員警：{caseInfo.officerName} / {caseInfo.officerUnit}</p>
          </div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout>
      {/* 案件資訊 */}
      <div className="bg-secondary/30 rounded-lg p-3 mb-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="h-4 w-4 text-primary" />
          <span>案件編號：<span className="font-mono text-foreground">{caseInfo.caseNumber}</span></span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          受理員警：{caseInfo.officerName} · {caseInfo.officerUnit}
        </p>
      </div>

      {/* 步驟指示 */}
      <div className="flex items-center gap-2 mb-5">
        {["form", "upload"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-primary text-primary-foreground" :
              (step === "upload" && s === "form") || (step as string) === "done" ? "bg-green-500 text-white" :
              "bg-secondary text-muted-foreground"
            }`}>
              {(step === "upload" && s === "form") || (step as string) === "done" ? "✓" : i + 1}
            </div>
            <span className={`text-xs ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {s === "form" ? "基本資料" : "上傳截圖"}
            </span>
            {i < 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* 步驟一：基本資料 */}
      {step === "form" && (
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">受詢問人基本資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="姓名 *">
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="請輸入姓名" className="bg-secondary/50 border-border/50" required />
                </Field>
                <Field label="性別">
                  <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v }))}>
                    <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="別（綽）號">
                  <Input value={form.birthPlace} onChange={e => setForm(p => ({ ...p, birthPlace: e.target.value }))}
                    placeholder="如無請填「無」" className="bg-secondary/50 border-border/50" />
                </Field>
                <Field label="出生年月日 *">
                  <Input type="date" value={form.birthDate} onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))}
                    className="bg-secondary/50 border-border/50" required />
                </Field>
              </div>

              <Field label="身分證統一編號 *">
                <Input value={form.idNumber} onChange={e => setForm(p => ({ ...p, idNumber: e.target.value.toUpperCase() }))}
                  placeholder="A123456789" maxLength={10} className="bg-secondary/50 border-border/50 font-mono" required />
              </Field>

              <Field label="職業">
                <Input value={form.occupation} onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))}
                  placeholder="例：上班族、家管、學生" className="bg-secondary/50 border-border/50" />
              </Field>

              <Field label="戶籍地址">
                <Textarea value={form.registeredAddress} onChange={e => setForm(p => ({ ...p, registeredAddress: e.target.value }))}
                  placeholder="戶籍地址" className="bg-secondary/50 border-border/50 resize-none" rows={2} />
              </Field>

              <Field label="現住地址 *">
                <Textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="現住地址" className="bg-secondary/50 border-border/50 resize-none" rows={2} required />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="教育程度">
                  <Select value={form.education} onValueChange={v => setForm(p => ({ ...p, education: v }))}>
                    <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>
                      {EDUCATION_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="電話號碼">
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="0912345678" className="bg-secondary/50 border-border/50" />
                </Field>
              </div>

              <Field label="家庭經濟狀況">
                <div className="flex gap-2 flex-wrap">
                  {ECONOMIC_STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, economicStatus: opt.value }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        form.economicStatus === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/50 text-muted-foreground border-border/50 hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="報案類別 *">
                <Select value={form.caseType} onValueChange={v => setForm(p => ({ ...p, caseType: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="選擇報案類別" /></SelectTrigger>
                  <SelectContent>
                    {CASE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={submitReporterMutation.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {submitReporterMutation.isPending ? "提交中..." : "下一步：上傳截圖"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </form>
      )}

      {/* 步驟二：上傳截圖 */}
      {step === "upload" && (
        <div className="space-y-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">上傳相關截圖</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                請上傳與詐騙相關的截圖，包括：對話截圖、網路銀行截圖、投資平台截圖等
              </p>

              {/* 上傳區 */}
              <div
                className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">點擊選擇圖片</p>
                <p className="text-xs text-muted-foreground mt-1">支援 JPG、PNG、WebP，每張最大 10MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* 已選圖片 */}
              {files.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="w-full h-24 object-cover rounded-lg border border-border/50"
                      />
                      <button
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-muted-foreground truncate mt-1">{f.name}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 上傳進度 */}
              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>上傳中...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("form")}
              disabled={uploading}
              className="flex-1"
            >
              返回修改
            </Button>
            <Button
              onClick={handleUploadAll}
              disabled={uploading || files.length === 0}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {uploading ? `上傳中 ${uploadProgress}%` : `確認提交 (${files.length} 張)`}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            提交後將自動通知受理員警，請勿重複提交
          </p>
        </div>
      )}
    </ReportLayout>
  );
}

function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* 頂部 Header */}
      <div className="bg-card border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <img src={LOGO_URL} alt="警察局" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">{APP_TITLE}</p>
            <p className="text-xs text-muted-foreground">線上報案資料填寫</p>
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
