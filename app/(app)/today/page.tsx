import { redirect } from "next/navigation";
import { getAppState } from "@/lib/data";
import { TodayView } from "@/components/today-view";

export default async function TodayPage() {
  const state = await getAppState();
  if (!state) redirect("/login");
  return <TodayView state={state} />;
}
