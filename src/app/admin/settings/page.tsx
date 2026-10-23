import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { CONFIG_KEYS } from "@/lib/config-defaults";
import { ConfigEditor } from "../client";

export const metadata = { title: "Settings · Admin" };

export default async function SettingsPage() {
  await requireAdmin();
  const config = await getConfig();
  const entries: [string, string, unknown][] = [
    ["Ranking weights", CONFIG_KEYS.ranking, config.ranking],
    ["Match labels", CONFIG_KEYS.matchLabels, config.matchLabels],
    ["Limits", CONFIG_KEYS.limits, config.limits],
    ["Field visibility (free / registered / paid)", CONFIG_KEYS.fieldVisibility, config.fieldVisibility],
    ["Search filters", CONFIG_KEYS.filters, config.filters],
  ];
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-semibold">Settings</h1>
      <p className="text-sm text-muted">Search and display settings. Changes apply within 30 seconds, no redeploy needed.</p>
      {entries.map(([label, key, value]) => <ConfigEditor key={key} label={label} configKey={key} initial={value} />)}
    </div>
  );
}
