export const LOGO_URL = "/manus-storage/police_logo_0675c601.png";
export const APP_TITLE = "詐騙案件受理輔助系統";
export const APP_SUBTITLE = "警察局數位化報案處理平台";
export const CASE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: "等待報案人填寫", color: "status-pending" },
  submitted:   { label: "報案人已提交",   color: "status-submitted" },
  ocr_pending: { label: "OCR 辨識中",     color: "status-ocr_pending" },
  ocr_done:    { label: "待確認 OCR",     color: "status-ocr_done" },
  analyzing:   { label: "情資分析中",     color: "status-analyzing" },
  analyzed:    { label: "分析完成",       color: "status-analyzed" },
  closed:      { label: "已結案",         color: "status-closed" },
};
export const CASE_TYPES = [
  "投資詐騙",
  "假冒公務員詐騙",
  "網路購物詐騙",
  "愛情詐騙（交友詐騙）",
  "假冒親友詐騙",
  "工作詐騙",
  "釣魚簡訊/電話詐騙",
  "加密貨幣詐騙",
  "其他詐騙",
];
export const ECONOMIC_STATUS_OPTIONS = [
  { value: "貧寒", label: "貧寒" },
  { value: "勉持", label: "勉持" },
  { value: "小康", label: "小康" },
  { value: "中產", label: "中產" },
  { value: "富裕", label: "富裕" },
];
// 與後端 z.enum 保持一致
export const EDUCATION_OPTIONS = [
  "國小",
  "國中",
  "高中職",
  "大學",
  "碩士",
  "博士",
  "其他",
] as const;
export type EducationOption = typeof EDUCATION_OPTIONS[number];
export type GenderOption = "男" | "女" | "其他";
export type EconomicStatusOption = "貧寒" | "勉持" | "小康" | "中產" | "富裕";
