export const LOAI_TIN_TUC = [
  "chung",
  "hoat_dong",
  "an_ninh_trat_tu",
  "khac",
] as const;
export type LoaiTinTuc = (typeof LOAI_TIN_TUC)[number];

// Dong bo voi LOAI_TIN_TUC_LABEL o backend (src/types/index.ts).
export const LOAI_TIN_TUC_LABEL: Record<LoaiTinTuc, string> = {
  chung: "Tin chung",
  hoat_dong: "Hoạt động cộng đồng",
  an_ninh_trat_tu: "An ninh trật tự",
  khac: "Khác",
};

export function getNewsSourceLabel(item: Pick<NewsItem, "source" | "externalUrl">): string | undefined {
  if (!item.externalUrl || !item.source || item.source === "noi_bo") return undefined;
  return NEWS_SOURCE_LABEL[item.source] ?? "Nguồn bên ngoài";
}

export function getNewsCategoryLabel(category: string): string {
  return LOAI_TIN_TUC_LABEL[category as LoaiTinTuc] ?? "Tin tức";
}

// "noi_bo" = tin to dan pho tu soan; con lai = tin gan link tu cong thong tin
// chinh thuc (chi co tieu de + tom tat, doc toan van o bai goc).
export type NguonTinTuc = "noi_bo" | "duongnoi";

export const NEWS_SOURCE_LABEL: Record<Exclude<NguonTinTuc, "noi_bo">, string> = {
  duongnoi: "Cổng TTĐT phường Dương Nội",
};

export type NewsItem = {
  _id: string;
  title: string;
  category: LoaiTinTuc;
  // HTML da qua trinh soan thao - phai sanitize truoc khi render.
  content: string;
  // Ban ghi cu chua co source -> coi nhu "noi_bo".
  source?: NguonTinTuc;
  externalUrl?: string;
  summary?: string;
  coverImageUrl?: string;
  images?: string[];
  pinned: boolean;
  publishedAt?: string;
  createdAt: string;
};
