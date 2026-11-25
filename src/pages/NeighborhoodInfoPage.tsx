import { lazy, Suspense, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingSpinner } from "@/components/common/StatusStates";
import { MapErrorBoundary } from "@/features/map/MapErrorBoundary";
import { neighborhoodGeometry } from "@/features/map/neighborhoodGeometry";
import { NeighborhoodHeadquarters } from "@/features/neighborhoods/NeighborhoodHeadquarters";
import { NeighborhoodOrgChart } from "@/features/neighborhoods/NeighborhoodOrgChart";
import { useNeighborhoodOverview, useNeighborhoodStats } from "@/features/neighborhoods/useNeighborhoodOverview";
import { useNeighborhoods } from "@/features/neighborhoods/useNeighborhoods";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSiteIdentity } from "@/hooks/useSiteIdentity";
import type { PublicNeighborhood, PublicNeighborhoodStats } from "@/types/neighborhood";
import { cn } from "@/utils/cn";
import { telHref } from "@/utils/formatPhone";
import styles from "./NeighborhoodInfoPage.module.css";

const NeighborhoodBoundaryMap = lazy(() => import("@/features/map/NeighborhoodBoundaryMap"));
const EMPTY_NEIGHBORHOODS: PublicNeighborhood[] = [];
const NO_POIS: never[] = [];
const noop = () => {};

const numberFormat = new Intl.NumberFormat("vi-VN");
const decimalFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function formatCount(value: number | null | undefined) {
  return typeof value === "number" ? numberFormat.format(value) : "—";
}

// Dien tich luu theo m2 - hien thi theo ha cho de doc.
function formatArea(m2: number | null | undefined) {
  return typeof m2 === "number" && m2 > 0 ? `${decimalFormat.format(m2 / 10_000)} ha` : "Chưa cập nhật";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

type Tile = { label: string; value: string; unit?: string; tone?: "primary" | "plain" };

function StatTiles({ tiles, compact }: { tiles: Tile[]; compact?: boolean }) {
  return (
    <dl className={cn(styles.tiles, compact && styles.tilesCompact)}>
      {tiles.map(tile => (
        <div key={tile.label} className={cn(styles.tile, tile.tone === "primary" && styles.tilePrimary)}>
          <dt className={styles.tileLabel}>{tile.label}</dt>
          <dd className={styles.tileValue}>
            {tile.value}
            {tile.unit && <span className={styles.tileUnit}> {tile.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function neighborhoodTiles(stats: PublicNeighborhoodStats | undefined): Tile[] {
  return [
    { label: "Số hộ", value: formatCount(stats?.households), unit: "hộ", tone: "primary" },
    { label: "Nhân khẩu", value: formatCount(stats?.citizens), unit: "người", tone: "primary" },
    { label: "Hộ kinh doanh", value: formatCount(stats?.householdBusinesses), unit: "cơ sở" },
    { label: "Doanh nghiệp", value: formatCount(stats?.companies), unit: "đơn vị" },
    { label: "Diện tích", value: formatArea(stats?.area) },
    {
      label: "Mật độ dân số",
      value: stats?.density != null ? formatCount(stats.density) : "Chưa cập nhật",
      unit: stats?.density != null ? "người/km²" : undefined,
    },
  ];
}

export function NeighborhoodInfoPage() {
  useDocumentTitle("Thông tin Tổ dân phố");
  const { ward, identity } = useSiteIdentity();
  const wardPhone = identity?.phone?.trim();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?to= tổ đang chọn, ?q= từ khóa tìm kiếm (liên kết chia sẻ được; /to-dan-pho?q=
  // cũ chuyển hướng về đây giữ nguyên ?q=).
  const selectedId = searchParams.get("to");
  const query = searchParams.get("q") ?? "";
  const panelRef = useRef<HTMLDivElement>(null);
  // Cập nhật ?to= và ?q= trong MỘT lần gọi - hai lần setSearchParams liên tiếp
  // sẽ ghi đè lẫn nhau.
  const updateParams = useCallback((changes: { to?: string | null; q?: string | null }) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const setQuery = useCallback((value: string) => updateParams({ q: value }), [updateParams]);

  const directory = useNeighborhoods();
  const neighborhoods = directory.data?.items ?? EMPTY_NEIGHBORHOODS;
  const statsQuery = useNeighborhoodStats();
  const statsById = useMemo(
    () => new Map((statsQuery.data?.items ?? []).map(item => [item.neighborhoodId, item])),
    [statsQuery.data],
  );

  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    if (!search) return neighborhoods;
    return neighborhoods.filter(item => normalize([
      item.name, item.code, item.address, item.leaderName, ...item.streets, ...item.alleyDescriptions,
    ].filter(Boolean).join(" ")).includes(search));
  }, [neighborhoods, query]);

  const selected = neighborhoods.find(item => item._id === selectedId) ?? null;
  const overview = useNeighborhoodOverview(selected?._id ?? null);
  const mappedCount = useMemo(() => neighborhoods.filter(item => neighborhoodGeometry(item)).length, [neighborhoods]);

  // Chọn (hoặc bỏ chọn) một tổ luôn xóa từ khóa để khung hiện chi tiết.
  const setSelection = useCallback((id: string | null) => {
    updateParams({ to: id, q: null });
    // Khung thong tin luon cuon ve dau; tren dien thoai (ban do o tren) cuon toi khung.
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      panel.scrollTop = 0;
      if (id && window.matchMedia("(max-width: 900px)").matches) {
        (panel.parentElement ?? panel).scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, [updateParams]);

  const totals = statsQuery.data?.totals;
  const wardTiles: Tile[] = [
    { label: "Tổ dân phố", value: formatCount(totals?.neighborhoods ?? (directory.data ? neighborhoods.length : undefined)), tone: "primary" },
    { label: "Số hộ", value: formatCount(totals?.households), unit: "hộ", tone: "primary" },
    { label: "Nhân khẩu", value: formatCount(totals?.citizens), unit: "người", tone: "primary" },
    { label: "Hộ kinh doanh", value: formatCount(totals?.householdBusinesses), unit: "cơ sở" },
    { label: "Doanh nghiệp", value: formatCount(totals?.companies), unit: "đơn vị" },
  ];

  const mapFallback = (
    <div className={styles.mapFallback} role="status">
      Không tải được bản đồ. Bạn vẫn có thể chọn Tổ dân phố trong khung thông tin.
    </div>
  );
  const stats = overview.data?.stats ?? (selected ? statsById.get(selected._id) : undefined);
  const chartNodes = overview.data?.orgChart.nodes ?? [];
  const hasChartHolders = chartNodes.some(node => node.kind === "POSITION");
  // Dang go tim kiem -> hien danh sach ket qua thay cho chi tiet.
  const showDetail = !!selected && !query.trim();

  const list = (
    <div className={styles.panelSection}>
      {directory.isLoading && <LoadingSpinner />}
      {directory.isError && !directory.data && <ErrorState message="Không thể tải danh sách Tổ dân phố." />}
      {directory.data && (
        <p className={styles.meta} role="status">
          {query ? `Tìm thấy ${filtered.length} tổ dân phố` : `${neighborhoods.length} tổ dân phố · nhấp vào vùng trên bản đồ hoặc chọn trong danh sách`}
        </p>
      )}
      {directory.data && !filtered.length && (
        <div className={styles.emptyBlock}>
          <EmptyState message={neighborhoods.length ? "Không tìm thấy Tổ dân phố phù hợp." : "Chưa có Tổ dân phố nào được công bố."} />
          {query && (
            <p className={styles.meta}>
              Thử tên đường hoặc số tổ khác
              {wardPhone ? <>, hoặc gọi tổng đài phường: <a href={telHref(wardPhone)}>{wardPhone}</a>.</> : "."}
            </p>
          )}
        </div>
      )}
      <ul className={styles.list} aria-label="Danh sách Tổ dân phố">
        {filtered.map(item => {
          const itemStats = statsById.get(item._id);
          const active = item._id === selected?._id;
          const phone = item.contactPhone.trim();
          const area = [...item.streets, ...item.alleyDescriptions].map(part => part.trim()).filter(Boolean).join(", ");
          // Thẻ là <li>: nút chọn trải phủ cả thẻ (::after); nút gọi nằm trên lớp đó
          // nên vẫn bấm riêng được (link không lồng trong <button>).
          return (
            <li key={item._id} className={cn(styles.option, active && styles.optionActive)}>
              <span className={styles.optionTop}>
                <span className={styles.optionMain}>
                  <button type="button" className={styles.optionSelect} aria-pressed={active} onClick={() => setSelection(item._id)}>
                    <strong className={styles.optionName}>{item.name}</strong>
                  </button>
                  <span className={styles.optionLeader}>Tổ trưởng: {item.leaderName || "Chưa cập nhật"}</span>
                  {area && <span className={styles.optionArea}>Khu vực: {area}</span>}
                </span>
                <span className={styles.optionStats}>
                  <span><b>{formatCount(itemStats?.households)}</b> hộ</span>
                  <span><b>{formatCount(itemStats?.citizens)}</b> người</span>
                </span>
              </span>
              <span className={styles.optionContact}>
                {phone
                  ? <a className={styles.optionCall} href={telHref(phone)} aria-label={`Gọi ${item.name}: ${phone}`}>Gọi tổ: {phone}</a>
                  : <span className={styles.meta}>Chưa công bố số liên hệ</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const detail = selected && (
    <div className={styles.panelSection}>
      <button type="button" className={styles.backButton} onClick={() => setSelection(null)}>← Tất cả Tổ dân phố</button>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>{selected.name}</h2>
        <p className={styles.detailLeader}>Tổ trưởng: <strong>{selected.leaderName || "Chưa cập nhật"}</strong></p>
        <NeighborhoodHeadquarters neighborhood={selected} />
        {(selected.streets.length > 0 || selected.alleyDescriptions.length > 0) && (
          <p className={styles.detailText}><strong>Địa bàn: </strong>{[...selected.streets, ...selected.alleyDescriptions].join(", ")}</p>
        )}
        {selected.description && <p className={styles.detailText}>{selected.description}</p>}
        {selected.contactPhone.trim()
          ? <a className={styles.callButton} href={telHref(selected.contactPhone)}>Gọi số liên hệ của tổ: {selected.contactPhone}</a>
          : <span className={styles.meta}>Chưa công bố số liên hệ của tổ</span>}
      </header>

      <section aria-labelledby="neighborhood-stats-title" className={styles.block}>
        <h3 id="neighborhood-stats-title" className={styles.blockTitle}>Số liệu tổng hợp</h3>
        <StatTiles tiles={neighborhoodTiles(stats)} compact />
      </section>

      <section aria-labelledby="neighborhood-org-title" className={styles.block}>
        <h3 id="neighborhood-org-title" className={styles.blockTitle}>Bộ máy tổ chức & cán bộ phụ trách</h3>
        {overview.isLoading && <LoadingSpinner />}
        {overview.isError && (
          <p className={styles.meta}>Chưa tải được bộ máy của tổ. <button type="button" className={styles.inlineButton} onClick={() => void overview.refetch()}>Thử lại</button></p>
        )}
        {overview.data && (hasChartHolders ? (
          <NeighborhoodOrgChart nodes={chartNodes} />
        ) : (
          <div className={styles.chartEmpty}>
            <p><strong>Tổ trưởng:</strong> {selected.leaderName || "Chưa cập nhật"}</p>
            <p className={styles.meta}>Sơ đồ bộ máy của tổ chưa được cập nhật.</p>
          </div>
        ))}
      </section>
    </div>
  );

  return (
    <div className={cn("wrap", styles.page)}>
      <PageHeader
        title="Thông tin Tổ dân phố"
        crumb="Thông tin Tổ dân phố"
        description={<>Số liệu tổng hợp và bộ máy tổ chức của từng Tổ dân phố tại {ward}. Tìm tổ của bạn theo tên tổ, đường hoặc ngõ, hoặc nhấp vào vùng tổ trên bản đồ. Số điện thoại là số liên hệ chính thức của tổ do phường công bố – không hiển thị số điện thoại cá nhân của tổ trưởng.</>}
      />

      <section className={styles.summary} aria-labelledby="ward-summary-title">
        <h2 id="ward-summary-title" className={styles.summaryTitle}>Tổng quan {ward}</h2>
        {statsQuery.isError
          ? <p className={styles.meta}>Chưa tải được số liệu tổng hợp. <button type="button" className={styles.inlineButton} onClick={() => void statsQuery.refetch()}>Thử lại</button></p>
          : <StatTiles tiles={wardTiles} />}
      </section>

      <div className={styles.explorer}>
        <div className={styles.mapFrame}>
          {mappedCount > 0 ? (
            <MapErrorBoundary fallback={mapFallback}>
              <Suspense fallback={<LoadingSpinner />}>
                <NeighborhoodBoundaryMap
                  neighborhoods={neighborhoods}
                  selectedId={selected?._id ?? null}
                  onSelect={setSelection}
                  pois={NO_POIS}
                  selectedPoiId={null}
                  onSelectPoi={noop}
                  fallback={mapFallback}
                />
              </Suspense>
            </MapErrorBoundary>
          ) : directory.data ? (
            <div className={styles.mapFallback} role="status">Ranh giới các Tổ dân phố chưa được công bố trên bản đồ.</div>
          ) : null}
        </div>

        <aside className={styles.panel} aria-label="Thông tin Tổ dân phố" aria-live="polite">
          <div className={styles.panelSearch}>
            <label className={styles.searchLabel} htmlFor="neighborhood-info-search">Tìm Tổ dân phố</label>
            <input
              id="neighborhood-info-search"
              type="search"
              className={styles.search}
              placeholder="Tên tổ, tổ trưởng, tuyến đường…"
              value={query}
              onChange={event => setQuery(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div ref={panelRef} className={styles.panelBody}>
            {showDetail ? detail : list}
          </div>
        </aside>
      </div>

      <p className={styles.meta}>
        Số liệu do đơn vị quản lý cập nhật, chỉ gồm con số tổng hợp và có thể chênh lệch so với thực tế trong thời gian ngắn.
      </p>
    </div>
  );
}
