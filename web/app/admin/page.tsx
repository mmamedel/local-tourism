"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deletePackage, listPackages } from "@/lib/api";
import { loadTokens } from "@/lib/auth";
import type { Package } from "@/lib/config";

export default function AdminHome() {
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setPackages(await listPackages());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(id: string) {
    if (!confirm("Excluir este pacote?")) return;
    const t = loadTokens();
    if (!t) return;
    await deletePackage(t.idToken, id);
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pacotes</h1>
        <Link
          href="/admin/edit/?id=new"
          className="bg-neutral-900 text-white rounded px-4 py-2 text-sm"
        >
          Novo pacote
        </Link>
      </div>

      {error && <p className="text-red-600 mt-4">{error}</p>}
      {!packages && !error && <p className="text-neutral-500 mt-4">Carregando…</p>}

      <div className="mt-6 divide-y divide-neutral-200 border border-neutral-200 rounded">
        {packages?.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-neutral-500">
                {p.published ? "Publicado" : "Rascunho"} · /{p.slug}
              </div>
            </div>
            <Link
              href={`/admin/edit/?id=${encodeURIComponent(p.id)}`}
              className="text-sm text-neutral-700 hover:underline"
            >
              Editar
            </Link>
            <button
              onClick={() => onDelete(p.id)}
              className="text-sm text-red-600 hover:underline"
            >
              Excluir
            </button>
          </div>
        ))}
        {packages && packages.length === 0 && (
          <div className="px-4 py-6 text-neutral-500 text-sm">Nenhum pacote ainda.</div>
        )}
      </div>
    </div>
  );
}
