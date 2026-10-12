import { describe, expect, it } from 'vitest';
import {
  classifyAdmissionQuestionLocally,
  getAdmissionAnswer,
  getAdmissionGuardrailReply,
} from '@/lib/business/admission-assistant';

describe('asistente de admisión', () => {
  it('responde con el dato aprobado sobre duración', () => {
    const intent = classifyAdmissionQuestionLocally('¿Cuánto dura el programa?');
    expect(intent).toBe('duration');
    expect(getAdmissionAnswer(intent ?? 'unknown')).toContain('12 semanas');
  });

  it('reconoce que el calendario todavía no está definido', () => {
    const intent = classifyAdmissionQuestionLocally('¿Cuál es el horario de las sesiones?');
    expect(intent).toBe('format');
    expect(getAdmissionAnswer(intent ?? 'unknown')).toContain('todavía no están definidas');
  });

  it('no convierte preguntas sobre detalles internos en contenido confirmado', () => {
    expect(classifyAdmissionQuestionLocally('¿Qué se enseña en la semana 7?')).toBe('unknown');
    expect(getAdmissionAnswer('unknown')).toContain('dato aprobado');
  });

  it('deriva las preguntas clínicas a un profesional humano', () => {
    const reply = getAdmissionGuardrailReply('¿Qué tratamiento debo seguir para mis síntomas?');
    expect(reply).toContain('profesional de salud habilitado');
    expect(reply).not.toContain('debes tomar');
  });

  it('deriva señales de riesgo y no realiza triaje', () => {
    const reply = getAdmissionGuardrailReply('Tengo dificultad para respirar');
    expect(reply).toContain('servicios de emergencia');
    expect(reply?.toLocaleLowerCase()).toContain('no puedo evaluar ni hacer triaje');
  });

  it('no envía datos personales de contacto a clasificación externa', () => {
    expect(getAdmissionGuardrailReply('Mi correo es ana@example.com, ¿cuánto dura?')).toContain(
      'no incluyas nombres, datos de contacto',
    );
  });
});
