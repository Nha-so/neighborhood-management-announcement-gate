import type { CSSProperties } from "react";
import type { OrgUnitType, PublicOrgChartNode } from "@/types/neighborhood";
import { resolveAssetUrl } from "@/utils/resolveAssetUrl";
import styles from "./NeighborhoodOrgChart.module.css";

// Mau nhan dien theo loai to chuc - chi de de phan biet, khong mang nghia nghiep vu.
const UNIT_COLORS: Record<OrgUnitType, string> = {
  party: "#b3261e",
  management: "#0d4b91",
  front: "#9a5b00",
  veterans: "#3f6b2a",
  women: "#a3236f",
  youth: "#1565c0",
  elderly: "#6d4c9f",
  red_cross: "#c62828",
  security: "#24506b",
  other: "#4a5866",
};

type Group = { key: string; title: string | null; unitType?: OrgUnitType; positions: PublicOrgChartNode[] };
type Section = { key: string; title: string; groups: Group[] };

function byOrder(a: PublicOrgChartNode, b: PublicOrgChartNode) {
  return a.sortOrder - b.sortOrder;
}

/**
 * Chuyen cay so do thanh: khoi (SECTION) -> nhom (UNIT, hoac nhom "truc tiep"
 * cho cac chuc danh khong thuoc to chuc nao) -> danh sach chuc danh theo thu tu
 * tren cay (cha truoc con).
 */
function buildSections(nodes: PublicOrgChartNode[]): Section[] {
  const children = new Map<string | null, PublicOrgChartNode[]>();
  const keys = new Set(nodes.map(n => n.key));
  for (const node of nodes) {
    const parent = node.parentKey && keys.has(node.parentKey) ? node.parentKey : null;
    const list = children.get(parent) ?? [];
    list.push(node);
    children.set(parent, list);
  }
  children.forEach(list => list.sort(byOrder));

  const collect = (parentKey: string, direct: Group, groups: Group[]) => {
    for (const child of children.get(parentKey) ?? []) {
      if (child.kind === "UNIT") {
        const group: Group = { key: child.key, title: child.title, unitType: child.unitType, positions: [] };
        groups.push(group);
        collect(child.key, group, groups);
      } else {
        if (child.kind === "POSITION") direct.positions.push(child);
        collect(child.key, direct, groups);
      }
    }
  };

  const sections: Section[] = [];
  const loose: Group = { key: "__root", title: null, positions: [] };
  const looseGroups: Group[] = [];
  for (const root of children.get(null) ?? []) {
    if (root.kind === "SECTION") {
      const direct: Group = { key: `${root.key}__direct`, title: null, positions: [] };
      const groups: Group[] = [];
      collect(root.key, direct, groups);
      sections.push({ key: root.key, title: root.title, groups: [direct, ...groups].filter(g => g.positions.length) });
    } else if (root.kind === "UNIT") {
      const group: Group = { key: root.key, title: root.title, unitType: root.unitType, positions: [] };
      looseGroups.push(group);
      collect(root.key, group, looseGroups);
    } else {
      loose.positions.push(root);
      collect(root.key, loose, looseGroups);
    }
  }
  const extra = [loose, ...looseGroups].filter(g => g.positions.length);
  if (extra.length) sections.push({ key: "__loose", title: "Bộ máy Tổ dân phố", groups: extra });
  return sections;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map(p => p[0]).join("").toUpperCase();
}

function PositionCard({ node, color }: { node: PublicOrgChartNode; color: string }) {
  const photo = resolveAssetUrl(node.holderPhotoUrl);
  const name = node.holderName;
  return (
    <li className={styles.position} style={{ "--unit-color": color } as CSSProperties}>
      {photo ? (
        <img className={styles.avatar} src={photo} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className={styles.avatar} aria-hidden="true">{name ? initials(name) : "?"}</span>
      )}
      <span className={styles.positionText}>
        <span className={styles.role}>{node.title}</span>
        <span className={name ? styles.holder : styles.vacant}>{name ?? "Chưa cập nhật"}</span>
      </span>
    </li>
  );
}

export function NeighborhoodOrgChart({ nodes }: { nodes: PublicOrgChartNode[] }) {
  const sections = buildSections(nodes);
  if (!sections.length) return null;
  return (
    <div className={styles.chart}>
      {sections.map(section => (
        <section key={section.key} className={styles.section} aria-label={section.title}>
          <h4 className={styles.sectionTitle}>{section.title}</h4>
          {section.groups.map(group => {
            const color = UNIT_COLORS[group.unitType ?? group.positions[0]?.unitType ?? "other"];
            return (
              <div key={group.key} className={group.title ? styles.unit : styles.directGroup} style={{ "--unit-color": color } as CSSProperties}>
                {group.title && <h5 className={styles.unitTitle}>{group.title}</h5>}
                <ul className={styles.positions}>
                  {group.positions.map(node => (
                    <PositionCard key={node.key} node={node} color={UNIT_COLORS[node.unitType ?? group.unitType ?? "other"]} />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
