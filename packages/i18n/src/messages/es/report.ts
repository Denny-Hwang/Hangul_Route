import { plural } from '../../plural';
import type { DeepPartial, Messages } from '../../types';

/**
 * Spanish progress reports (F-I18N-001 PR 15; F-REPORT-001 section 3.11). Third person about the learner, `you` in
 * the second person ("tú"). No percentages, no comparison with anyone, no word about speaking; counts go through
 * `plural('es', …)`, and taught letters and words arrive as one argument each.
 */
const dayCount = (n: number): string => plural('es', n, { one: `${n} día`, other: `${n} días` });
const minuteCount = (n: number): string => plural('es', n, { one: `${n} minuto`, other: `${n} minutos` });
const questCount = (n: number): string => plural('es', n, { one: `${n} misión`, other: `${n} misiones` });
const cardCount = (n: number): string => plural('es', n, { one: `${n} tarjeta`, other: `${n} tarjetas` });
const learnerCount = (n: number): string => plural('es', n, { one: `${n} estudiante`, other: `${n} estudiantes` });
/** "a", "a y b", "a, b y c". */
const list = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1] ?? ''}`;
const practicedDays = (name: string, days: number, when: string): string => `${name} practicó ${dayCount(days)} ${when}.`;
const youPracticedDays = (days: number, when: string): string => `Practicaste ${dayCount(days)} ${when}.`;
/** Plan rows: class items are "tareas" (feminine); the other plans count items ("elementos", masculine). */
const planRow = (label: string, feminine: boolean) => (done: number, ready: number): string => {
  const doneWord = plural('es', done, feminine ? { one: 'hecha', other: 'hechas' } : { one: 'hecho', other: 'hechos' });
  const readyWord = plural('es', ready, feminine ? { one: 'lista', other: 'listas' } : { one: 'listo', other: 'listos' });
  return `${label}: ${done} ${doneWord}, ${ready} ${readyWord} para jugar`;
};

export const report = {
  documentTitle: 'Informe - Hangul Route',
  title: {
    learner: (name: string) => `${name}: informe`,
    class: (className: string) => `${className}: informe de la clase`,
  },
  chooser: { learner: '¿Informe de quién?', class: '¿Qué clase?' },
  period: { day: 'Hoy', week: 'Esta semana', month: 'Este mes', all: 'Total' },
  when: {
    day: 'hoy',
    week: 'esta semana',
    month: 'este mes',
    all: 'hasta hoy',
    prevDay: 'ayer',
    prevWeek: 'la semana pasada',
    prevMonth: 'el mes pasado',
    onDay: (date: string) => `el ${date}`,
    weekTo: (date: string) => `la semana hasta el ${date}`,
    inMonth: (month: string) => `en ${month}`,
  },
  step: {
    prevDay: 'Ayer',
    prevWeek: 'Semana pasada',
    prevMonth: 'Mes pasado',
    next: 'Siguiente',
    range: (from: string, to: string) => `${from} a ${to}`,
  },
  back: {
    home: 'Volver al inicio',
    space: (space: string) => `Volver a ${space}`,
  },
  glance: {
    nowOn: (n: number, stage: string) => `Ahora en la Etapa ${n}: ${stage}`,
    openRoute: 'Abrir la Ruta de aprendizaje',
    lastPractice: (date: string) => `Última práctica: ${date}`,
  },
  headline: {
    practiced: practicedDays,
    practicedOn: (name: string, when: string) => `${name} practicó ${when}.`,
    stageDone: (name: string, n: number, stage: string, when: string) => `¡${name} terminó la Etapa ${n}: ${stage} ${when}!`,
    stageDoneAll: (name: string, n: number, stage: string) => `¡${name} terminó la Etapa ${n}: ${stage}!`,
    noneYet: (when: string) => `Aún no hay práctica ${when}.`,
    noneThen: (when: string) => `No hubo práctica ${when}.`,
    noneEver: 'Aún no hay práctica.',
    noneSaved: (name: string, when: string) => `Aún no hay nada guardado del dispositivo de ${name} ${when}.`,
    noneSavedAfter: (name: string, date: string) => `Aún no hay nada guardado del dispositivo de ${name} después del ${date}.`,
    gettingStarted: (name: string) => `${name} acaba de empezar.`,
  },
  horizon: (date: string) => `Cifras hasta el ${date}.`,
  section: {
    wentWell: 'Lo que salió bien',
    practiceNext: 'Qué practicar después',
    thisPeriod: 'Este periodo',
    moreDetail: 'Más detalles',
  },
  figure: {
    days: 'Días de práctica',
    minutes: 'Minutos',
    quests: 'Misiones nuevas',
    cards: 'Tarjetas nuevas',
    letters: 'Letras nuevas',
    words: 'Palabras nuevas',
    up: (previous: string) => `Más que ${previous}`,
  },
  previous: {
    week: 'la semana pasada',
    month: 'todo el mes pasado',
    weekBefore: 'la semana anterior',
    monthBefore: 'todo el mes anterior',
  },
  growth: {
    quests: 'Misiones',
    cards: 'Tarjetas',
    month: 'Mes',
    showTable: 'Ver como tabla',
    hideTable: 'Ocultar tabla',
    since: (date: string, days: number) =>
      plural('es', days, { one: `Desde el ${date}: 1 día de práctica`, other: `Desde el ${date}: ${days} días de práctica` }),
  },
  detail: {
    lettersStrong: (name: string) => `Letras que ${name} conoce bien`,
    lettersMore: (n: number) => plural('es', n, { one: 'Y 1 letra más', other: `Y ${n} letras más` }),
    lettersPractising: 'Letras en práctica',
    lettersNew: 'Letras nuevas en este periodo',
    totals: (quests: number, cards: number) => `Desde el inicio: ${questCount(quests)}, ${cardCount(cards)}`,
    milestones: 'Logros',
    milestone: (n: number, stage: string, date: string) => `Etapa ${n}: ${stage}, terminada el ${date}`,
    levelCheck: 'Prueba de nivel',
    levelCheckOn: (date: string) => `Hecha el ${date}`,
    strand: (strand: string, status: string) => `${strand}: ${status}`,
    plan: 'Plan',
    planRow: {
      class: planRow('Tarea', true),
      family: planRow('Plan de esta semana', false),
      self: planRow('Ruta propia', false),
      device: planRow('Planes y tareas', false),
    },
  },
  insight: {
    showed_up: practicedDays,
    stage_done: (name: string, n: number, stage: string) => `${name} terminó la Etapa ${n}: ${stage}.`,
    letters_new: (name: string, letters: string) => `${name} ya domina ${letters}.`,
    practice_days: (name: string, days: number) => `${name} practicó ${dayCount(days)}.`,
    practice_day: (name: string) => `${name} sacó tiempo para practicar.`,
    minutes_up: (previous: string, minutes: number) => `Más tiempo de práctica que ${previous}: ${minuteCount(minutes)}.`,
    quests_new: (count: number) => plural('es', count, { one: '1 misión nueva terminada.', other: `${count} misiones nuevas terminadas.` }),
    cards_new: (count: number) =>
      plural('es', count, { one: '1 tarjeta nueva del patrimonio.', other: `${count} tarjetas nuevas del patrimonio.` }),
    level_secure: (strands: readonly string[]) =>
      plural('es', strands.length, { one: `Prueba de nivel: ${list(strands)} se ve firme.`, other: `Prueba de nivel: ${list(strands)} se ven firmes.` }),
    plan_done: {
      class: 'Todas las tareas de este plan están hechas.',
      family: 'Todo el plan de esta semana está hecho.',
    },
    streak: (days: number) =>
      plural('es', days, { one: '1 día seguido. ¡Hoya está orgulloso!', other: `${days} días seguidos. ¡Hoya está orgulloso!` }),
    words_new: (count: number) => plural('es', count, { one: '1 palabra nueva.', other: `${count} palabras nuevas.` }),
    rhythm: 'Una sesión corta dos días a la semana es un gran comienzo.',
    letters_revisit: (letters: string) => `${letters}: vale la pena repasar otra vez.`,
    strand_next: (strand: string) => `Lo próximo para crecer: ${strand}.`,
    plan_open: {
      class: (count: number) =>
        plural('es', count, { one: '1 tarea está lista para jugar.', other: `${count} tareas están listas para jugar.` }),
      family: (count: number) =>
        plural('es', count, { one: '1 parte del plan está lista para jugar.', other: `${count} partes del plan están listas para jugar.` }),
    },
    next_in_plan: (quest: string) => `Lo siguiente en el plan: ${quest}.`,
    next_on_route: (quest: string) => `Lo siguiente en la Ruta de aprendizaje: ${quest}.`,
    free_days_done: (name: string) => `${name} terminó las lecciones gratuitas.`,
    words_revisit: (words: string) => `${words}: para repasar otra vez en compañía.`,
  },
  you: {
    title: 'Tu informe',
    headline: {
      practiced: youPracticedDays,
      practicedOn: (when: string) => `Practicaste ${when}.`,
      stageDone: (n: number, stage: string, when: string) => `¡Terminaste la Etapa ${n}: ${stage} ${when}!`,
      stageDoneAll: (n: number, stage: string) => `¡Terminaste la Etapa ${n}: ${stage}!`,
      noneSaved: (when: string) => `Aún no hay nada guardado en tu dispositivo ${when}.`,
      noneSavedAfter: (date: string) => `Aún no hay nada guardado en tu dispositivo después del ${date}.`,
      gettingStarted: 'Acabas de empezar.',
    },
    detail: {
      lettersStrong: 'Letras que conoces bien',
    },
    insight: {
      showed_up: youPracticedDays,
      stage_done: (n: number, stage: string) => `Terminaste la Etapa ${n}: ${stage}.`,
      letters_new: (letters: string) => `Ya dominas ${letters}.`,
      practice_days: (days: number) => `Practicaste ${dayCount(days)}.`,
      practice_day: 'Sacaste tiempo para practicar.',
      free_days_done: 'Terminaste las lecciones gratuitas.',
      words_revisit: (words: string) => `${words}: vale la pena repasar otra vez.`,
    },
    state: {
      empty: 'Aún no empiezas. El informe se llena después de tu primera práctica.',
    },
    tip: {
      'syllable-reading': 'Lee palabras cortas.',
      sentences: 'Lee una historia corta.',
    },
  },
  tip: {
    'hangul-recognition': (game: string) => `Los juegos de letras ayudan: prueba ${game}.`,
    'sound-letter': (game: string) => `Los juegos de escuchar ayudan: prueba ${game}.`,
    'syllable-reading': 'Lean palabras cortas en compañía.',
    vocabulary: 'Las tarjetas de palabras ayudan: prueba un tema.',
    sentences: 'Lean una historia corta en compañía.',
  },
  action: {
    addToPlan: 'Añadir a un plan',
    openPlan: 'Abrir el plan',
    sendNote: 'Enviar una nota',
    seeReport: 'Ver informe',
  },
  strand: {
    status: {
      secure: 'Firme',
      'getting-there': 'En camino',
      'not-yet': 'Por aprender',
      'not-tested': 'Aún sin revisar',
    },
  },
  state: {
    noData: (name: string) => `Aún no hay progreso guardado del dispositivo de ${name}.`,
    noDataAction: 'Abre Hangul Route en ese dispositivo con conexión.',
    empty: (name: string) => `${name} aún no empieza. El informe se llena después de la primera práctica.`,
    legacy: 'Las cifras día a día aún no están disponibles.',
    updateAction: (name: string) => `Abre Hangul Route en el dispositivo de ${name} con conexión para actualizar.`,
    stale: (date: string) => `Último guardado: ${date}.`,
    unavailable: 'Este informe no está disponible.',
    error: 'Ahora no se puede cargar el informe.',
    flagOff: 'Los informes aún no están disponibles.',
    archived: {
      family: 'Este espacio familiar está archivado. Su informe es de solo lectura.',
      class: 'Esta clase está archivada. Su informe es de solo lectura.',
    },
  },
  class: {
    headline: (count: number, total: number, when: string) =>
      `${count} de ${learnerCount(total)} ${plural('es', count, { one: 'practicó', other: 'practicaron' })} ${when}.`,
    learners: (count: number) => learnerCount(count),
    olderApp: (count: number) =>
      plural('es', count, {
        one: '1 estudiante tiene una versión anterior de la app: sus cifras día a día aparecen al actualizar.',
        other: `${count} estudiantes tienen una versión anterior de la app: sus cifras día a día aparecen al actualizar.`,
      }),
    notSaved: (count: number) =>
      plural('es', count, {
        one: '1 estudiante guardó por última vez hace más de 7 días.',
        other: `${count} estudiantes guardaron por última vez hace más de 7 días.`,
      }),
    windowNotSaved: (count: number) =>
      plural('es', count, {
        one: '1 estudiante aún no tiene nada guardado de este periodo.',
        other: `${count} estudiantes aún no tienen nada guardado de este periodo.`,
      }),
    allBeforeJoin: 'El total incluye la práctica de cada estudiante de antes de unirse a la clase.',
    section: {
      practiceTogether: 'Practicar en grupo',
      daysPracticed: 'Días de práctica',
      time: 'Tiempo',
      levelCheck: 'Prueba de nivel (quienes la hicieron)',
      homework: 'Tarea',
    },
    lettersNew: 'Letras que la clase ya domina',
    revisit: 'Letras para repasar en grupo',
    questsNew: (count: number) => `Misiones nuevas: ${count}`,
    cardsNew: (count: number) => `Tarjetas nuevas: ${count}`,
    milestones: (when: string) => `Logros de etapa ${when}`,
    milestone: (n: number, stage: string, count: number) => `Etapa ${n}: ${stage}, terminada por ${learnerCount(count)}`,
    band: {
      none: 'Aún no',
      practiced: 'Con práctica',
      range: (from: number, to: number) => `${from} a ${to} días`,
      atLeast: (from: number) => `${from} días o más`,
    },
    count: (label: string, count: number) => `${label}: ${count}`,
    minutesTotal: (minutes: number) => `Tiempo total: ${minuteCount(minutes)}`,
    medianMinutes: (minutes: number) => `Tiempo típico de quienes practicaron: ${minuteCount(minutes)}`,
    planLesson: 'Planear una clase',
    link: 'Informe de clase',
    planRow: (assigned: number, started: number, finished: number) =>
      `Asignado a ${assigned}, empezado por ${started}, terminado por ${finished}`,
    empty: 'Aún no hay estudiantes.',
    afterUpdate: 'Aparece cuando los estudiantes actualicen la app.',
  },
  print: {
    button: 'Imprimir o guardar en PDF',
    hint: 'Desactiva encabezados y pies de página al imprimir.',
    footer: (date: string) => `Privado: compartido desde Hangul Route el ${date}.`,
  },
  nav: { reports: 'Informes', classReports: 'Informe de clase' },
  letter: (letter: string, romanization: string) => `${letter} (${romanization})`,
  list,
} satisfies DeepPartial<Messages['report']>;
