"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPackage, imageUrl } from "@/lib/api";
import type { Package } from "@/lib/config";

function PackageView() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const [pkg, setPkg] = useState<Package | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    getPackage(slug).then(setPkg).catch(() => setPkg(null));
  }, [slug]);

  if (!slug) return <p className="text-neutral-500">Pacote não especificado.</p>;
  if (pkg === undefined) return <p className="text-neutral-500">Carregando…</p>;
  if (pkg === null) return <p className="text-neutral-500">Pacote não encontrado.</p>;

  return (
    <article className="max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-3xl font-semibold mt-4">{pkg.title}</h1>
      <p className="text-neutral-600 mt-2">{pkg.headline}</p>

      {pkg.heroImageKey && (
        <img
          src={imageUrl(pkg.heroImageKey)}
          alt={pkg.title}
          className="w-full aspect-[16/9] object-cover rounded-lg mt-6"
        />
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-neutral-500">Preço</div>
          <div className="font-medium">R$ {pkg.priceBRL.toLocaleString("pt-BR")}</div>
        </div>
        <div>
          <div className="text-neutral-500">Duração</div>
          <div className="font-medium">{pkg.durationDays} dia(s)</div>
        </div>
        <div className="col-span-2">
          <div className="text-neutral-500">Local</div>
          <div className="font-medium">{pkg.location}</div>
        </div>
      </div>

      <div className="prose prose-neutral mt-8 whitespace-pre-wrap">{pkg.description}</div>

      {pkg.galleryKeys && pkg.galleryKeys.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
          {pkg.galleryKeys.map((k) => (
            <img key={k} src={imageUrl(k)} alt="" className="w-full aspect-square object-cover rounded" />
          ))}
        </div>
      )}
    </article>
  );
}

export default function Page() {
  return (
    <main className="flex-1 px-6 py-10">
      <Suspense fallback={<p className="text-neutral-500">Carregando…</p>}>
        <PackageView />
      </Suspense>
    </main>
  );
}
