import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingSpinner } from "@/components/common/StatusStates";
import { useNeighborhoodStats } from "@/features/neighborhoods/useNeighborhoodOverview";
import { useNeighborhoods } from "@/features/neighborhoods/useNeighborhoods";
import { useSiteIdentity } from "@/hooks/useSiteIdentity";
import type { PublicNeighborhood, PublicNeighborhoodStats } from "@/types/neighborhood";
import { cn } from "@/utils/cn";
import { telHref } from "@/utils/formatPhone";
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

const countFormat = new Intl.NumberFormat("vi-VN");

/**
 * The tổ card holds ALL public information about the tổ (nothing about it is
 * rendered outside the card). The whole card is clickable through the
 * select button's stretched ::after; the call/directions links sit above that
 * layer so they stay independently clickable (links can't nest in a button).
 */
function NeighborhoodListCard({ item, stats, selected, onSelect }: {
  item: PublicNeighborhood;
  stats?: PublicNeighborhoodStats;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const phone = item.contactPhone.trim();
  const address = item.address?.trim();
  const area = [...item.streets, ...item.alleyDescriptions].map(part => part.trim()).filter(Boolean).join(", ");
  const description = item.description.trim();
  const hqQuery = [address, item.wardName, "Việt Nam"].filter(Boolean).join(", ");
  return (
    <li className={cn(styles.nbCard, selected && styles.selected)} data-card-id={item._id}>
      <button type="button" className={styles.nbSelect} aria-pressed={selected} onClick={() => onSelect(item._id)}>
        <strong>{item.name}</strong>
      </button>
      <span>Tổ trưởng: {item.leaderName || "Chưa cập nhật"}</span>
      <span>Trụ sở: {address || "Chưa cập nhật"}</span>
      {area && <span className={cn(styles.nbArea, !selected && styles.nbClamp)}>Địa bàn: {area}</span>}
      {stats && (
        <span className={styles.nbStats}>
          <b>{countFormat.format(stats.households)}</b> hộ · <b>{countFormat.format(stats.citizens)}</b> nhân khẩu
          {(stats.householdBusinesses > 0 || stats.companies > 0) && <> · <b>{countFormat.format(stats.householdBusinesses + stats.companies)}</b> cơ sở kinh doanh</>}
        </span>
      )}
      {selected && description && <span className={styles.nbDescription}>{description}</span>}
      <span className={styles.boundaryStatus}>{neighborhoodGeometry(item) ? "Ranh giới đã hiển thị trên bản đồ" : "Chưa công bố ranh giới"}</span>
      <span className={styles.nbActions}>
        {phone
          ? <a className={styles.callLink} href={telHref(phone)} aria-label={`Gọi ${item.name}: ${phone}`}>Gọi tổ: {phone}</a>
          : <span className={styles.noPhone}>Chưa công bố số liên hệ</span>}
        {address && (
          <a className={styles.callLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hqQuery)}`} target="_blank" rel="noopener noreferrer" aria-label={`Chỉ đường đến trụ sở ${item.name}`}>Chỉ đường đến trụ sở →</a>
        )}
      </span>
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
  const renderPoiItem = (point: PublicPoi) => <li key={point.id} className={styles.poiItem} data-card-id={point.id}>
    <button type="button" className={cn(styles.option, styles.poiOption, point.id === selectedPoiId && styles.selected)} aria-pressed={point.id === selectedPoiId} onClick={() => selectPoi(point.id)}>
      <PoiThumbnail point={point} />
      <span className={styles.poiInfo}>
        <strong className={styles.poiName}>{point.name}</strong>
        <span className={styles.poiAddress}>{point.address || "Chưa cập nhật địa chỉ"}</span>
        <span className={styles.poiCategoryLabel}>{categoryLabel(point.category)}</span>
      </span>
    </button>
    <a className={styles.poiDirections} href={googleMapsDirectionsUrl(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" aria-label={`Chỉ đường đến ${point.name} trên Google Maps`}>Chỉ đường trên Google Maps →</a>
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
          <h2 id="ban-do-title" className={styles.title}>Bản đồ, liên hệ Tổ dân phố & tiện ích</h2>
          <p className={styles.description}>Tra cứu, liên hệ Tổ dân phố và các địa điểm phục vụ đời sống tại {ward}. Số điện thoại hiển thị là số liên hệ chính thức của tổ, không phải số cá nhân.</p>
        </div>
        <Link to="/to-dan-pho" className={styles.more}>Xem danh bạ đầy đủ →</Link>
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
        {selectedPoi ? <>
          <h3 className={styles.poiHeading}><span className={styles.poiBadge} style={poiColorStyle(selectedPoi.category)}><PoiCategoryIcon category={selectedPoi.category} /></span>{selectedPoi.name}</h3>
          <p>{selectedPoi.address || "Chưa cập nhật địa chỉ"}</p>
          <p className={styles.meta}>Địa điểm đã được xác minh trong danh mục tiện ích.</p>
          <a className={styles.more} href={googleMapsDirectionsUrl(selectedPoi.lat, selectedPoi.lng)} target="_blank" rel="noopener noreferrer">Chỉ đường đến địa điểm →</a>
        </> : <p>Chọn một Tổ dân phố hoặc địa điểm trong danh sách hay trên bản đồ để xem chi tiết và chỉ đường.</p>}
      </div>}
    </section>
  );
}
