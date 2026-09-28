'use client';

import { useLocale } from '../../lib/i18n/provider';

import Link from 'next/link';
import React, { type ReactNode } from 'react';

export function BoardWorkspace({
  id,
  slug,
  active,
  children,
}: {
  id: string;
  slug: string;
  active: 'settings' | 'ideas';
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="workspace-layout">
      <aside className="workspace-rail">
        <Link className="workspace-back" href="/boards">{t("← My workspace")}{' '}</Link>
        <p className="eyebrow">{t("Board /")}{' '}{slug}</p>
        <nav aria-label={t("Board workspace")}>
          <Link
            aria-current={active === 'settings' ? 'page' : undefined}
            href={`/boards/${id}`}
          >{t("Overview & settings")}{' '}</Link>
          <Link
            aria-current={active === 'ideas' ? 'page' : undefined}
            href={`/boards/${id}/suggestions`}
          >{t("Feedback desk")}{' '}</Link>
          <Link href={`/${slug}`}>{t("Public board ↗")}</Link>
        </nav>
        <div className="workspace-note">
          <strong>{t("Keep the loop open.")}</strong>
          <p>{t("Listen to ideas, choose a direction and show what ships.")}</p>
        </div>
      </aside>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
