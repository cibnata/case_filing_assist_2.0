import PoliceLayout from "@/components/PoliceLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, FileText, Cpu, Save, Printer, ChevronDown, ChevronUp,
  MessageSquare, Lightbulb, User, Clock
} from "lucide-react";

export default function InterrogationPage() {
  const { id } = useParams<{ id: string }>();
  const caseId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const [editingAnswers, setEditingAnswers] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: caseData } = trpc.cases.getById.useQuery({ id: caseId });
  const { data: interrogation, refetch } = trpc.interrogation.get.useQuery({ caseId });
  const { data: intelReport } = trpc.ocr.getIntel.useQuery({ caseId });

  const generateMutation = trpc.interrogation.generate.useMutation({
    onSuccess: () => {
      toast.success("筆錄問答已產生");
      refetch();
    },
    onError: (err) => toast.error("產生失敗：" + err.message),
  });

  const updateMutation = trpc.interrogation.update.useMutation({
    onSuccess: () => {
      toast.success("已儲存");
      refetch();
    },
    onError: (err) => toast.error("儲存失敗：" + err.message),
  });

  const handleGenerate = () => {
    generateMutation.mutate({ caseId });
  };

  const handleSaveAnswer = (questionIndex: number, answer: string) => {
    if (!interrogation) return;
    const questions = [...((interrogation?.record?.questions as any[]) || [])];
    questions[questionIndex] = { ...questions[questionIndex], answer };
    updateMutation.mutate({ caseId, questions });
    setEditingAnswers(prev => {
      const next = { ...prev };
      delete next[questionIndex];
      return next;
    });
  };

  const handlePrint = () => {
    if (!interrogation || !caseData) return;
    const questions = (interrogation?.record?.questions as any[]) || [];
    const reporter = (caseData as any).reporter;
    const now = new Date();

    const printContent = `
      <html><head><title>調查筆錄 - ${(caseData as any).caseNumber}</title>
      <style>
        body { font-family: "Microsoft JhengHei", sans-serif; font-size: 13px; padding: 30px; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        td, th { border: 1px solid #000; padding: 6px 10px; }
        .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px; }
        .qa { margin-bottom: 12px; }
        .q { font-weight: bold; margin-bottom: 4px; }
        .a { padding-left: 20px; }
        .label { font-weight: bold; width: 100px; }
        .section-title { font-weight: bold; margin: 16px 0 8px; font-size: 14px; }
        .suggested { color: #666; font-style: italic; }
      </style></head>
      <body>
        <div class="title">調查筆錄</div>
        <table>
          <tr><td class="label" rowspan="2">詢<br>問<br>時<br>間</td>
            <td>自 ${now.getFullYear() - 1911} 年 ${now.getMonth()+1} 月 ${now.getDate()} 日 起</td></tr>
          <tr><td>至 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 止</td></tr>
          <tr><td class="label">地&nbsp;&nbsp;&nbsp;&nbsp;點</td><td>${(caseData as any).officerUnit || ""}</td></tr>
          <tr><td class="label">案&nbsp;&nbsp;&nbsp;&nbsp;由</td><td>${reporter?.caseType || "詐欺"}</td></tr>
        </table>
        <table>
          <tr><td class="label" rowspan="12">受<br>詢<br>問<br>人</td>
            <td class="label">姓&nbsp;&nbsp;&nbsp;&nbsp;名</td><td>${reporter?.name || ""}</td>
            <td class="label">別（綽）號</td><td>${reporter?.alias || "無"}</td></tr>
          <tr><td class="label">性&nbsp;&nbsp;&nbsp;&nbsp;別</td><td>${reporter?.gender || ""}</td>
            <td class="label">出生年月日</td><td>${reporter?.birthDate ? formatROCDate(reporter.birthDate) : ""}</td></tr>
          <tr><td class="label">出生地</td><td>${reporter?.birthPlace || ""}</td>
            <td class="label">職&nbsp;&nbsp;&nbsp;&nbsp;業</td><td>${reporter?.occupation || ""}</td></tr>
          <tr><td class="label" colspan="2">身分證統一編號</td><td colspan="2">${reporter?.idNumber || ""}</td></tr>
          <tr><td class="label">戶籍地址</td><td colspan="3">${reporter?.registeredAddress || reporter?.address || ""}</td></tr>
          <tr><td class="label">現住地址</td><td colspan="3">${reporter?.address || ""}</td></tr>
          <tr><td class="label">教育程度</td><td>${reporter?.education || ""}</td>
            <td class="label">電話號碼</td><td>${reporter?.phone || ""}</td></tr>
          <tr><td class="label">家庭經濟狀況</td><td colspan="3">${reporter?.economicStatus || ""}</td></tr>
        </table>
        ${questions.map((q: any) => `
          <div class="qa">
            <div class="q">問 ${q.question}</div>
            <div class="a">答 ${q.answer || "（待填寫）"}</div>
          </div>
        `).join("")}
      </body></html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(printContent);
    win.document.close();
    win.print();
  };

  const formatROCDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `民國 ${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  };

  const questions = ((interrogation?.record?.questions as any[]) || []);
  const fixedQuestions = questions.filter((q: any) => q.type === "fixed");
  const suggestedQuestions = questions.filter((q: any) => q.type === "suggested");

  return (
    <PoliceLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* 頁頭 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation(`/cases/${caseId}`)}
              className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />返回
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                調查筆錄
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {(caseData as any)?.caseNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {questions.length > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-xs">
                <Printer className="h-3 w-3" />列印筆錄
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="gap-1 text-xs bg-primary hover:bg-primary/90"
            >
              <Cpu className="h-3 w-3" />
              {generateMutation.isPending ? "產生中..." : questions.length > 0 ? "重新產生" : "AI 產生筆錄"}
            </Button>
          </div>
        </div>

        {/* 被害人基本資料 */}
        {(caseData as any)?.reporter && (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                受詢問人基本資料
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {[
                  ["姓名", (caseData as any).reporter.name],
                  ["性別", (caseData as any).reporter.gender],
                  ["出生日期", (caseData as any).reporter.birthDate ? formatROCDate((caseData as any).reporter.birthDate) : ""],
                  ["身分證字號", (caseData as any).reporter.idNumber],
                  ["職業", (caseData as any).reporter.occupation],
                  ["電話", (caseData as any).reporter.phone],
                  ["現住地址", (caseData as any).reporter.address],
                  ["報案類別", (caseData as any).reporter.caseType],
                  ["家庭經濟狀況", (caseData as any).reporter.economicStatus],
                ].map(([label, value]) => value ? (
                  <div key={label}>
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <p className="text-foreground text-sm mt-0.5">{value}</p>
                  </div>
                ) : null)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 無筆錄時的提示 */}
        {questions.length === 0 && !generateMutation.isPending && (
          <Card className="bg-card border-border/50 border-dashed">
            <CardContent className="py-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">尚未產生筆錄問答</p>
              <p className="text-xs text-muted-foreground mt-1">
                {intelReport ? "點擊「AI 產生筆錄」自動產生問答" : "請先完成情資分析後再產生筆錄"}
              </p>
              <Button
                onClick={handleGenerate}
                disabled={!intelReport}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Cpu className="h-4 w-4 mr-2" />
                AI 產生筆錄問答
              </Button>
            </CardContent>
          </Card>
        )}

        {generateMutation.isPending && (
          <Card className="bg-card border-border/50">
            <CardContent className="py-8 text-center">
              <Cpu className="h-8 w-8 text-primary mx-auto mb-3 animate-pulse" />
              <p className="text-muted-foreground text-sm">AI 正在產生筆錄問答...</p>
            </CardContent>
          </Card>
        )}

        {/* 固定問項 */}
        {fixedQuestions.length > 0 && (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                標準問項
                <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                  {fixedQuestions.length} 題
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fixedQuestions.map((q: any, idx: number) => (
                <QuestionItem
                  key={idx}
                  question={q}
                  index={idx}
                  editingAnswer={editingAnswers[idx]}
                  expanded={expanded[idx]}
                  onToggleExpand={() => setExpanded(p => ({ ...p, [idx]: !p[idx] }))}
                  onEditAnswer={(val) => setEditingAnswers(p => ({ ...p, [idx]: val }))}
                  onSaveAnswer={(val) => handleSaveAnswer(idx, val)}
                  isSaving={updateMutation.isPending}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* AI 建議追問 */}
        {suggestedQuestions.length > 0 && (
          <Card className="bg-card border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                AI 建議追問
                <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {suggestedQuestions.length} 題
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                根據本案情資分析，AI 建議進一步詢問以下問題
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestedQuestions.map((q: any, idx: number) => {
                const globalIdx = fixedQuestions.length + idx;
                return (
                  <QuestionItem
                    key={globalIdx}
                    question={q}
                    index={globalIdx}
                    editingAnswer={editingAnswers[globalIdx]}
                    expanded={expanded[globalIdx]}
                    onToggleExpand={() => setExpanded(p => ({ ...p, [globalIdx]: !p[globalIdx] }))}
                    onEditAnswer={(val) => setEditingAnswers(p => ({ ...p, [globalIdx]: val }))}
                    onSaveAnswer={(val) => handleSaveAnswer(globalIdx, val)}
                    isSaving={updateMutation.isPending}
                    isSuggested
                  />
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </PoliceLayout>
  );
}

function QuestionItem({
  question, index, editingAnswer, expanded,
  onToggleExpand, onEditAnswer, onSaveAnswer, isSaving, isSuggested
}: {
  question: any;
  index: number;
  editingAnswer?: string;
  expanded?: boolean;
  onToggleExpand: () => void;
  onEditAnswer: (val: string) => void;
  onSaveAnswer: (val: string) => void;
  isSaving: boolean;
  isSuggested?: boolean;
}) {
  const isEditing = editingAnswer !== undefined;
  const currentAnswer = editingAnswer ?? question.answer ?? "";

  return (
    <div className={`rounded-lg border p-3 ${isSuggested ? "border-amber-500/20 bg-amber-500/5" : "border-border/50 bg-secondary/20"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className={`text-xs font-bold shrink-0 mt-0.5 ${isSuggested ? "text-amber-400" : "text-primary"}`}>
            問{index + 1}
          </span>
          <p className="text-sm text-foreground">{question.question}</p>
        </div>
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {question.hint && (
        <p className="text-xs text-muted-foreground mt-1 ml-6 italic">{question.hint}</p>
      )}

      {expanded && (
        <div className="mt-3 ml-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">答</span>
            {!isEditing && (
              <button
                onClick={() => onEditAnswer(question.answer || "")}
                className="text-xs text-primary hover:underline"
              >
                {question.answer ? "編輯" : "填寫答案"}
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={currentAnswer}
                onChange={e => onEditAnswer(e.target.value)}
                placeholder="輸入答案..."
                className="bg-secondary/50 border-border/50 resize-none text-sm"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onSaveAnswer(currentAnswer)}
                  disabled={isSaving}
                  className="text-xs bg-primary hover:bg-primary/90 gap-1"
                >
                  <Save className="h-3 w-3" />儲存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditAnswer(undefined as any)}
                  className="text-xs"
                >
                  取消
                </Button>
              </div>
            </div>
          ) : question.answer ? (
            <p className="text-sm text-foreground bg-secondary/30 rounded p-2">{question.answer}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">（尚未填寫）</p>
          )}
        </div>
      )}
    </div>
  );
}
