"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPackages, imageUrl } from "@/lib/api";
import type { Package } from "@/lib/config";

export default function HomePage() {
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPackages()
      .then((data) => setPackages(data.filter((p) => p.published)))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <>
      <header className="border-b border-neutral-200 px-6 py-5">
        <h1 className="text-2xl font-semibold">Turismo Local</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Descubra experiências e pacotes na nossa região
        </p>
      </header>

      <main className="flex-1 px-6 py-10 max-w-6xl mx-auto w-full">
        {error && <p className="text-red-600">Erro ao carregar pacotes: {error}</p>}
        {!packages && !error && <p className="text-neutral-500">Carregando…</p>}
        {packages && packages.length === 0 && (
          <p className="text-neutral-500">Nenhum pacote publicado ainda.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages?.map((p) => (
            <Link
              key={p.id}
              href={`/pacotes/?slug=${encodeURIComponent(p.slug)}`}
              className="group rounded-lg overflow-hidden border border-neutral-200 hover:shadow-md transition"
            >
              {p.heroImageKey && (
                <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                  <img
                    src={imageUrl(p.heroImageKey)}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-semibold text-lg">{p.title}</h2>
                <p className="text-sm text-neutral-600 mt-1">{p.headline}</p>
                <p className="text-sm mt-3">
                  <span className="font-medium">R$ {p.priceBRL.toLocaleString("pt-BR")}</span>
                  <span className="text-neutral-500"> · {p.durationDays} dia(s)</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-neutral-200 px-6 py-4 text-xs text-neutral-500">
        © {new Date().getFullYear()} Turismo Local
      </footer>
    </>
  );
}
