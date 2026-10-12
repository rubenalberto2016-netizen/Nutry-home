// @polsia:user-owned
import type { EditorialDraftSection, EditorialSource } from '@/lib/contracts/editorial-content';

const UNSAFE_HEALTH_ADVICE =
  /\b(?:cura|curar|trata|tratar|diagnostica|diagnosticar|prescribe|prescribir|dosis|sustituye|suspende|cure|treat|diagnose|prescribe|dosage)\b|\b(?:debe|deben|debería|deberías|recomendamos|recomienda|recomiendan)\s+(?:tomar|dejar|suspender|reducir|aumentar|cambiar|usar|seguir|hacer)\b|(?:alivia|aliviar|reduce|reducir|previene|prevenir|mejora|mejorar|controla|controlar|normaliza|normalizar).{0,60}(?:dolor|síntoma|inflamación|presión arterial|glucosa|diabetes|depresión|ansiedad|pain|symptom|inflammation|blood pressure|blood sugar)/iu;

export function hasUnsafeHealthAdvice(
  sections: Array<Pick<EditorialDraftSection, 'heading' | 'body'>>,
) {
  return sections.some((section) =>
    UNSAFE_HEALTH_ADVICE.test(`${section.heading} ${section.body}`),
  );
}

export function onlyKnownSourceIds(
  sections: Array<Pick<EditorialDraftSection, 'sourceIds'>>,
  sources: EditorialSource[],
) {
  const sourceIds = new Set(sources.map((source) => source.id));
  return sections.every((section) =>
    section.sourceIds.every((sourceId) => sourceIds.has(sourceId)),
  );
}

export function toEditorialSource(record: {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  excerpt: string;
  checkedAt: Date | null;
  createdAt: Date;
}): EditorialSource {
  return {
    id: record.id,
    kind: record.kind === 'web_search' ? 'web_search' : 'provided_material',
    title: record.title,
    url: record.url,
    excerpt: record.excerpt,
    checkedAt: record.checkedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toEditorialDraft(record: {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  title: string;
  brief: string;
  sections: unknown;
  sources: unknown;
  status: string;
  approvedAt: Date | null;
  approvedBySnapshot: string | null;
  latestReviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    createdByUserId: record.createdByUserId,
    title: record.title,
    brief: record.brief,
    sections: record.sections,
    sources: record.sources,
    status: record.status,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    approvedBySnapshot: record.approvedBySnapshot,
    latestReviewNote: record.latestReviewNote,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
