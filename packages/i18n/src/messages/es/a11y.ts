import { plural } from '../../plural';
import type { DeepPartial, Messages } from '../../types';

/** Spanish accessibility labels (F-I18N-001 PR 15). Read aloud, so whole sentences; sound values arrive as arguments. */
export const a11y = {
  tile: (label: string) => `Letra coreana ${label}, toca para elegir`,
  stars: (earned: number) => `${earned} de 3 estrellas ganadas`,
  hoya: (pose: string) => `Hoya, el tigre, ${pose}`,
  dismissHoya: 'Cerrar el mensaje de Hoya',
  goBack: 'Volver',
  tabs: { home: 'Hoy', journey: 'Recorrido', library: 'Colección', route: 'Ruta' },
  tabPosition: (name: string, position: number, count: number) => `${name}, pestaña, ${position} de ${count}`,
  cardArt: (title: string) => `Dibujo de la tarjeta ${title}`,
  profileEntry: 'Perfil y ajustes',
  openHomework: 'Abrir la tarea',
  missionCard: (title: string, subtitle: string, collected: boolean) => `${title}. ${subtitle}.${collected ? ' Conseguida.' : ''}`,
  journeyCell: (c: {
    stage: number;
    stageTitle: string;
    themeTitle: string;
    kind: 'lesson' | 'book' | 'stories-only' | 'placeholder';
    complete: boolean;
    stories: number;
    finished: number;
    start: boolean;
    placedOut: boolean;
  }) => {
    const where = `Etapa ${c.stage} ${c.stageTitle}, ${c.themeTitle}`;
    const count = plural('es', c.stories, { one: '1 historia del patrimonio', other: `${c.stories} historias del patrimonio` });
    const stories = c.stories === 0 ? '' : c.finished > 0 ? `${count}, ${c.finished} terminadas` : count;
    const holds = c.kind === 'book' ? 'libro de historias' : 'lección';
    const head =
      c.kind === 'placeholder'
        ? `${where}, muy pronto`
        : c.kind === 'stories-only'
          ? `${where}: ${stories}`
          : `${where}: ${holds}${c.complete ? (c.kind === 'book' ? ', terminado' : ', terminada') : ''}${stories === '' ? '' : `, ${stories}`}`;
    const marks = `${c.start ? ' Empezaste aquí.' : ''}${c.placedOut ? ' Aquí puedes avanzar, y sigue abierto para jugar.' : ''}`;
    return marks === '' ? head : `${head}.${marks}`;
  },
  episodeCard: (title: string) => `Tarjeta ${title}`,
  cardWaiting: 'Una tarjeta que ganas al terminar este episodio',
  playAgainQuest: (title: string) => `Jugar otra vez: ${title}`,
  homeworkRow: (title: string, due: string) => `${title}, ${due}`,
  leaveQuest: 'Dejar la misión',
  hearItLabel: (label: string) => `Escuchar. ${label}`,
  hearExample: (spoken: string) => `Escuchar: ${spoken}`,
  discoverLetter: (romanization: string, soundHint?: string) =>
    soundHint === undefined ? `Letra coreana ${romanization}` : `Letra coreana ${romanization}. ${soundHint}`,
  discoverFinal: (romanization: string) => `Consonante final coreana ${romanization}`,
  lockedCard: 'Tarjeta bloqueada',
  lockedCardHint: (hint: string) => `Tarjeta bloqueada. ${hint}`,
  newCard: (title: string) => `${title}. Nueva`,
  flipToBack: 'Toca para ver el reverso',
  flipToFront: 'Toca para ver el frente',
  shareCard: 'Compartir esta tarjeta',
  soundSwitch: (muted: boolean, voice: string) => `Sonido, ${muted ? 'apagado' : 'encendido'}. ${voice}.`,
  minigame: {
    hear: (romanization: string) => `Escuchar ${romanization}`,
    finalTile: (romanization: string) => `final ${romanization}`,
    blockShape: (hint: string) => `Forma del bloque. ${hint}`,
    traceLetter: (romanization: string) => `Traza la letra ${romanization}`,
    traceFinal: (romanization: string) => `Traza la final ${romanization}`,
    traceCanvas: (romanization: string) => `Dibuja la letra ${romanization} con el dedo`,
    strokeOrder: {
      guide: 'Guía del orden de trazos',
      summary: (strokes: readonly string[]) =>
        `${plural('es', strokes.length, {
          one: 'Orden de trazos. Un trazo',
          other: `Orden de trazos. ${strokes.length} trazos`,
        })}. ${strokes.map((stroke, i) => `${i + 1}: ${stroke}`).join('. ')}.`,
      dot: 'un punto',
      loop: 'un círculo',
      curving: (direction: string) => `curva ${direction}`,
      legs: (directions: readonly string[]) => directions.join(', luego '),
      direction: {
        right: 'a la derecha',
        downRight: 'abajo a la derecha',
        down: 'abajo',
        downLeft: 'abajo a la izquierda',
        left: 'a la izquierda',
        upLeft: 'arriba a la izquierda',
        up: 'arriba',
        upRight: 'arriba a la derecha',
      },
      close: (description: string) => `${description} Toca para cerrar.`,
    },
    hearAgain: 'Escuchar el sonido otra vez',
    picture: 'Imagen',
    option: {
      correct: (label: string) => `Respuesta correcta: ${label}`,
      wrong: (label: string) => `Esta no: ${label}`,
      hint: (label: string) => `Mira aquí: ${label}`,
      selected: (label: string) => `Elegida: ${label}`,
      matched: (badge: number, label: string) => `Pareja número ${badge}: ${label}`,
    },
    koreanWord: (word: string) => `Palabra coreana ${word}`,
    meaning: (gloss: string) => `Significado: ${gloss}`,
  },
  koreanItem: (item: { ko: string; romanization: string; gloss?: string }) =>
    item.gloss === undefined ? `Coreano: ${item.ko}, ${item.romanization}` : `Coreano: ${item.ko}, ${item.romanization}, ${item.gloss}`,
  pinDigit: (digit: number) => `Dígito ${digit}`,
  pinDelete: 'Borrar el último dígito',
  pinDots: (entered: number, total: number) => `${entered} de ${total} dígitos escritos`,
  rescueCode: 'Código de rescate',
  classCode: 'Código de clase',
  joinName: 'Nombre que verá tu docente',
  leaveSpace: (name: string) => `Salir de ${name}`,
  planStatus: (name: string, state: string) => `${name}: ${state}.`,
  myRoute: {
    tab: 'Ruta de aprendizaje',
    stage: (order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number) =>
      [
        `Etapa ${order}, ${title}.`,
        `${stateWord}.`,
        here ? 'Estás aquí.' : '',
        start ? 'Empezaste aquí.' : '',
        played > 0 ? `${plural('es', played, { one: '1 misión jugada', other: `${played} misiones jugadas` })}.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    stageGrownup: (name: string, order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number) =>
      [
        `Etapa ${order}, ${title}.`,
        `${stateWord}.`,
        here ? `${name} está aquí.` : '',
        start ? `${name} empezó aquí.` : '',
        played > 0 ? `${plural('es', played, { one: '1 misión jugada', other: `${played} misiones jugadas` })}.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    later: (label: string, stateWord: string) => `${label}. ${stateWord}.`,
    trail: 'Lista de etapas',
    cell: (theme: string, title: string, word: string) => `${theme}: ${title}. ${word}.`,
    skill: (label: string, detail: string) => `${label}. ${detail}.`,
    gain: (word: string, n: number) => `${word}: ${n}`,
    homeStrip: (title: string, here: string, progress: readonly string[], goal: string | null, week: string | null) =>
      [`${title}.`, here, ...progress.map((line) => `${line}.`), goal === null ? '' : `${goal}.`, week === null ? '' : `${week}.`]
        .filter((part) => part !== '')
        .join(' '),
    homeStripGoal: (n: number, title: string) => `Meta: Etapa ${n}, ${title}`,
    rowGoal: (n: number, title: string) => `Meta: Etapa ${n}, ${title}.`,
    rowStarted: (n: number, band: string, date: string) => `Empezó: Etapa ${n}, ${band}, ${date}.`,
  },
  vocab: {
    question: {
      speaker: 'Escuchar la palabra otra vez',
      right: (gloss: string) => `Correcto. ${gloss.charAt(0).toUpperCase()}${gloss.slice(1)}.`,
      reveal: (gloss: string) => `Esta no. La respuesta es ${gloss}.`,
      tryAnother: 'Esta no. Prueba otra.',
      topic: (title: string) => `Tema: ${title}`,
      rightPlain: 'Correcto.',
      revealPlain: 'Esta no.',
    },
  },
  report: {
    periods: 'Periodo del informe',
    periodChanged: (window: string) => `Se muestra: ${window}`,
    periodChangedAll: 'Se muestra el total',
    step: (window: string) => `Ver ${window}`,
    calendar: (days: string) => `Practicó: ${days}.`,
    calendarNone: 'No hay días de práctica en este periodo.',
    notSaved: (days: string) => `Aún sin guardar: ${days}.`,
    growthTable: 'Misiones y tarjetas por mes',
    loading: 'Cargando el informe',
  },
  notes: {
    card: (sender: string, preset: string) => `Nota nueva de ${sender}: ${preset} Leer.`,
    cardMany: (n: number, sender: string) =>
      `${plural('es', n, { one: '1 nota nueva', other: `${n} notas nuevas` })}. La más reciente es de ${sender}. Leer.`,
    row: (sender: string, preset: string, date: string, isNew: boolean) => `${isNew ? 'Nueva. ' : ''}De ${sender}, ${date}. ${preset}`,
    answer: (label: string) => `Tu respuesta: ${label}`,
    reactionPicked: (label: string) => `Elegiste: ${label}`,
    questCard: (title: string) => `Prueba esta misión: ${title}`,
  },
  shell: {
    redirecting: 'Te llevamos a tu inicio…',
  },
} satisfies DeepPartial<Messages['a11y']>;
