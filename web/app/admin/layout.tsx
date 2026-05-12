"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isValid, loadTokens, signOut } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = loadTokens();
    if (!isValid(t) && !pathname.startsWith("/admin/login")) {
      router.replace("/admin/login/");
    } else {
      setReady(true);
    }
  }, [pathname, router]);

  if (!ready) return null;

  return (
    <>
      <header className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <Link href="/admin/" className="font-semibold">
          Admin · Turismo Local
        </Link>
        {!pathname.startsWith("/admin/login") && (
          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace("/admin/login/");
            }}
            className="text-sm text-neutral-600 hover:underline"
          >
            Sair
          </button>
        )}
      </header>
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">{children}</main>
    </>
  );
}
