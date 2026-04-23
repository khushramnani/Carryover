import { redirect } from "next/navigation";
import { getAppState } from "@/lib/data";
import { BankView } from "@/components/bank-view";

export default async function BankPage() {
  const state = await getAppState();
  if (!state) redirect("/login");
  return <BankView state={state} />;
}
