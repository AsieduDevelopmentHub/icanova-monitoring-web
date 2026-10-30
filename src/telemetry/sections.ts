export const GENERATOR_SECTIONS = [
  {
    id: "engine",
    label: "Engine",
    labels: [
      "Engine RPM",
      "Oil pressure",
      "Coolant temperature",
      "Oil temperature",
      "Fuel level",
      "Charge alternator voltage",
      "Battery voltage",
      "Engine status",
      "Engine State (alt)",
      "Oil level",
      "Coolant level",
    ],
  },
  {
    id: "electrical",
    label: "Electrical",
    labels: [
      "Frequency",
      "Line 1 voltage",
      "Line 2 voltage",
      "Line 3 voltage",
      "Line 1-2 voltage",
      "Line 2-3 voltage",
      "Line 3-1 voltage",
      "Line 1 current",
      "Line 2 current",
      "Line 3 current",
      "Line 1 power",
      "Line 2 power",
      "Line 3 power",
      "Total real power",
      "Generator Phase A Apparent Power",
      "Generator Phase B Apparent Power",
      "Generator Phase C Apparent Power",
      "Total apparent power",
      "Generator Phase A Reactive Power",
      "Generator Phase B Reactive Power",
      "Generator Phase C Reactive Power",
      "Total reactive power",
      "Generator Phase A Power Factor",
      "Generator Phase B Power Factor",
      "Generator Phase C Power Factor",
      "Power factor",
      "Load percent",
    ],
  },
  {
    id: "mains",
    label: "Mains",
    labels: [
      "Mains frequency",
      "Mains L1 voltage",
      "Mains L2 voltage",
      "Mains L3 voltage",
      "Mains L1-L2 voltage",
      "Mains L2-L3 voltage",
      "Mains L3-L1 voltage",
      "Energy export",
    ],
  },
  { id: "trends", label: "Trends", labels: [] },
  { id: "alarms", label: "Alarms", labels: [] },
  { id: "communications", label: "Communications", labels: [] },
  {
    id: "maintenance",
    label: "Maintenance",
    labels: ["Engine hours", "Engine starts"],
  },
] as const;

export type SectionId = (typeof GENERATOR_SECTIONS)[number]["id"];

export function sectionById(id: string | undefined): (typeof GENERATOR_SECTIONS)[number] | null {
  return GENERATOR_SECTIONS.find((section) => section.id === id) ?? null;
}

export const SELECTABLE_METRICS = GENERATOR_SECTIONS.flatMap((section) =>
  section.labels.map((label) => ({ section: section.label, label })),
);
