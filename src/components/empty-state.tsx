"use client";

import Link from "next/link";

export function EmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="card text-center py-12 animate-slide-up">
      <h2 className="stencil-text mb-3">{title}</h2>
      <p className="font-bold text-xs uppercase">{body}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="cta-button mx-auto mt-6">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
