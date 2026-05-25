import Link from "next/link";
import { t } from "@/lib/translations";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-semibold text-foreground">
            {t.common.platform}
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/auth/student/login"
              className="text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground"
            >
              {t.common.signIn}
            </Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">{children}</main>
      
      <footer className="border-t border-border bg-surface-raised py-6">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-sm text-foreground-muted">
            © {new Date().getFullYear()} {t.common.platform}. {t.common.allRightsReserved}
          </p>
        </div>
      </footer>
    </div>
  );
}
