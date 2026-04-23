import { redirect } from "next/navigation";
import { getAppState } from "@/lib/data";
import { HistoryView } from "@/components/history-view";

export default async function HistoryPage() {
  const state = await getAppState();
  if (!state) redirect("/login");
  return <HistoryView state={state} />;
}
