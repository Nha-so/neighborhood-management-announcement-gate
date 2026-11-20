import { apiRequest } from "@/services/api/client";
import type {
  PublicNeighborhoodOverview,
  PublicNeighborhoodsData,
  PublicNeighborhoodStatsData,
} from "@/types/neighborhood";

export function getPublicNeighborhoods(
  params: { q?: string; wardCode?: string } = {},
): Promise<PublicNeighborhoodsData> {
  return apiRequest<PublicNeighborhoodsData>("/neighborhoods/public", {
    query: { q: params.q, wardCode: params.wardCode },
  });
}

export function getPublicNeighborhoodStats(
  params: { wardCode?: string } = {},
): Promise<PublicNeighborhoodStatsData> {
  return apiRequest<PublicNeighborhoodStatsData>("/neighborhoods/public/stats", {
    query: { wardCode: params.wardCode },
  });
}

export function getPublicNeighborhoodOverview(id: string): Promise<PublicNeighborhoodOverview> {
  return apiRequest<PublicNeighborhoodOverview>(`/neighborhoods/public/${encodeURIComponent(id)}`);
}
