import { Navigate, useLocation } from "react-router-dom";

// The old directory (/to-dan-pho) was merged into "Thông tin Tổ dân phố".
// Keep old links and bookmarks working, including the ?q= search.
export function LegacyNeighborhoodsRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/thong-tin-to-dan-pho${search}`} replace />;
}
