import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAppState } from "@/lib/data";
import { PlanView } from "@/components/plan-view";

export default async function PlanPage() {
  const state = await getAppState();
  if (!state) redirect("/login");
  return (
    <Suspense>
      <PlanView state={state} />
    </Suspense>
  );
}
