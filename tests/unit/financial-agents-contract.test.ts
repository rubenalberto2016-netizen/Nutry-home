import { describe, expect, it } from 'vitest';
import {
  FinancialAgentAvailabilityQuery,
  FinancialAgentCreate,
  FinancialAgentItem,
  FinancialAgentList,
  FinancialAgentPatch,
  FinancialAgentRequestedDocumentsPatch,
  FinancialAgentStatusChange,
} from '@/lib/contracts/financial-agents';

const validInput = {
  name: 'Evaluación inicial',
  objective: 'Recopilar información para una primera evaluación financiera.',
  questions: ['¿Cuál es el objetivo?', '¿Qué monto se evalúa?'],
  requestedDocuments: [],
};

describe('contrato de agentes financieros', () => {
  it('acepta nombre, objetivo y preguntas válidas', () => {
    expect(FinancialAgentCreate.safeParse(validInput).success).toBe(true);
  });

  it('rechaza campos vacíos, preguntas mal formadas y listas fuera de los límites', () => {
    expect(FinancialAgentCreate.safeParse({ ...validInput, name: '  ' }).success).toBe(false);
    expect(FinancialAgentCreate.safeParse({ ...validInput, objective: '' }).success).toBe(false);
    expect(FinancialAgentCreate.safeParse({ ...validInput, questions: [] }).success).toBe(false);
    expect(FinancialAgentCreate.safeParse({ ...validInput, questions: [' '] }).success).toBe(false);
    expect(
      FinancialAgentCreate.safeParse({
        ...validInput,
        questions: Array.from({ length: 11 }, () => 'Pregunta válida'),
      }).success,
    ).toBe(false);
    expect(
      FinancialAgentCreate.safeParse({
        ...validInput,
        questions: ['x'.repeat(301)],
      }).success,
    ).toBe(false);
  });

  it('aplica los máximos de nombre y objetivo', () => {
    expect(FinancialAgentCreate.safeParse({ ...validInput, name: 'n'.repeat(121) }).success).toBe(
      false,
    );
    expect(
      FinancialAgentCreate.safeParse({ ...validInput, objective: 'o'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('acepta requisitos documentales vacíos o configurados y rechaza duplicados', () => {
    expect(FinancialAgentCreate.safeParse(validInput).success).toBe(true);
    expect(
      FinancialAgentCreate.safeParse({
        ...validInput,
        requestedDocuments: ['Estados financieros', 'Identificación'],
      }).success,
    ).toBe(true);
    expect(
      FinancialAgentCreate.safeParse({ ...validInput, requestedDocuments: ['Balance', ' balance '] })
        .success,
    ).toBe(false);
    expect(FinancialAgentRequestedDocumentsPatch.safeParse({ requestedDocuments: [] }).success).toBe(
      true,
    );
    expect(
      FinancialAgentCreate.parse({
        name: validInput.name,
        objective: validInput.objective,
        questions: validInput.questions,
      }).requestedDocuments,
    ).toEqual([]);
    expect(
      FinancialAgentRequestedDocumentsPatch.safeParse({
        requestedDocuments: [],
        questions: validInput.questions,
      }).success,
    ).toBe(false);
  });

  it('no permite que el cliente envíe propietario o estado', () => {
    expect(FinancialAgentCreate.safeParse({ ...validInput, userId: 'other-user' }).success).toBe(
      false,
    );
    expect(FinancialAgentCreate.safeParse({ ...validInput, status: 'published' }).success).toBe(
      false,
    );
    expect(FinancialAgentPatch.safeParse({ status: 'draft' }).success).toBe(false);
    expect(FinancialAgentPatch.safeParse({}).success).toBe(false);
  });

  it('valida respuestas de los tres estados y fechas', () => {
    const item = {
      ...validInput,
      id: 'agent_test_1',
      status: 'draft',
      updatedAt: '2026-10-02T12:00:00.000Z',
    };
    expect(FinancialAgentItem.safeParse(item).success).toBe(true);
    expect(FinancialAgentItem.safeParse({ ...item, status: 'published' }).success).toBe(true);
    expect(FinancialAgentItem.safeParse({ ...item, status: 'retired' }).success).toBe(true);
    expect(FinancialAgentItem.safeParse({ ...item, status: 'unknown' }).success).toBe(false);
    expect(FinancialAgentList.safeParse({ items: [item] }).success).toBe(true);
  });

  it('valida cambios de estado separados de la edición y el filtro de disponibilidad', () => {
    expect(FinancialAgentStatusChange.safeParse({ status: 'published' }).success).toBe(true);
    expect(FinancialAgentStatusChange.safeParse({ status: 'retired' }).success).toBe(true);
    expect(FinancialAgentStatusChange.safeParse({ status: 'unknown' }).success).toBe(false);
    expect(
      FinancialAgentStatusChange.safeParse({ status: 'published', name: 'Otro nombre' }).success,
    ).toBe(false);
    expect(FinancialAgentAvailabilityQuery.safeParse({ availability: 'published' }).success).toBe(
      true,
    );
    expect(FinancialAgentAvailabilityQuery.safeParse({}).success).toBe(true);
    expect(FinancialAgentAvailabilityQuery.safeParse({ availability: 'draft' }).success).toBe(
      false,
    );
  });
});
