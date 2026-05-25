import { redirectAuthenticatedUserFromPublicArea } from "@/lib/auth/guards";

export default async function AuthPublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await redirectAuthenticatedUserFromPublicArea();

  return <>{children}</>;
}
