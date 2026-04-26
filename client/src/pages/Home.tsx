import PoliceLayout from "@/components/PoliceLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen, PlusCircle, Clock, CheckCircle2, AlertCircle,
  TrendingUp, Shield, FileSearch, Cpu, Wallet
} from "lucide-react";
import { useLocation } from "wouter";
import { CASE_STATUS_LABELS, LOGO_URL, APP_TITLE } from "@/lib/constants";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: cases = [], isLoading } = trpc.cases.list.useQuery();

  const stats = {
    total: cases.length,
    pending: cases.filter((c: any) => c.status === "pending").length,
    submitted: cases.filter((c: any) => c.status === "submitted").length,
    analyzed: cases.filter((c: any) => c.status === "analyzed").length,
    closed: cases.filter((c: any) => c.status === "closed").length,
  };

  const recentCases = [...cases].slice(0, 5);

  return (
    <PoliceLayout>
      <div className="space-y-6">
        {/* 歡迎標語 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="警察局" className="w-12 h-12 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                歡迎，{(user as any)?.name || "員警"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {(user as any)?.unit || "未設定單位"} · 詐騙案件受理輔助系統
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLocation("/cases/new")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            新建案件
          </Button>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<FolderOpen className="h-5 w-5 text-blue-400" />}
            label="案件總數"
            value={stats.total}
            color="blue"
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-yellow-400" />}
            label="待填寫"
            value={stats.pending}
            color="yellow"
          />
          <StatCard
            icon={<AlertCircle className="h-5 w-5 text-orange-400" />}
            label="待處理"
            value={stats.submitted}
            color="orange"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
            label="已完成分析"
            value={stats.analyzed}
            color="green"
          />
        </div>

        {/* 快速操作 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            icon={<PlusCircle className="h-6 w-6 text-primary" />}
            title="新建案件"
            desc="受理新報案，產生 QR Code 供報案人填寫"
            onClick={() => setLocation("/cases/new")}
          />
          <QuickActionCard
            icon={<FileSearch className="h-6 w-6 text-cyan-400" />}
            title="案件管理"
            desc="查看所有案件，追蹤處理進度"
            onClick={() => setLocation("/cases")}
          />
          <QuickActionCard
            icon={<Cpu className="h-6 w-6 text-purple-400" />}
            title="待處理案件"
            desc={`${stats.submitted} 件報案人已提交，待 OCR 辨識`}
            onClick={() => setLocation("/cases")}
            highlight={stats.submitted > 0}
          />
        </div>

        {/* 最近案件 */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              最近案件
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">載入中...</div>
            ) : recentCases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                尚無案件，點擊「新建案件」開始受理
              </div>
            ) : (
              <div className="space-y-2">
                {recentCases.map((c: any) => {
                  const statusInfo = CASE_STATUS_LABELS[c.status] || { label: c.status, color: "" };
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors case-card border border-border/30"
                      onClick={() => setLocation(`/cases/${c.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{c.caseNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString("zh-TW")}
                          </p>
                        </div>
                      </div>
                      <Badge className={`text-xs px-2 py-0.5 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PoliceLayout>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/10",
    yellow: "border-yellow-500/30 bg-yellow-500/10",
    orange: "border-orange-500/30 bg-orange-500/10",
    green: "border-green-500/30 bg-green-500/10",
  };
  return (
    <Card className={`border ${colorMap[color] || ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          {icon}
          <span className="text-2xl font-bold text-foreground">{value}</span>
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ icon, title, desc, onClick, highlight }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 border-border/50 case-card ${highlight ? "border-orange-500/50 bg-orange-500/5" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="font-semibold text-sm text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}
