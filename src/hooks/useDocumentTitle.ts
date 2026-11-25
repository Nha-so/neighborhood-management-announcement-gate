import { useEffect } from "react";
import { useSiteIdentity } from "@/hooks/useSiteIdentity";

// Tieu de tab: "<trang> – <Phuong> - Trang thong tin dien tu".
export function useDocumentTitle(page?: string) {
  const { ward } = useSiteIdentity();
  useEffect(() => {
    const base = `${ward} - Trang thông tin điện tử`;
    document.title = page ? `${page} – ${base}` : base;
  }, [page, ward]);
}
