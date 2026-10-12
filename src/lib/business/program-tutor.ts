// @polsia:user-owned — fuentes aprobadas y límites del asistente educativo.

import { type ProgramTutorMaterial, ProgramTutorResponse } from '@/lib/contracts/program-tutor';

/**
 * La clase magistral es contenido educativo publicado del producto y está disponible
 * como recurso transversal. El temario de program-curriculum.ts está marcado como
 * muestra y no se incluye hasta que el equipo publique materiales definitivos.
 */
export const approvedProgramMaterials: ProgramTutorMaterial[] = [
  {
    id: 'published-masterclass-microbiome',
    weekNumber: null,
    title: 'Clase magistral: microbioma, síntomas digestivos y hambre emocional',
    sourceHref: '/clase-magistral',
    content: [
      'La microbiota suele nombrar a los microorganismos que viven en un entorno. La palabra microbioma se usa para hablar de esa comunidad y, según el contexto, también de sus genes y del ambiente en que interactúa. Son conceptos relacionados; no describen por sí solos el estado de salud de una persona.',
      'La investigación estudia cómo se relacionan estas comunidades con distintos procesos del organismo. Una asociación observada entre grupos no demuestra por sí sola qué causa un síntoma ni qué ocurre en un individuo. No existe aquí una conclusión automática que permita diagnosticar “disbiosis” a partir de una lista de microorganismos.',
      'El consenso internacional sobre pruebas del microbioma señala que la evidencia sobre su utilidad clínica todavía es limitada y recomienda cautela con pruebas directas al consumidor. Esta clase no interpreta resultados de laboratorio ni propone pruebas para autodiagnóstico.',
      'Gases, distensión, dolor abdominal o cambios al evacuar son experiencias que pueden tener más de una explicación. El síntoma, por sí solo, no confirma disbiosis ni identifica qué tratamiento —si alguno— necesita una persona.',
      'Algunos trastornos digestivos se estudian considerando la comunicación entre el intestino y el cerebro, junto con otros factores. Eso no vuelve imaginario un síntoma ni permite concluir que una emoción sea su causa. Una evaluación individual corresponde a profesionales habilitados, con la historia y el contexto pertinentes.',
      'Si algo persiste, empeora, es nuevo o requiere diagnóstico o tratamiento, busca orientación de un profesional de salud. La clase y el programa no sustituyen esa evaluación ni ofrecen atención individualizada.',
      'La expresión “hambre emocional” puede servir para conversar sobre momentos en que comer y sentir una emoción coinciden. No es un diagnóstico, no distingue una necesidad “real” de otra “falsa” y no demuestra una causa única. Las experiencias con comida, apetito y emociones varían de una persona a otra.',
      'Como ejercicio educativo, puedes notar el contexto con curiosidad: ¿qué estaba ocurriendo?, ¿qué emociones estaban presentes?, ¿qué otras necesidades o circunstancias importaban? No hace falta responder aquí ni compartir información personal. Estas preguntas no sirven para diagnosticar, prescribir una dieta o reemplazar apoyo psicológico o nutricional individualizado.',
      'La clase y el programa de 12 semanas ofrecen contenido educativo y conversación general. No diagnostican disbiosis, no interpretan pruebas, no prescriben dietas o tratamientos y no prometen curas ni resultados clínicos.',
    ].join('\n\n'),
  },
];

const emergencyPattern =
  /\b(dolor (?:fuerte )?en el pecho|dificultad para respirar|no puedo respirar|me falta el aire|desmayo|desmayarme|sangrado abundante|sangrado intenso|convulsion|perdida de consciencia|reaccion alergica grave|intoxicacion|(?:me )?quiero suicidar(?:me)?|no quiero vivir|suicidarme|hacerme dano|peligro inmediato)\b/;

const clinicalQuestionPattern =
  /\b(diagnos|sintom|me duele|tengo dolor|dolor|sangrad|fiebre|medicamento|medicacion|dosis|tratamiento|tratar|prescrib|receta|enfermedad|patolog|alergia|intolerancia|embaraz|depresion|ansiedad|terapia|ataque de panico|glucosa|presion arterial|debo tomar|deberia tomar|puedo dejar|debo dejar|deberia dejar|doctor|medico|profesional sanitario|urgencias|suicid|hacerme dano)\b/;

function normalizeForSafety(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getClinicalConcern(question: string) {
  const normalized = normalizeForSafety(question);
  const emergency = emergencyPattern.test(normalized);
  return { emergency, clinical: emergency || clinicalQuestionPattern.test(normalized) };
}

export function getClinicalReply(emergency: boolean): ProgramTutorResponse {
  return ProgramTutorResponse.parse({
    status: 'clinical',
    answer: emergency
      ? 'Lo que describes podría requerir atención inmediata. Contacta ahora con los servicios de emergencia locales.'
      : 'No puedo valorar síntomas ni ofrecer diagnósticos, tratamientos o recomendaciones clínicas. Consulta con un profesional sanitario cualificado. Si crees que hay una urgencia, contacta con los servicios de emergencia locales.',
    citations: [],
  });
}

export function getNoMaterialsReply(): ProgramTutorResponse {
  return ProgramTutorResponse.parse({
    status: 'no_materials',
    answer:
      'El equipo todavía no ha publicado materiales aprobados para esta semana, así que no puedo ofrecer una explicación basada en fuentes del programa. Si tu consulta se refiere a síntomas, diagnóstico, tratamiento o medicación, consúltala con un profesional sanitario cualificado.',
    citations: [],
  });
}

export function getUnsupportedReply(): ProgramTutorResponse {
  return ProgramTutorResponse.parse({
    status: 'unsupported',
    answer:
      'No encuentro respaldo para responder eso en los materiales aprobados de esta semana. Puedo explicar lo que sí aparece en ellos; para consultas clínicas, habla con un profesional sanitario cualificado.',
    citations: [],
  });
}

export function getMaterialsForWeek(weekNumber: number) {
  return approvedProgramMaterials.filter(
    (material) => material.weekNumber === null || material.weekNumber === weekNumber,
  );
}
