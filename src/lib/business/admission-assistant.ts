// @polsia:user-owned — respuestas aprobadas y límites del asistente de admisión.

import type { AdmissionIntent } from '@/lib/contracts/admission-assistant';

function normalize(text: string) {
  return text
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const immediateRiskPattern =
  /\b(dolor en el pecho|dificultad para respirar|no puedo respirar|me falta el aire|desmayo|desmayarme|sangrado abundante|sangrado intenso|convulsion|perdida de consciencia|reaccion alergica grave|intoxicacion|(?:me )?quiero suicidar(?:me)?|no quiero vivir|suicidarme|hacerme dano|peligro inmediato)\b/;

const clinicalQuestionPattern =
  /\b(diagnostico|diagnosticar|tratamiento|tratar|medicamento|medicacion|dosis|sintoma|dolor|sangrado|enfermedad|patologia|receta|prescribir|curar|terapia|ansiedad|depresion|alergia|intolerancia|analisis|resultados? de laboratorio|me duele|sufro de|tengo (?:dolor|ansiedad|depresion|una enfermedad|un diagnostico))\b/;

const personalDetailsPattern =
  /\b(me llamo|mi nombre es|mi correo es|mi email es|mi telefono es|mi direccion es|mi fecha de nacimiento|naci el|vivo en)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d ().-]{7,}\d)|https?:\/\//i;

const emergencyReply =
  'No puedo evaluar ni hacer triaje de situaciones de riesgo. Si crees que hay peligro inmediato, contacta ahora con los servicios de emergencia de tu zona o busca atención presencial.';

const clinicalReply =
  'Este asistente y el programa tienen un alcance educativo: no diagnostican, tratan ni ofrecen orientación clínica. Para una pregunta sobre síntomas, medicación o atención individual, consulta con un profesional de salud habilitado.';

const privacyReply =
  'Para cuidar tu privacidad, no incluyas nombres, datos de contacto ni información médica. Puedes reformular la pregunta usando solo una duda logística general.';

export function getAdmissionGuardrailReply(question: string): string | null {
  const normalized = normalize(question);
  if (immediateRiskPattern.test(normalized)) return emergencyReply;
  if (clinicalQuestionPattern.test(normalized)) return clinicalReply;
  if (personalDetailsPattern.test(question)) return privacyReply;
  return null;
}

export function classifyAdmissionQuestionLocally(question: string): AdmissionIntent | null {
  const normalized = normalize(question);

  if (
    /\b(semana\s+(?:[1-9]|1[0-2])|quien (?:imparte|facilita|dicta)|nombre del (?:docente|facilitador)|certificacion|acreditacion)\b/.test(
      normalized,
    )
  ) {
    return 'unknown';
  }
  if (/\b(dura|duracion|cuantas semanas|cuanto tiempo|termina|12 semanas)\b/.test(normalized)) {
    return 'duration';
  }
  if (
    /\b(formato|hibrido|virtual|presencial|online|asincron|frecuencia|sesiones|encuentros|horario|calendario|fecha de inicio|reuniones)\b/.test(
      normalized,
    )
  ) {
    return 'format';
  }
  if (
    /\b(precio|precios|cuesta|costo|coste|valor|inversion|pago|cuotas|importe)\b/.test(normalized)
  ) {
    return 'price';
  }
  if (
    /\b(llamada|ajuste|preparar|prepararme|encaje|conversar|preguntar al equipo)\b/.test(normalized)
  ) {
    return 'call_prep';
  }
  if (
    /\b(temas|tema|contenidos|contenido|programa|salud digestiva|alimentacion|regulacion emocional)\b/.test(
      normalized,
    )
  ) {
    return 'topics';
  }
  if (/\b(acceso|inscripcion|inscribirme|entrar|espacio privado)\b/.test(normalized)) {
    return 'access';
  }
  if (
    /\b(alcance|educativo|que ofrece|para que sirve|que incluye|que no hace)\b/.test(normalized)
  ) {
    return 'scope';
  }

  return null;
}

export function getAdmissionAnswer(intent: AdmissionIntent): string {
  switch (intent) {
    case 'duration':
      return 'La propuesta educativa dura 12 semanas.';
    case 'format':
      return 'Se propone un formato híbrido: recursos digitales asincrónicos para revisar a tu ritmo y espacios de conversaciones guiadas. La frecuencia y la logística concreta todavía no están definidas.';
    case 'topics':
      return 'Los temas generales publicados son salud digestiva, alimentación y regulación emocional. El detalle semana a semana aún no está confirmado como contenido definitivo.';
    case 'price':
      return 'La portada muestra US$1.500–2.500 como un rango estimado para conversar sobre esta propuesta, no como precio final confirmado. Puedes plantear el encaje del rango en la llamada de ajuste.';
    case 'access':
      return 'La información pública describe una propuesta de 12 semanas, pero no confirma fechas de inicio ni el calendario detallado. Puedes preguntar esos puntos en la llamada de ajuste.';
    case 'call_prep':
      return 'Para preparar la llamada, basta con pensar qué tema educativo general te interesa y qué dudas tienes sobre formato o logística. No hace falta compartir síntomas, historial ni datos médicos. La llamada es para conversar sobre el encaje educativo, no es una consulta clínica.';
    case 'scope':
      return 'Es una propuesta educativa sobre salud digestiva, alimentación y regulación emocional. No diagnostica, no ofrece tratamiento y no sustituye atención médica o psicológica.';
    case 'unknown':
      return 'No tengo un dato aprobado para responder eso. Puedes plantear la pregunta en la llamada de ajuste; no hace falta incluir datos personales ni médicos.';
  }
}

export function getAdmissionServiceUnavailableReply(): string {
  return 'Ahora no puedo comprobar esa pregunta. Puedes consultarla en la llamada de ajuste; no hace falta compartir información médica para prepararla.';
}
