export type PublicNeighborhood = {
  _id: string;
  name: string;
  code: string;
  wardName: string | null;
  address: string;
  description: string;
  // So lien he CHINH THUC cua to (khong phai so ca nhan cua to truong).
  contactPhone: string;
  leaderName: string;
  streets: string[];
  alleyDescriptions: string[];
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown[];
  } | null;
};

export type PublicNeighborhoodsData = {
  items: PublicNeighborhood[];
};

// So lieu tong hop cong khai cua mot To (chi con so, khong co du lieu ca nhan).
export type PublicNeighborhoodStats = {
  neighborhoodId: string;
  households: number;
  citizens: number;
  householdBusinesses: number;
  companies: number;
  // m2 - null khi chua khai bao.
  area: number | null;
  // nguoi/km2 - null khi chua co dien tich.
  density: number | null;
};

export type PublicNeighborhoodStatsData = {
  totals: Omit<PublicNeighborhoodStats, "neighborhoodId" | "density"> & { neighborhoods: number };
  items: PublicNeighborhoodStats[];
  generatedAt: string;
};

export type OrgUnitType =
  | "party" | "management" | "front" | "veterans" | "women"
  | "youth" | "elderly" | "red_cross" | "security" | "other";

export type PublicOrgChartNode = {
  key: string;
  parentKey: string | null;
  kind: "SECTION" | "UNIT" | "POSITION";
  title: string;
  unitType?: OrgUnitType;
  sortOrder: number;
  holderName: string | null;
  holderPhotoUrl: string | null;
};

export type PublicNeighborhoodOverview = {
  stats: PublicNeighborhoodStats;
  orgChart: { nodes: PublicOrgChartNode[]; updatedAt: string | null };
};
