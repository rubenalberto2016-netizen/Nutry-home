import { describe, expect, it } from 'vitest';
import { hasUnsafeHealthAdvice, onlyKnownSourceIds } from '@/lib/business/editorial-content';
import type { EditorialDraftSection, EditorialSource } from '@/lib/contracts/editorial-content';

const source: EditorialSource = {
  id: 'source-a',
  kind: 'provided_material',
  title: 'Material de programa de muestra',
  url: null,
  excerpt: 'Texto aportado para una comprobación unitaria.',
  checkedAt: null,
  createdAt: '2026-10-12T12:00:00.000Z',
};

function section(body: string, sourceIds = ['source-a']): EditorialDraftSection {
  return { id: 'section-a', heading: 'Información del programa', body, sourceIds };
}

describe('editorial content guardrails', () => {
  it('accepts citations only when they belong to the saved source set', () => {
    expect(onlyKnownSourceIds([section('Descripción informativa del programa.')], [source])).toBe(true);
    expect(onlyKnownSourceIds([section('Descripción informativa.', ['invented-source'])], [source])).toBe(false);
  });

  it('rejects explicit clinical directions while allowing neutral informational copy', () => {
    expect(hasUnsafeHealthAdvice([section('El programa cura el insomnio.')])).toBe(true);
    expect(hasUnsafeHealthAdvice([section('Este método reduce el dolor articular.')])).toBe(true);
    expect(hasUnsafeHealthAdvice([section('El equipo presenta el contenido general del programa.')])).toBe(false);
  });
});
