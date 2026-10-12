// @polsia:user-owned — temario demostrativo, pendiente de revisión del equipo.

export const programTitle = 'Programa educativo de 12 semanas';

export const programDisclaimer =
  'Este espacio ofrece educación general y seguimiento de prácticas personales. No diagnostica. No realiza triaje clínico. No presenta resultados de salud como garantizados. Consulta a un profesional cualificado para decisiones sobre tu salud.';

export const programWeeks = [
  {
    weekNumber: 1,
    title: 'Punto de partida y objetivos de aprendizaje',
    summary: 'Conoce el recorrido y elige qué te gustaría aprender durante el programa.',
    materials: [
      {
        title: 'Cuaderno de inicio (muestra)',
        description: 'Una guía breve para anotar expectativas, preguntas y objetivos educativos.',
      },
    ],
    practice:
      'Escribe una pregunta que quieras explorar y una forma sencilla de observar tu rutina.',
  },
  {
    weekNumber: 2,
    title: 'Digestión y hábitos cotidianos',
    summary: 'Revisa información general sobre digestión y el contexto de las rutinas diarias.',
    materials: [
      {
        title: 'Lectura introductoria sobre digestión (muestra)',
        description:
          'Material educativo general para conversar y aprender, sin interpretar síntomas.',
      },
    ],
    practice: 'Anota qué preguntas te deja la lectura para comentarlas con el equipo educativo.',
  },
  {
    weekNumber: 3,
    title: 'Alimentación y contexto personal',
    summary: 'Observa cómo el tiempo, el entorno y las preferencias influyen en las comidas.',
    materials: [
      {
        title: 'Ficha de observación cotidiana (muestra)',
        description:
          'Una plantilla opcional para registrar contexto y preferencias, sin contar calorías.',
      },
    ],
    practice:
      'Describe una comida desde el contexto y la experiencia, sin calificarla como buena o mala.',
  },
  {
    weekNumber: 4,
    title: 'Atención y experiencia al comer',
    summary: 'Explora ejercicios de atención como herramientas educativas de autoobservación.',
    materials: [
      {
        title: 'Guía de atención al comer (muestra)',
        description:
          'Una propuesta para notar el entorno y la experiencia con curiosidad y sin juicio.',
      },
    ],
    practice:
      'Si te resulta cómodo, dedica unos minutos a observar una comida y anota qué notaste.',
  },
  {
    weekNumber: 5,
    title: 'Emociones y bienestar cotidiano',
    summary: 'Aprende vocabulario general para reflexionar sobre emociones y hábitos cotidianos.',
    materials: [
      {
        title: 'Mapa personal de situaciones y emociones (muestra)',
        description: 'Una hoja de reflexión que no evalúa ni clasifica estados de salud mental.',
      },
    ],
    practice: 'Elige una situación cotidiana y escribe qué apoyo o pausa te gustaría probar.',
  },
  {
    weekNumber: 6,
    title: 'Rutinas, entorno y pequeñas decisiones',
    summary: 'Identifica qué aspectos del entorno hacen más fácil o difícil sostener una rutina.',
    materials: [
      {
        title: 'Guía de diseño del entorno (muestra)',
        description: 'Preguntas prácticas para reconocer recursos y barreras cotidianos.',
      },
    ],
    practice: 'Escoge un ajuste pequeño en tu entorno que quieras ensayar esta semana.',
  },
  {
    weekNumber: 7,
    title: 'Movimiento elegido y accesible',
    summary: 'Reflexiona sobre maneras de incluir movimiento que sean adecuadas para cada persona.',
    materials: [
      {
        title: 'Hoja de opciones de movimiento (muestra)',
        description:
          'Ideas generales para conversar y adaptar a preferencias y circunstancias personales.',
      },
    ],
    practice:
      'Anota una opción que te interese y qué adaptación o consulta necesitarías antes de probarla.',
  },
  {
    weekNumber: 8,
    title: 'Descanso y rutinas de cierre',
    summary:
      'Explora prácticas generales de descanso sin prometer resultados ni sustituir una consulta.',
    materials: [
      {
        title: 'Diario de rutina de descanso (muestra)',
        description: 'Un recurso opcional para describir horarios y condiciones del entorno.',
      },
    ],
    practice: 'Observa una rutina de cierre del día y apunta qué te gustaría mantener o cambiar.',
  },
  {
    weekNumber: 9,
    title: 'Apoyo, comunicación y comunidad',
    summary: 'Identifica recursos de apoyo y formas de comunicar tus preferencias y preguntas.',
    materials: [
      {
        title: 'Guía de conversación y apoyo (muestra)',
        description: 'Prompts para preparar preguntas y pedir acompañamiento cuando lo necesites.',
      },
    ],
    practice: 'Prepara una pregunta o petición de apoyo que te resulte útil compartir.',
  },
  {
    weekNumber: 10,
    title: 'Diseño de una práctica personal',
    summary: 'Convierte un aprendizaje del programa en una práctica pequeña y revisable.',
    materials: [
      {
        title: 'Plantilla de práctica semanal (muestra)',
        description:
          'Un formato para definir una acción, el contexto y cómo reflexionar sobre ella.',
      },
    ],
    practice:
      'Escribe qué práctica quieres ensayar y cómo sabrás si te resulta conveniente continuar.',
  },
  {
    weekNumber: 11,
    title: 'Revisión y ajustes sostenibles',
    summary:
      'Revisa la experiencia de aprendizaje y considera ajustes acordes a tus circunstancias.',
    materials: [
      {
        title: 'Guía de revisión personal (muestra)',
        description: 'Preguntas para reconocer aprendizajes y decidir qué merece una conversación.',
      },
    ],
    practice: 'Elige una práctica que quieras mantener, adaptar o dejar en pausa, y anota por qué.',
  },
  {
    weekNumber: 12,
    title: 'Cierre y próximos pasos',
    summary: 'Resume aprendizajes, preguntas pendientes y posibles conversaciones futuras.',
    materials: [
      {
        title: 'Cuaderno de cierre (muestra)',
        description:
          'Una plantilla para documentar el recorrido educativo y definir próximos pasos.',
      },
    ],
    practice:
      'Escribe tres aprendizajes y una pregunta que quieras llevar a una persona profesional.',
  },
] as const;
