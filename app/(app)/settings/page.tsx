import { redirect } from "next/navigation";
import { getAppState } from "@/lib/data";
import { SettingsView } from "@/components/settings-view";

export default async function SettingsPage() {
  const state = await getAppState();
  if (!state) redirect("/login");
  return <SettingsView state={state} />;
}
