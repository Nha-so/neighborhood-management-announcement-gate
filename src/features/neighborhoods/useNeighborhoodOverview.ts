import { useQuery } from "@tanstack/react-query";
import { WARD_CODE } from "@/constants/env";
import { queryKeys } from "@/constants/queryKeys";
import {
  getPublicNeighborhoodOverview,
  getPublicNeighborhoodStats,
} from "@/services/api/neighborhoods";

// So lieu tong hop cua moi To + tong toan phuong (backend cache 5 phut).
export function useNeighborhoodStats() {
  return useQuery({
    queryKey: queryKeys.neighborhoodStats({ wardCode: WARD_CODE ?? "" }),
    queryFn: () => getPublicNeighborhoodStats({ wardCode: WARD_CODE }),
    staleTime: 5 * 60_000,
  });
}

// So lieu + so do bo may cua mot To.
export function useNeighborhoodOverview(id: string | null) {
  return useQuery({
    queryKey: queryKeys.neighborhoodOverview(id ?? ""),
    queryFn: () => getPublicNeighborhoodOverview(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
