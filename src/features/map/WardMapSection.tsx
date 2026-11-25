import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingSpinner } from "@/components/common/StatusStates";
import { useNeighborhoodStats } from "@/features/neighborhoods/useNeighborhoodOverview";
import { useNeighborhoods } from "@/features/neighborhoods/useNeighborhoods";
import { useSiteIdentity } from "@/hooks/useSiteIdentity";
import type { PublicNeighborhood, PublicNeighborhoodStats } from "@/types/neighborhood";
import { cn } from "@/utils/cn";
import { googleMapsDirectionsUrl } from "@/utils/googleMaps";
import { resolveAssetUrl } from "@/utils/resolveAssetUrl";
import { neighborhoodGeometry } from "./neighborhoodGeometry";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { usePublicPois, type PublicPoi } from "./usePublicPois";
import { PoiCategoryIcon } from "./PoiCategoryIcon";
import { poiColorStyle } from "./poiAppearance";
import styles from "./WardMapSection.module.css";

const NeighborhoodBoundaryMap = lazy(() => import("./NeighborhoodBoundaryMap"));
const EMPTY_NEIGHBORHOODS: NonNullable<ReturnType<typeof useNeighborhoods>["data"]>["items"] = [];
const EMPTY_POIS: PublicPoi[] = [];
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

function PoiThumbnail({ point }: { point: PublicPoi }) {
  const src = resolveAssetUrl(point.imageUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasImage = Boolean(src && failedSrc !== src);
  return <span className={cn(styles.poiMedia, !hasImage && styles.poiMediaFallback)} style={poiColorStyle(point.category)} aria-hidden="true">
    {hasImage
      ? <img className={styles.poiMediaImage} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(src!)} />
      : <PoiCategoryIcon category={point.category} />}
  </span>;
}

// Larger profile image for the selected POI; falls back to the category icon
// (same as the list card) when there is no image or it fails to load.
function PoiDetailImage({ point }: { point: PublicPoi }) {
  const src = resolveAssetUrl(point.imageUrl);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className={styles.poiDetailImage} src={src} alt={point.name} decoding="async" onError={() => setFailed(true)} />;
  }
  return <span className={cn(styles.poiDetailImage, styles.poiMediaFallback)} style={poiColorStyle(point.category)} aria-hidden="true"><PoiCategoryIcon category={point.category} /></span>;
}

const countFormat = new Intl.NumberFormat("vi-VN");

/**
 * Compact tổ card for the home map: only the key facts. The full profile
 * (area, description, phone, org chart, statistics…) lives on the
 * "Thông tin Tổ dân phố" page, which the highlighted button opens with this
 * tổ selected. The whole card selects the tổ on the map through the select
 * button's stretched ::after; the info button sits above that layer.
 */
function NeighborhoodListCard({ item, stats, selected, onSelect }: {
  item: PublicNeighborhood;
  stats?: PublicNeighborhoodStats;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li className={cn(styles.nbCard, selected && styles.selected)} data-card-id={item._id}>
      <button type="button" className={styles.nbSelect} aria-pressed={selected} onClick={() => onSelect(item._id)}>
        <strong>{item.name}</strong>
      </button>
      <span>Tổ trưởng: {item.leaderName || "Chưa cập nhật"}</span>
      {stats && (
        <span className={styles.nbStats}>
          <b>{countFormat.format(stats.households)}</b> hộ · <b>{countFormat.format(stats.citizens)}</b> nhân khẩu
        </span>
      )}
      <Link
        className={styles.nbInfoButton}
        to={`/thong-tin-to-dan-pho?to=${encodeURIComponent(item._id)}`}
        aria-label={`Xem thông tin đầy đủ của ${item.name}`}
      >
        Xem thông tin tổ →
      </Link>
    </li>
  );
}

export function WardMapSection({ className }: { className?: string }) {
  const { ward, city } = useSiteIdentity();
  const { data, isLoading, isError, refetch } = useNeighborhoods();
  const neighborhoods = data?.items ?? EMPTY_NEIGHBORHOODS;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const typeQuery = usePublicPois([]);
  const showPois = selectedTypes.length > 0;
  const searchText = normalize(query.trim());
  // Typing in Tổ dân phố mode also searches POIs of EVERY type, without
  // picking a category first. One request for all types (cached); the text
  // filter runs locally so typing doesn't trigger more requests.
  const searchAllPois = !showPois && searchText.length > 0;
  const allTypeKeys = useMemo(() => (typeQuery.data?.categories ?? []).map(type => type.key), [typeQuery.data]);
  const poiQuery = usePublicPois(showPois ? selectedTypes : searchAllPois ? allTypeKeys : []);
  const pois = showPois || searchAllPois ? poiQuery.data?.items ?? EMPTY_POIS : EMPTY_POIS;
  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    return neighborhoods.filter(item => normalize([
      item.name, item.code, item.address, item.wardName, ...item.streets, ...item.alleyDescriptions,
    ].filter(Boolean).join(" ")).includes(search));
  }, [neighborhoods, query]);
  const categoryLabel = useCallback((key: string) => typeQuery.data?.categories.find(type => type.key === key)?.label ?? "", [typeQuery.data]);
  const filteredPois = useMemo(() => pois.filter(point => normalize(`${point.name} ${point.address} ${searchAllPois ? categoryLabel(point.category) : ""}`).includes(searchText)), [pois, searchText, searchAllPois, categoryLabel]);
  const mappedCount = useMemo(() => neighborhoods.filter(item => neighborhoodGeometry(item)).length, [neighborhoods]);
  const selected = neighborhoods.find(item => item._id === selectedId);
  const selectedPoi = filteredPois.find(point => point.id === selectedPoiId);
  const wardQuery = encodeURIComponent(`${ward}, ${city}, Việt Nam`);
  const statsQuery = useNeighborhoodStats();
  const statsById = useMemo(() => new Map((statsQuery.data?.items ?? []).map(item => [item.neighborhoodId, item])), [statsQuery.data]);
  const resultsRef = useRef<HTMLDivElement>(null);
  // Selecting on the map brings the card into view inside the results panel
  // only (scrolling the panel itself, never the page).
  useEffect(() => {
    const panel = resultsRef.current;
    const key = selectedId ?? selectedPoiId;
    if (!panel || !key) return;
    const card = panel.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(key)}"]`);
    if (!card) return;
    const top = card.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
    if (top < panel.scrollTop || top + card.offsetHeight > panel.scrollTop + panel.clientHeight) {
      panel.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
    }
  }, [selectedId, selectedPoiId]);
  const selectNeighborhood = useCallback((id: string) => { setSelectedId(id); setSelectedPoiId(null); }, []);
  const selectPoi = useCallback((id: string) => { setSelectedPoiId(id); setSelectedId(null); }, []);
  const toggleType = (key: string) => {
    setSelectedTypes(current => current.includes(key) ? current.filter(type => type !== key) : [...current, key]);
    setQuery("");
    setSelectedPoiId(null);
  };
  // The <li> is the card; the name button stretches over it (::after) so the
  // whole card selects the POI, while the directions button sits above that
  // layer in normal flow (a link can't be nested inside a <button>).
  const renderPoiItem = (point: PublicPoi) => <li key={point.id} className={cn(styles.poiItem, styles.poiCard, point.id === selectedPoiId && styles.selected)} data-card-id={point.id} style={poiColorStyle(point.category)}>
    <PoiThumbnail point={point} />
    <div className={styles.poiInfo}>
      <span className={styles.poiCategoryLabel}>{categoryLabel(point.category)}</span>
      <button type="button" className={cn(styles.nbSelect, styles.poiName)} aria-pressed={point.id === selectedPoiId} onClick={() => selectPoi(point.id)}>
        <strong>{point.name}</strong>
      </button>
      <span className={styles.poiAddress}>{point.address || "Chưa cập nhật địa chỉ"}</span>
      <a className={cn(styles.mapsButton, styles.poiCardButton)} href={googleMapsDirectionsUrl(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" aria-label={`Chỉ đường đến ${point.name} trên Google Maps`}>Chỉ đường trên Google Maps →</a>
    </div>
  </li>;
  const fallback = <>
    <iframe className={styles.map} title={`Bản đồ tổng quan ${ward}`} src={`https://maps.google.com/maps?q=${wardQuery}&z=14&hl=vi&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
    <div className={styles.mapWarning} role="status">
      Bản đồ tổng quan phường. Nếu lớp ranh giới hoặc điểm tiện ích không tải được, bạn vẫn có thể tra cứu trong danh sách.
      <button className={styles.reloadMap} type="button" onClick={() => window.location.reload()}>Tải lại bản đồ</button>
    </div>
  </>;

  return (
    <section id="ban-do" className={cn(styles.card, className)} aria-labelledby="ban-do-title">
      <div className={styles.heading}>
        <div>
          <h2 id="ban-do-title" className={styles.title}>Bản đồ Tổ dân phố & địa điểm tiện ích</h2>
          <p className={styles.description}>Tìm Tổ dân phố, tuyến đường hoặc địa điểm tiện ích tại {ward} chỉ với một ô tìm kiếm, hoặc chọn loại địa điểm để hiện trên bản đồ. Mỗi thẻ có số liên hệ chính thức của tổ hoặc nút chỉ đường Google Maps.</p>
        </div>
        <Link to="/thong-tin-to-dan-pho" className={styles.more}>Xem thông tin Tổ dân phố →</Link>
      </div>
      <div>
        <div className={styles.categoryStrip} role="group" aria-label="Loại địa điểm trên bản đồ (có thể chọn nhiều loại)" tabIndex={0}>
          <button className={cn(styles.categoryChip, !showPois && styles.activeChip)} type="button" aria-pressed={!showPois} onClick={() => { setSelectedTypes([]); setQuery(""); setSelectedPoiId(null); }}><span className={styles.chipIcon} aria-hidden="true">📍</span><span className={styles.chipLabel}>Tổ dân phố</span></button>
          {typeQuery.data?.categories.map(type => <button key={type.key} type="button" style={poiColorStyle(type.key)} className={cn(styles.categoryChip, styles.poiCategoryChip, selectedTypes.includes(type.key) && styles.activeChip)} aria-pressed={selectedTypes.includes(type.key)} onClick={() => toggleType(type.key)}><span className={styles.chipIcon} aria-hidden="true"><PoiCategoryIcon category={type.key} /></span><span className={styles.chipLabel}>{type.label}</span></button>)}
        </div>
        {typeQuery.isLoading && <p className={styles.meta} role="status">Đang tải loại địa điểm…</p>}
        {typeQuery.isError && <p className={styles.meta} role="status">Chưa tải được loại địa điểm. <button className={styles.inlineButton} type="button" onClick={() => void typeQuery.refetch()}>Thử lại</button></p>}
      </div>
      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <label className={styles.searchLabel} htmlFor="map-neighborhood-search">{showPois ? "Tìm địa điểm trong loại đã chọn" : "Tìm Tổ dân phố, đường, ngõ hoặc địa điểm"}</label>
          <input id="map-neighborhood-search" type="search" className={styles.search} placeholder={showPois ? "Nhập tên hoặc địa chỉ địa điểm…" : "Tên tổ, tuyến đường, nhà thuốc, quán cà phê…"} value={query} onChange={event => { setQuery(event.target.value); setSelectedPoiId(null); }} />
          {(showPois ? poiQuery.isLoading : isLoading) && <LoadingSpinner />}
          {(showPois ? poiQuery.isError : isError) && <>
            <ErrorState message={showPois ? "Không thể tải địa điểm tiện ích." : "Không thể tải thông tin Tổ dân phố."} />
            <button type="button" className={styles.retry} onClick={() => void (showPois ? poiQuery.refetch() : refetch())}>Thử lại</button>
          </>}
          {showPois ? <>
            {poiQuery.data && <p className={styles.meta} role="status">{filteredPois.length} địa điểm đã xác minh{poiQuery.data.truncated ? " · Thu hẹp loại địa điểm để xem thêm kết quả" : ""}</p>}
            {poiQuery.data && !filteredPois.length && <EmptyState message={query ? "Không tìm thấy địa điểm phù hợp." : "Chưa có địa điểm đã xác minh thuộc loại đã chọn trong phường."} />}
            <div ref={resultsRef} className={styles.results}>
              <ul className={styles.list} aria-label="Địa điểm tiện ích">{filteredPois.map(renderPoiItem)}</ul>
            </div>
          </> : <>
            {data && <p className={styles.meta} role="status">
              {searchAllPois
                ? `${filtered.length} Tổ dân phố · ${poiQuery.data ? `${filteredPois.length} địa điểm` : "đang tìm địa điểm…"} phù hợp`
                : `${filtered.length} Tổ dân phố · ${mappedCount} tổ có ranh giới trên bản đồ`}
            </p>}
            {data && !filtered.length && (!searchAllPois || (poiQuery.data && !filteredPois.length)) && (
              <EmptyState message={!neighborhoods.length ? "Chưa có Tổ dân phố nào được công bố." : searchAllPois ? "Không tìm thấy Tổ dân phố hay địa điểm phù hợp." : "Không tìm thấy Tổ dân phố phù hợp."} />
            )}
            <div ref={resultsRef} className={styles.results}>
              {searchAllPois && filtered.length > 0 && <h3 className={styles.resultsHeading}>Tổ dân phố</h3>}
              <ul className={styles.list} aria-label="Danh sách Tổ dân phố">
                {filtered.map(item => (
                  <NeighborhoodListCard key={item._id} item={item} stats={statsById.get(item._id)} selected={item._id === selectedId} onSelect={selectNeighborhood} />
                ))}
              </ul>
              {searchAllPois && <>
                {poiQuery.isLoading && <LoadingSpinner />}
                {poiQuery.isError && <p className={styles.meta}>Chưa tìm được địa điểm tiện ích. <button type="button" className={styles.inlineButton} onClick={() => void poiQuery.refetch()}>Thử lại</button></p>}
                {filteredPois.length > 0 && <>
                  <h3 className={styles.resultsHeading}>Địa điểm tiện ích</h3>
                  <ul className={styles.list} aria-label="Địa điểm tiện ích phù hợp">{filteredPois.map(renderPoiItem)}</ul>
                </>}
              </>}
            </div>
          </>}
        </div>
        <div className={styles.frame}>
          {mappedCount > 0 || filteredPois.length > 0 ? <MapErrorBoundary fallback={fallback}><Suspense fallback={<LoadingSpinner />}>
            <NeighborhoodBoundaryMap neighborhoods={neighborhoods} selectedId={selectedId} onSelect={selectNeighborhood} pois={filteredPois} selectedPoiId={selectedPoiId} onSelectPoi={selectPoi} fallback={fallback} />
          </Suspense></MapErrorBoundary> : fallback}
        </div>
      </div>
      {/* Tổ details live only in the tổ card - this panel is for POIs and the initial hint. */}
      {!selected && <div className={styles.details} aria-live="polite">
        {selectedPoi ? <div className={styles.poiDetail} style={poiColorStyle(selectedPoi.category)}>
          <PoiDetailImage key={selectedPoi.id} point={selectedPoi} />
          <div className={styles.poiDetailInfo}>
            <h3 className={styles.poiHeading}><span className={styles.poiBadge} style={poiColorStyle(selectedPoi.category)}><PoiCategoryIcon category={selectedPoi.category} /></span>{selectedPoi.name}</h3>
            <p>{selectedPoi.address || "Chưa cập nhật địa chỉ"}</p>
            <p className={styles.meta}>{categoryLabel(selectedPoi.category)} · Địa điểm đã được xác minh trong danh mục tiện ích.</p>
            <a className={cn(styles.mapsButton, styles.mapsButtonLarge)} href={googleMapsDirectionsUrl(selectedPoi.lat, selectedPoi.lng)} target="_blank" rel="noopener noreferrer">Chỉ đường trên Google Maps →</a>
          </div>
        </div> :<p>Chọn một Tổ dân phố hoặc địa điểm trong danh sách hay trên bản đồ để xem chi tiết và chỉ đường.</p>}
      </div>}
    </section>
  );
}
