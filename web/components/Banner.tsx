"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { imageUrl } from "@/lib/api";
import type { Package } from "@/lib/config";

const ROTATE_MS = 6000;

export function Banner({ packages }: { packages: Package[] }) {
  const featured = packages
    .filter((p) => p.published && p.featured)
    .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99))
    .slice(0, 3);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (featured.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % featured.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [featured.length]);

  if (featured.length === 0) return null;

  return (
    <section className="relative w-full aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/8] overflow-hidden bg-neutral-900">
      {featured.map((p, i) => (
        <Link
          key={p.id}
          href={`/pacotes/?slug=${encodeURIComponent(p.slug)}`}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={i !== idx}
        >
          {p.heroImageKey && (
            <img
              src={imageUrl(p.heroImageKey)}
              alt={p.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 text-white max-w-3xl">
            <h2 className="text-3xl md:text-5xl font-semibold drop-shadow">{p.title}</h2>
            <p className="mt-2 md:mt-4 text-base md:text-lg text-white/90 drop-shadow line-clamp-3">
              {p.headline}
            </p>
          </div>
        </Link>
      ))}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {featured.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Ir para destaque ${i + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition ${
              i === idx ? "bg-white" : "bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
