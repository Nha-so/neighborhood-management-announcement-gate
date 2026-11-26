import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useSiteIdentity, type HeroBanner } from "@/hooks/useSiteIdentity";
import { cn } from "@/utils/cn";
import styles from "./HeroSection.module.css";

// Anh banner (tai len o admin > Cổng thông tin điện tử) rong het man hinh,
// chieu cao bi gioi han de khong chiem tron man hinh - phan anh duoc giu lai
// theo focusY admin chon. Nhieu anh thi tu chuyen anh (trinh chieu). Co anh
// thi an dai tieu de (chi giu h1 cho trinh doc man hinh); chua co anh (hoac
// moi anh deu loi) thi hien dai mau voi tieu de va mo ta.
export function HeroSection() {
  const { wardInSentence, banners } = useSiteIdentity();
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());

  const title = `Thông tin và dịch vụ cho cư dân ${wardInSentence}`;
  const visible = banners.filter(b => !failedIds.has(b.id));

  if (visible.length > 0) {
    return (
      <div className={styles.hero}>
        <h1 className="visually-hidden">{title}</h1>
        <BannerCarousel
          banners={visible}
          altPrefix={`Ảnh banner trang thông tin điện tử ${wardInSentence}`}
          onImageError={id => setFailedIds(prev => new Set(prev).add(id))}
        />
      </div>
    );
  }

  return (
    <div className={styles.hero}>
      <div className={cn("wrap", styles.inner)}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>
          <span className={styles.leadLong}>
            Tra cứu bản đồ, thông tin Tổ dân phố và theo dõi tin tức,
            thông báo tại địa phương.
          </span>
          <span className={styles.leadShort}>
            Bản đồ, thông tin Tổ dân phố và tin tức địa phương.
          </span>
        </p>
      </div>
    </div>
  );
}

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD_PX = 40;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

type CarouselProps = {
  banners: HeroBanner[];
  altPrefix: string;
  onImageError: (id: string) => void;
};

function BannerCarousel({ banners, altPrefix, onImageError }: CarouselProps) {
  const count = banners.length;
  const multiple = count > 1;
  const [index, setIndex] = useState(0);
  // Nguoi dung tu bam tam dung (WCAG 2.2.2) - khac voi tam dung tam thoi khi
  // di chuot/focus vao banner. Mac dinh khong tu chay neu he thong bat giam
  // chuyen dong.
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [hovering, setHovering] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  // Danh sach co the ngan lai (anh loi/admin xoa) - giu chi so trong pham vi.
  const current = count > 0 ? index % count : 0;

  const go = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (!multiple || paused || hovering) return;
    const timer = window.setTimeout(
      () => setIndex(i => (i % count + 1) % count),
      AUTOPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [multiple, paused, hovering, count, current]);

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") swipeStartX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipeStartX.current;
    swipeStartX.current = null;
    if (start === null) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) go(current + (dx < 0 ? 1 : -1));
  };

  return (
    <section
      className={styles.carousel}
      aria-roledescription={multiple ? "carousel" : undefined}
      aria-label="Ảnh banner"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
      }}
      onPointerDown={multiple ? onPointerDown : undefined}
      onPointerUp={multiple ? onPointerUp : undefined}
      onPointerCancel={() => (swipeStartX.current = null)}
    >
      <div className={styles.track} aria-live={multiple && paused ? "polite" : "off"}>
        {banners.map((banner, i) => {
          const active = i === current;
          return (
            <div
              key={banner.id}
              className={cn(styles.slide, active && styles.slideActive)}
              role={multiple ? "group" : undefined}
              aria-roledescription={multiple ? "slide" : undefined}
              aria-label={multiple ? `${i + 1} / ${count}` : undefined}
              aria-hidden={!active}
            >
              <img
                className={styles.banner}
                src={banner.src}
                alt={multiple ? `${altPrefix} (${i + 1}/${count})` : altPrefix}
                style={{ "--focus-y": `${banner.focusY}%` } as CSSProperties}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                onError={() => onImageError(banner.id)}
              />
            </div>
          );
        })}
      </div>

      {multiple && (
        <>
          <button
            type="button"
            className={cn(styles.arrow, styles.arrowPrev)}
            aria-label="Ảnh trước"
            onClick={() => go(current - 1)}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            className={cn(styles.arrow, styles.arrowNext)}
            aria-label="Ảnh tiếp theo"
            onClick={() => go(current + 1)}
          >
            <ChevronIcon direction="right" />
          </button>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.pause}
              aria-label={paused ? "Tiếp tục tự chuyển ảnh" : "Tạm dừng tự chuyển ảnh"}
              onClick={() => setPaused(p => !p)}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                className={cn(styles.dot, i === current && styles.dotActive)}
                aria-label={`Xem ảnh ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
    </svg>
  );
}
