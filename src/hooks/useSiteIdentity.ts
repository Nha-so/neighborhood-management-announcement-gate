import { usePublicSettings } from "@/hooks/usePublicSettings";
import { resolveAssetUrl } from "@/utils/resolveAssetUrl";
import type { PublicSettings } from "@/types/settings";

// Ten mac dinh khi cau hinh app_identity chua co / dang tai - la ten that cua
// don vi van hanh trang nay (truoc day duoc viet cung trong Header/Footer).
const DEFAULT_WARD = "Phường Dương Nội";
const DEFAULT_CITY = "Thành phố Hà Nội";

export function useSiteIdentity() {
  const { data } = usePublicSettings();
  const identity = data?.app_identity;
  const ward = identity?.ward?.trim() || DEFAULT_WARD;
  const city = identity?.city?.trim() || DEFAULT_CITY;

  return {
    identity,
    ward,
    city,
    unitName: identity?.name?.trim() || `UBND ${ward}`,
    // "Phường Dương Nội" -> "phường Dương Nội" de ghep vao giua cau.
    wardInSentence: ward.replace(/^(Phường|Xã|Thị trấn)(?=\s)/u, m => m.toLowerCase()),
    logoUrl: resolveAssetUrl(data?.announcement_gate_logo_url),
    banners: resolveBanners(data),
  };
}

export type HeroBanner = { id: string; src: string; focusY: number };

function resolveBanners(data: PublicSettings | undefined): HeroBanner[] {
  const list = Array.isArray(data?.announcement_gate_banners)
    ? data.announcement_gate_banners
    : [];
  const banners = list.flatMap(b => {
    const src = typeof b?.url === "string" ? resolveAssetUrl(b.url) : undefined;
    if (!src) return [];
    const focusY = Number.isFinite(b.focusY) ? Math.min(100, Math.max(0, b.focusY)) : 50;
    return [{ id: String(b.id ?? src), src, focusY }];
  });
  if (banners.length > 0) return banners;
  // Backend cu chi co 1 anh.
  const legacy = resolveAssetUrl(data?.announcement_gate_billboard_url);
  return legacy ? [{ id: "legacy", src: legacy, focusY: 50 }] : [];
}
