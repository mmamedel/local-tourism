"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createPackage,
  getPackage,
  imageUrl,
  requestUploadUrl,
  savePackage,
} from "@/lib/api";
import { loadTokens } from "@/lib/auth";
import type { Package } from "@/lib/config";

function emptyPackage(): Package {
  return {
    id: "",
    slug: "",
    title: "",
    headline: "",
    description: "",
    priceBRL: 0,
    durationDays: 1,
    location: "",
    heroImageKey: undefined,
    galleryKeys: [],
    published: false,
    updatedAt: "",
  };
}

function EditForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "new";
  const isNew = id === "new";

  const [pkg, setPkg] = useState<Package | null>(isNew ? emptyPackage() : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    // Load by id via list lookup (admin endpoint returns all; or fetch by slug).
    // Simpler: getPackage uses slug, so here we fetch list and pick by id.
    (async () => {
      try {
        const t = loadTokens();
        if (!t) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/packages/by-id/${id}`, {
          headers: { authorization: `Bearer ${t.idToken}` },
        });
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        setPkg(await res.json());
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [id, isNew]);

  async function onUpload(field: "hero" | "gallery", file: File) {
    const t = loadTokens();
    if (!t || !pkg) return;
    const { uploadUrl, key } = await requestUploadUrl(t.idToken, file.type);
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error(`upload failed: ${put.status}`);
    if (field === "hero") {
      setPkg({ ...pkg, heroImageKey: key });
    } else {
      setPkg({ ...pkg, galleryKeys: [...(pkg.galleryKeys ?? []), key] });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pkg) return;
    setSaving(true);
    setError(null);
    try {
      const t = loadTokens();
      if (!t) throw new Error("not authenticated");
      if (isNew) {
        const { id: _id, updatedAt: _u, ...rest } = pkg;
        void _id;
        void _u;
        await createPackage(t.idToken, rest);
      } else {
        await savePackage(t.idToken, pkg);
      }
      router.push("/admin/");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!pkg) return <p className="text-neutral-500">Carregando…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">{isNew ? "Novo pacote" : "Editar pacote"}</h1>

      <Field label="Título">
        <input
          type="text"
          required
          value={pkg.title}
          onChange={(e) => setPkg({ ...pkg, title: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Slug (URL)">
        <input
          type="text"
          required
          pattern="[a-z0-9-]+"
          value={pkg.slug}
          onChange={(e) => setPkg({ ...pkg, slug: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Chamada (headline curta)">
        <input
          type="text"
          required
          value={pkg.headline}
          onChange={(e) => setPkg({ ...pkg, headline: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Descrição">
        <textarea
          required
          rows={6}
          value={pkg.description}
          onChange={(e) => setPkg({ ...pkg, description: e.target.value })}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Preço (R$)">
          <input
            type="number"
            min={0}
            step={1}
            value={pkg.priceBRL}
            onChange={(e) => setPkg({ ...pkg, priceBRL: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Duração (dias)">
          <input
            type="number"
            min={1}
            value={pkg.durationDays}
            onChange={(e) => setPkg({ ...pkg, durationDays: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Local">
          <input
            type="text"
            value={pkg.location}
            onChange={(e) => setPkg({ ...pkg, location: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Imagem principal">
        <div className="flex items-center gap-4">
          {pkg.heroImageKey && (
            <img src={imageUrl(pkg.heroImageKey)} alt="" className="w-32 aspect-[4/3] object-cover rounded" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload("hero", f).catch((err) => setError(String(err)));
            }}
          />
        </div>
      </Field>

      <Field label="Galeria">
        <div className="flex flex-wrap gap-2">
          {pkg.galleryKeys?.map((k) => (
            <div key={k} className="relative">
              <img src={imageUrl(k)} alt="" className="w-24 aspect-square object-cover rounded" />
              <button
                type="button"
                onClick={() =>
                  setPkg({ ...pkg, galleryKeys: pkg.galleryKeys?.filter((g) => g !== k) })
                }
                className="absolute -top-1 -right-1 bg-white border border-neutral-300 rounded-full w-5 h-5 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          type="file"
          accept="image/*"
          className="mt-2"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload("gallery", f).catch((err) => setError(String(err)));
          }}
        />
      </Field>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={pkg.published}
          onChange={(e) => setPkg({ ...pkg, published: e.target.checked })}
        />
        <span>Publicado</span>
      </label>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!pkg.featured}
            onChange={(e) => setPkg({ ...pkg, featured: e.target.checked })}
          />
          <span>Destaque no banner (até 3)</span>
        </label>
        {pkg.featured && (
          <label className="flex items-center gap-2 text-sm">
            <span>Ordem:</span>
            <input
              type="number"
              min={1}
              max={3}
              value={pkg.featuredOrder ?? 1}
              onChange={(e) => setPkg({ ...pkg, featuredOrder: Number(e.target.value) })}
              className="w-16 border border-neutral-300 rounded px-2 py-1"
            />
          </label>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-neutral-900 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/")}
          className="text-sm text-neutral-600 hover:underline"
        >
          Cancelar
        </button>
      </div>

      <style jsx>{`
        .input {
          margin-top: 0.25rem;
          display: block;
          width: 100%;
          border: 1px solid #d4d4d4;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Carregando…</p>}>
      <EditForm />
    </Suspense>
  );
}
