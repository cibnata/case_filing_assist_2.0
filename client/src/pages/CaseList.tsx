import PoliceLayout from "@/components/PoliceLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Search, FolderOpen, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { CASE_STATUS_LABELS } from "@/lib/constants";

export default function CaseList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: cases = [], isLoading } = trpc.cases.list.useQuery();

  const filtered = cases.filter((c: any) => {
    const matchSearch =
      c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.officerName.includes(search) ||
      c.officerUnit.includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <PoliceLayout>
      <div className="space-y-5">
        {/* 頁頭 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              案件管理
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">共 {cases.length} 件案件</p>
          </div>
          <Button
            onClick={() => setLocation("/cases/new")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            新建案件
          </Button>
        </div>

        {/* 篩選列 */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋案件編號、員警..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-secondary/50 border-border/50"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
              <SelectValue placeholder="篩選狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              {Object.entries(CASE_STATUS_LABELS).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 案件列表 */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">載入中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>沒有符合條件的案件</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c: any) => {
              const statusInfo = CASE_STATUS_LABELS[c.status] || { label: c.status, color: "" };
              return (
                <Card
                  key={c.id}
                  className="bg-card border-border/50 cursor-pointer hover:border-primary/40 transition-all case-card"
                  onClick={() => setLocation(`/cases/${c.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-1 h-10 rounded-full bg-primary shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-sm text-foreground">
                              {c.caseNumber}
                            </span>
                            <Badge className={`text-xs px-2 py-0 ${statusInfo.color}`}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{c.officerName}</span>
                            <span>·</span>
                            <span>{c.officerUnit}</span>
                            <span>·</span>
                            <span>{new Date(c.createdAt).toLocaleString("zh-TW")}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PoliceLayout>
  );
}
