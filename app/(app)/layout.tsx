import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAppState, getUser } from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const state = await getAppState();
  if (!state) redirect("/login");

  return (
    <AppShell email={user.email ?? ""} state={state}>
      {children}
    </AppShell>
  );
}
