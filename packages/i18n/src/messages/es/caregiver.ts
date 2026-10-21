import { plural } from '../../plural';
import type { DeepPartial, Messages } from '../../types';

/**
 * Spanish grown-up surfaces (F-I18N-001 PR 15): PIN screens, the Family Dashboard, the learner Plan screen
 * (status only: no price, no purchase word), classes and backup, Restore, Save my progress, Join a class, the
 * install sheet, the level-check report, Learning Route about a learner and the notes zone. Neutral
 * international Spanish, "tú", no gendered adjective about a person; names and counts arrive as arguments.
 */
export const caregiver = {
  gating: {
    'unknown-quest': (_learnerName: string) => 'Esa misión aún no está disponible.',
    'episode-not-shipped': (_learnerName: string) => 'Ese episodio aún está en construcción.',
    'stage-locked': (learnerName: string) => `${learnerName} aún no llega a esta misión.`,
    'quest-closed': (learnerName: string) => `${learnerName} puede jugar esta lección con el Plan Familiar o una Licencia de Grupo.`,
  },
  audience: {
    shared: {
      installGuideLine: 'Agrégame a tu pantalla de inicio.',
      journeyLockedA11y: (stageTitle: string) => `${stageTitle}: bloqueada. Abre la página para desbloquear.`,
      homeReviewsIdle: 'Repasos elegidos para ti',
      homeworkIntro: 'Elegida por Hoya, tu docente o tu familia.',
      restorePrompt: '¿Tienes un código de rescate, una cuenta o un archivo guardado?',
      restoreSignInLabel: 'Entrar',
      restoreCardsBack: 'Tus tarjetas vuelven con tu código de rescate.',
      spacesNoClass: 'Aún no estás en una clase. ¿Tienes un código de tu docente o tu familia?',
      joinCodeFull: 'Ya estás en tres clases. Primero sal de una en Clases y familia, en tu Perfil.',
      joinCodeNotForLearners: 'Ese código no es para unirte como estudiante. Pide un código de clase.',
      profileSwitchHint: 'Toca un perfil para cambiar.',
    },
    family: {
      installGuideHelp: 'Un adulto puede ayudar.',
      zoneLabel: 'Zona de adultos',
      pinVerifyTitle: 'Zona de adultos',
      pinCreateTitle: 'Crea un PIN de adultos',
      pinCreateSubtitle: 'Elige 4 dígitos que solo sepan los adultos. Protege los ajustes y las páginas para adultos.',
    },
    self: {
      zoneLabel: 'Cuenta y copia',
      pinVerifyTitle: 'PIN de ajustes',
      pinCreateTitle: 'Crea un PIN',
      pinCreateSubtitle: 'Elige 4 dígitos para proteger los ajustes.',
    },
    gated: (base: string, pinRequired: boolean, detail?: string) => {
      const parts = [detail, pinRequired ? 'requiere PIN' : undefined].filter((p): p is string => p !== undefined);
      return parts.length === 0 ? base : `${base} (${parts.join(', ')})`;
    },
  },

  pin: {
    mismatch: 'No coinciden. Empecemos otra vez.',
    cooldown: (seconds: number) => `Tomemos un descanso corto. Reintenta en ${seconds} s.`,
    cooldownMinutes: (n: number) => `Tomemos un descanso corto. Reintenta en ${n} min.`,
    cooldownHelp: 'También puedes crear un PIN nuevo con Olvidé el PIN.',
    resetByWaitNotice: 'El PIN de adultos se cambió después de la espera de 24 horas. Si no fuiste tú, cámbialo ahora.',
    resetByWaitChange: 'Cambiar el PIN',
    entry: {
      createAgain: 'Escríbelo otra vez',
      verifySubtitle: 'Escribe tu PIN de 4 dígitos para continuar.',
      createAgainSubtitle: 'Escribe los mismos 4 dígitos otra vez.',
      triesLeft: (left: number) =>
        plural('es', left, { one: `Casi. Te queda ${left} intento.`, other: `Casi. Te quedan ${left} intentos.` }),
      unlock: { cta: 'Desbloquear' },
      forgot: { cta: 'Olvidé el PIN' },
    },
    setup: { again: 'Escríbelo otra vez', set: 'PIN listo', change: 'Cambiar' },
    reset: {
      title: 'Restablecer el PIN',
      subtitle: 'Tus estudiantes, tarjetas y progreso se conservan.',
      code: {
        heading: 'Usa un código de rescate',
        placeholder: 'TIGER-MOON-RIVER-APPLE-482139',
        formats: 'Cuatro palabras y seis dígitos. Códigos anteriores: dos palabras y cuatro dígitos.',
      },
      noCode: { cta: 'No tengo el código' },
      wait: {
        heading: 'Espera 24 horas',
        idle: {
          caption: 'Mientras tanto, tu PIN sigue funcionando. Después de 24 horas puedes crear uno nuevo.',
          button: 'Empezar la espera',
        },
        waiting: { caption: (readyAt: string) => `Puedes crear un PIN nuevo después de ${readyAt}.`, button: 'Espera iniciada' },
        ready: { caption: 'Ya pasaron las 24 horas.', button: 'Crear un PIN nuevo' },
      },
      failure: {
        wrongCode: 'Ese no es el código guardado en este dispositivo. Revísalo y reintenta.',
        noCode: 'No hay un código de rescate guardado en este dispositivo. Usa la espera de 24 horas.',
        badFormat: 'Escribe cada palabra y el número, como TIGER-MOON-RIVER-APPLE-482139 (códigos anteriores: TIGER-MOON-4821).',
      },
    },
  },

  dashboard: {
    persona: 'Familia o quien cuida',
    readOnly: 'Solo lectura: estudiantes de este dispositivo.',
    aboutRows: { cta: 'Sobre estas filas' },
    noProfiles: 'Aún no hay perfiles.',
    stats: { quests: 'Misiones', cards: 'Tarjetas', sessions: 'Sesiones', minutes: 'Minutos' },
    recent: 'Reciente',
    words: {
      label: 'Palabras',
      counts: (collected: number, strong: number) =>
        `${plural('es', collected, { one: `${collected} conseguida`, other: `${collected} conseguidas` })}, ${plural('es', strong, { one: `${strong} firme`, other: `${strong} firmes` })}`,
      firstTry: (percent: number) => `Acierto a la primera: ${percent} %`,
      together: 'Para ver en familia',
    },
    privacy: {
      title: 'Privacidad',
      body: 'El apodo y el progreso de cada estudiante se guardan en el dispositivo y se respaldan en nuestros servidores, para recuperarlos con un código de rescate. Cuando un estudiante se une a una clase o familia con un código, ese espacio ve el nombre con que se une y su progreso. Los adultos de una familia también pueden recuperar su progreso. No compartimos nada con terceros.',
      bodyDeviceOnly:
        'El apodo y el progreso de cada estudiante se guardan en este dispositivo. Esta versión no tiene guardado en la nube, así que usa "Copia en un archivo" para tener una copia. No compartimos nada con terceros.',
    },
    browse: {
      open: { cta: 'Abrir las lecciones' },
      preview: { cta: 'Ver las lecciones' },
      storageBlocked: 'Tu navegador bloqueó el almacenamiento de esta página. Aquí no se pueden abrir las lecciones.',
    },
  },

  plan: {
    title: 'Plan',
    learnerFallback: 'Tu estudiante',
    covered: {
      title: {
        family: (name: string, source: string) => `${name} tiene acceso con ${source}.`,
        self: (source: string) => `Tienes acceso con ${source}.`,
      },
      note: { family: 'Todo está abierto mientras siga ahí.', self: 'Todo está abierto mientras sigas ahí.' },
      sourceFallback: 'la clase',
    },
    full: {
      title: { family: (name: string) => `${name} tiene la ruta completa.`, self: 'Tienes la ruta completa.' },
      fromFamily: { family: 'Gracias al Plan Familiar de tu familia.', self: 'Gracias a tu Plan Familiar.' },
      noSource: 'Todo está abierto.',
    },
    free: {
      title: { family: (name: string) => `${name} tiene el plan gratuito.`, self: 'Tienes el plan gratuito.' },
      open: 'La Etapa 1 siempre es gratis.',
    },
    openBilling: {
      cta: 'Abrir facturación',
      caption: {
        family: 'Los planes y recibos están en la página de facturación para adultos.',
        self: 'Tu plan y tus recibos están en la página de facturación.',
      },
      a11yHint: 'Abre la página de facturación',
    },
    openFailed: (url: string) => `Abre ${url} en un navegador.`,
    needsConnection: 'Para abrir la facturación hace falta conexión.',
    gateDone: 'PIN aceptado. Toca Abrir facturación otra vez.',
    backToJourney: { cta: 'Volver al recorrido' },
    backToLibrary: { cta: 'Volver a la colección' },
    backHome: { cta: 'Ir al inicio' },
    back: { cta: 'Volver' },
    freePlan: {
      line: (lessons: number, letters: number, minutes: number) =>
        `La Etapa 1 es gratis: ${plural('es', lessons, { one: `${lessons} lección`, other: `${lessons} lecciones` })}, ${plural('es', letters, {
          one: `${letters} letra`,
          other: `${letters} letras`,
        })}, cerca de ${plural('es', minutes, { one: `${minutes} minuto`, other: `${minutes} minutos` })}. Todo lo terminado se queda.`,
      lineNoLetters: (lessons: number, minutes: number) =>
        `La Etapa 1 es gratis: ${plural('es', lessons, { one: `${lessons} lección`, other: `${lessons} lecciones` })}, cerca de ${plural('es', minutes, {
          one: `${minutes} minuto`,
          other: `${minutes} minutos`,
        })}. Todo lo terminado se queda.`,
      stories: (n: number) => plural('es', n, { one: `${n} historia corta`, other: `${n} historias cortas` }),
      topics: (n: number) => plural('es', n, { one: `${n} tema de palabras`, other: `${n} temas de palabras` }),
      classLine: {
        family: (name: string) => `En la clase de ${name}, su docente puede abrir todas las lecciones.`,
        self: 'En tu clase, tu docente puede abrir todas las lecciones.',
      },
      freeEnd: {
        family: (name: string) => `${name} terminó las lecciones gratuitas.`,
        self: 'Terminaste las lecciones gratuitas.',
      },
      setPlan: 'Crea un plan para guiar lo que sigue.',
      setPlanWeb: 'Los planes se crean en la zona de adultos: Planear este periodo.',
    },
  },

  spaces: {
    title: 'Clases y familia',
    kind: { family: 'Familia', class: 'Clase', school: 'Escuela' },
    leave: {
      cta: 'Salir',
      stay: 'Quedarme',
      confirmTitle: (name: string) => `¿Salir de ${name}?`,
      confirmMessage: 'Tus tarjetas y estrellas se quedan contigo. Puedes volver a unirte con el código.',
    },
    join: { cta: 'Unirme a una clase' },
  },

  backup: {
    title: 'Copia del progreso',
    save: { cta: 'Guardar mi progreso', detail: 'código de rescate' },
    file: { cta: 'Copia en un archivo' },
    restore: { cta: 'Recuperar de un archivo' },
    note: {
      ready: 'Archivo de copia listo.',
      unavailable: 'Aquí no se pueden guardar archivos.',
      failed: 'No se pudo crear el archivo. ¿Reintentar?',
    },
  },

  retry: {
    tooManyAttempts: 'Esperemos unos minutos antes de reintentar.',
    offline: 'Esto necesita internet. Reintenta cuando tengas conexión.',
    unknown: 'Algo salió mal. Reintenta en un momento.',
  },

  sync: {
    status: {
      deviceOnly: 'Guardado solo en este dispositivo.',
      needsRescueCode: 'Guardado en este dispositivo. Un código de rescate activa aquí el guardado en la nube.',
      retrying: 'No se pudo llegar a la nube. Se volverá a intentar.',
      saving: 'Guardando en la nube…',
      waiting: 'Esperando el primer guardado en la nube.',
      justNow: 'Guardado en la nube · hace un momento',
      minutesAgo: (minutes: number) =>
        plural('es', minutes, {
          one: `Guardado en la nube · hace ${minutes} min`,
          other: `Guardado en la nube · hace ${minutes} min`,
        }),
    },
    saveNow: {
      saved: 'Guardado en la nube.',
      off: 'Esta versión no tiene guardado en la nube.',
      needsRescueCode: 'Este dispositivo aún no puede guardar en la nube. Un código de rescate lo activa.',
      unreachable: 'No se pudo llegar a la nube. Reintenta más tarde.',
    },
  },

  restore: {
    title: 'Recuperar el progreso',
    code: {
      cta: 'Tengo un código de rescate',
      placeholder: 'Palabras y luego el número',
      example: 'Como TIGER-MOON-RIVER-APPLE-482139. Los códigos anteriores son como TIGER-MOON-4821.',
      find: { cta: 'Buscar mis tarjetas' },
      looking: { cta: 'Buscando…' },
      notFound: 'Revisa el código y reintenta.',
    },
    cloudOff: 'Esta versión no tiene recuperación desde la nube.',
    cloudOffUseFile: 'Esta versión no tiene recuperación desde la nube. Usa un archivo guardado.',
    signIn: { comingSoon: 'Muy pronto' },
    file: {
      cta: 'Abrir un archivo guardado',
      openFailed: 'No se pudo abrir ese archivo.',
      newerVersion: 'Esta copia viene de una versión más nueva. Primero actualiza la app.',
      unreadable: 'No se puede leer este archivo. Elige una copia .hangulroute.json.',
    },
    startFresh: { cta: 'Mejor empezar de cero' },
    great: { cta: 'Genial' },
    notice: {
      created: (name: string) => `¡Hola de nuevo, ${name}! Tu recorrido está aquí.`,
      nothingNew: (name: string) => `${name} ya tiene todo lo de este archivo.`,
      added: (name: string, cards: number, quests: number) => {
        const parts = [
          cards > 0 ? plural('es', cards, { one: `${cards} tarjeta`, other: `${cards} tarjetas` }) : null,
          quests > 0 ? plural('es', quests, { one: `${quests} misión`, other: `${quests} misiones` }) : null,
        ].filter((p): p is string => p !== null);
        return `¡Encontramos el progreso de ${name}! Añadimos ${parts.join(' y ')}.`;
      },
      relinked: (name: string) => `¡Hola de nuevo, ${name}! Ya estás otra vez en la clase.`,
    },
  },

  saveProgress: {
    title: 'Guardar mi progreso',
    bubble: {
      code: (name: string | null) =>
        name === null
          ? 'Anota esto. Recupera tus tarjetas en cualquier dispositivo.'
          : `Anota esto. Recupera las tarjetas de ${name} en cualquier dispositivo.`,
      noCode: 'Cuando el progreso se guarde en la nube, aquí aparecerá un código de rescate.',
    },
    codeShape: (words: number, digits: number) => `${words === 4 ? 'cuatro' : 'dos'} palabras + ${digits} dígitos`,
    copy: { cta: 'Copiar', done: 'Copiado.', unavailable: 'Aquí no se puede copiar: anótalo.' },
    share: {
      cta: 'Compartir',
      title: 'Código de rescate',
      text: (name: string | null, code: string) => `Código de rescate de Hangul Route de ${name ?? 'mi estudiante'}: ${code}`,
      unavailable: 'Aquí no se puede compartir: cópialo.',
    },
    saveNow: { cta: 'Guardar ya', saving: { cta: 'Guardando…' } },
    rotate: {
      cta: 'Pedir un código nuevo',
      caption: 'El código anterior deja de funcionar.',
      confirmTitle: '¿Pedir un código nuevo?',
      confirmMessage: 'El código anterior dejará de funcionar. Anota el nuevo.',
      keep: { cta: 'Mantener mi código' },
      ready: 'El código nuevo está listo. El anterior ya no funciona.',
      unavailable: 'Ahora no se pudo obtener un código nuevo.',
    },
  },

  join: {
    title: 'Unirme a una clase',
    bubble: {
      idle: 'Escribe el código que te dio tu docente.',
      found: (space: string) => `¡Encontramos ${space}!`,
      done: (space: string) => `¡Ya estás en ${space}!`,
    },
    code: {
      placeholder: 'ABC123',
      rules: '6 letras o números, sin O, I, 0 ni 1',
      join: { cta: 'Unirme' },
      looking: { cta: 'Buscando…' },
    },
    confirm: {
      seeYouAs: { family: 'Tu familia te verá como:', teacher: 'Tu docente te verá como:' },
      sameEverywhere: 'Este nombre es el mismo en todas partes, no solo aquí.',
      nameLocked: 'El nombre se puede cambiar en Editar perfil.',
      me: { cta: 'Soy yo' },
      joining: { cta: 'Uniéndote…' },
      alreadyIn: { cta: 'Ya estaba en esta clase' },
      notThis: { cta: 'No es esta' },
    },
    pick: {
      prompt: '¿Cuál eres tú? Tu docente lo revisará.',
      newHere: { cta: 'Es mi primera vez' },
    },
    waiting: {
      line: (name: string) => `Esperando a que tu docente diga que sí para ${name}.`,
      caption: 'Pídele que abra la clase en su pantalla. Esta solicitud dura unos 10 minutos.',
      neverMind: { cta: 'Mejor no' },
    },
    relink: {
      denied: 'Tu docente dijo que ahora no. Pregúntale en clase.',
      expired: 'Tardó demasiado. Pregúntale a tu docente y reintenta.',
    },
    done: {
      joined: (space: string) => `Ya estás en ${space}. Pueden aparecer misiones nuevas en Hoy.`,
      already: (space: string) => `Ya estás en ${space}.`,
      backToToday: { cta: 'Volver a hoy' },
    },
    errors: {
      codeNotFound: 'Ese código no funcionó. Revísalo con tu docente.',
      codeExpired: 'Ese código es muy antiguo. Pide uno nuevo.',
      classFull: 'Esta clase está llena. Pregúntale a tu docente.',
      familyFull: (cap: number) => `Esta familia ya tiene ${cap} estudiantes. Pregúntale a un adulto de tu familia.`,
      schoolFull: 'Esta escuela está llena por ahora. Pregúntale a tu docente.',
      learnerGone: 'Ese nombre ya no está en esta clase. Pregúntale a tu docente.',
      alreadyOnDevice: 'Este dispositivo ya tiene a ese estudiante: cambia de perfil.',
      badFormat: 'Un código tiene 6 letras o números.',
      off: 'Esta versión no permite unirse a una clase.',
    },
    /** [OA] "¿Quién se une?" (AMENDMENTS-ONE-ACCOUNT-MANY-USERS 17.4, OA-7b): estudiante, adultos, unirse; el nombre delante, con dos puntos. */
    who: {
      title: '¿Quién se une?',
      hint: 'Elige a cada estudiante de este dispositivo que se unirá.',
      result: (joined: number, total: number) =>
        plural('es', joined, { one: `Se unió ${joined} de ${total}.`, other: `Se unieron ${joined} de ${total}.` }),
      joined: (name: string) => `${name} se unió.`,
      already: (name: string) => `${name} ya está en esta familia.`,
      refused: (name: string, line: string) => `${name}: ${line}`,
      takesPlace: 'Ocupa un lugar en la familia.',
      classOnly: 'En este dispositivo solo está en una clase.',
      retry: 'Reintentar',
      consentTitle: (space: string) => `¿Unirse a ${space}?`,
      consentLine: (name: string) => `${name}: al unirse, su progreso se guarda en la cuenta.`,
      consentSees: 'Los adultos de la familia verán cada nombre y su progreso.',
      consentYes: 'Sí, unirse',
      notNow: 'Ahora no',
    },
  },

  install: {
    offline: 'Así Hangul Route se abre como una app y tus tarjetas están seguras, incluso sin wifi.',
    steps: {
      share: 'Toca Compartir',
      addToHome: 'Agregar a inicio',
      browserMenu: 'Menú del navegador',
      installApp: 'Instalar app / Agregar a inicio',
    },
    install: { cta: 'Instalar' },
    inAppBrowser: 'Primero abre esta página en Safari o Chrome.',
    copyLink: { cta: 'Copiar enlace' },
    linkCopied: { cta: 'Enlace copiado' },
    notNow: { cta: 'Ahora no' },
  },

  placementReport: {
    title: 'Punto de partida',
    whatWeSaw: 'Lo que vimos',
    strand: {
      'hangul-recognition': 'Letras (formas)',
      'sound-letter': 'Sonidos de las letras',
      'syllable-reading': 'Leer sílabas',
      vocabulary: 'Palabras',
      sentences: 'Oraciones',
    },
    status: { secure: 'firme', gettingThere: 'en camino', notYet: 'aún no', notTested: 'sin revisar' },
    rung: {
      recog: 'Formas de las letras',
      'sound-basic': 'Primeros sonidos',
      'syl-cv': 'Sílabas simples',
      'sound-rest': 'Más sonidos',
      'syl-cvc': 'Sílabas con final',
      vocab: 'Palabras',
      sentence: 'Oraciones',
    },
    form: { decode: 'lectura', read: 'lectura', oral: 'escucha' },
    count: (correct: number, asked: number) => `${correct} de ${asked}`,
    notTestedReason: {
      noSound: 'No se revisó la escucha: este dispositivo no tiene sonido.',
      soundGuide: 'No se revisó la lectura: la guía de sonido estaba siempre visible.',
      screenReader: 'No se revisaron las formas de las letras: había un lector de pantalla activo.',
      screenReaderPictures:
        'No se revisaron las palabras ni las oraciones: un lector de pantalla no puede leer sus opciones con imágenes en coreano.',
      endedEarly: 'La prueba terminó antes, así que no se llegó a algunas partes.',
    },
    shortNotTested: 'Las formas de las letras y las oraciones no están en la prueba corta.',
    notTestedShort: 'sin revisar (prueba corta)',
    shortHint: 'La prueba corta solo ve las primeras letras. La prueba estándar puede encontrar un punto de partida más adelante.',
    tryStandard: 'Probar la prueba estándar',
    checkedTwice: 'revisado dos veces',
    notFinished: 'sin terminar',
    spellingTiles: 'Deletrear con fichas',
    onlyForward: 'Una prueba nueva solo puede mover la ruta hacia adelante.',
    takenOn: (date: string, language: string) => `Hecha el ${date}, en ${language}`,
    whereStarts: 'Dónde empieza la ruta',
    changedByGrownUp: 'Cambiado por un adulto',
    takeAgain: 'Hacer la prueba otra vez',
    takeFirst: 'Hacer la prueba de nivel',
    noCheck: 'Aún no hay ninguna prueba.',
    retryHidden: 'Probar con la guía de sonido oculta',
    needsStage: (name: string, stage: number) =>
      `${name} ya puede empezar la Etapa ${stage}. Las lecciones de la Etapa ${stage} aún no están incluidas en esta cuenta.`,
    noStart: (name: string) => `${name} sabe todo lo que está abierto ahora. Viene más.`,
    examples: { known: 'Sabe', fresh: 'Nuevas por ahora' },
    chooseStart: 'Elegir otro inicio',
    sheet: {
      title: 'Elegir otro inicio',
      help: 'Las misiones antes de la que elijas se saltan. Esa y todas las siguientes quedan en la ruta.',
      state: { start: 'empieza aquí', done: 'hecha', placedOut: 'saltada' },
    },
    saved: 'El inicio cambió.',
    row: { label: 'Punto de partida', seeCheck: 'Ver la prueba' },
    plan: {
      title: (name: string) => `Plan semanal sugerido para ${name}`,
      basis: (level: string, days: number, minutes: number) =>
        plural('es', days, {
          one: `Según: ${level}, 1 día por semana, ${minutes} minutos`,
          other: `Según: ${level}, ${days} días por semana, ${minutes} minutos`,
        }),
      paceTitle: 'Ritmo',
      lengthTitle: 'Duración',
      suggested: 'Sugerido',
      headsUp: 'Ten en cuenta',
      warning: {
        notIncluded: (count: number) =>
          plural('es', count, {
            one: '1 lección todavía no está incluida en esta cuenta y no está en el plan.',
            other: `${count} lecciones todavía no están incluidas en esta cuenta y no están en el plan.`,
          }),
        notReleased: (count: number) =>
          plural('es', count, {
            one: '1 episodio todavía no salió. Empieza cuando salga.',
            other: `${count} episodios todavía no salieron. Empiezan cuando salgan.`,
          }),
        runsOut: (week: number) => `Desde la semana ${week} todavía no hay lecciones nuevas. La práctica libre llena esas semanas.`,
        didNotFit: (count: number) =>
          plural('es', count, {
            one: '1 lección no entró. Un plan más largo o más días la incluyen.',
            other: `${count} lecciones no entraron. Un plan más largo o más días las incluyen.`,
          }),
      },
      usePlan: 'Usar este plan',
      change: 'Cambiar',
      notNow: 'Ahora no',
      made: (name: string) => `${name} ya tiene un plan semanal. Aparece en Inicio.`,
      laterStart: (name: string) => `La última prueba de nivel de ${name} encontró un inicio más adelante.`,
      laterLine: 'El plan semanal puede avanzar y mantener la misma fecha final.',
      updatePlan: 'Actualizar el plan',
      updated: 'El plan semanal avanzó.',
      failed: 'No funcionó. Inténtalo de nuevo.',
      newStart: (name: string) => `El plan de ${name} puede seguir el inicio que elegiste.`,
      newStartLine: 'Los próximos días del plan siguen el nuevo inicio. La duración y la fecha final no cambian.',
      followed: 'El plan semanal sigue el nuevo inicio.',
    },
  },

  journey: {
    here: (name: string, n: number, title: string) => `${name} está en la Etapa ${n}: ${title}.`,
    next: (title: string) => `Siguiente: ${title}`,
    canDoLead: (name: string) => `Al final de esta etapa, ${name} podrá:`,
    started: (name: string) => `${name} empezó aquí.`,
    known: (name: string) => `${name} ya sabía esto.`,
    quests: (name: string, n: number) => `En ${plural('es', n, { one: '1 misión', other: `${n} misiones` })} que ${name} terminó`,
    viewing: (name: string) => `Viendo la Ruta de aprendizaje de ${name}`,
    tiles: (n: number) => `Deletrear con fichas: ${plural('es', n, { one: '1 misión', other: `${n} misiones` })}`,
    start: (name: string) => `La Ruta de aprendizaje de ${name} empieza aquí.`,
    goal: {
      first: 'Primera meta: leer cada letra del hangul.',
      inGoal: (name: string, n: number, title: string) => `Etapa ${n} · ${title}: ${name} está en la etapa meta`,
      exploreInGoal: (name: string, n: number, title: string) => `Explora la Etapa ${n} · ${title}: ${name} está en la etapa meta`,
      reached: (name: string, n: number, title: string) => `${name} llegó a la meta: Etapa ${n} · ${title}.`,
      from: {
        class: 'Del plan semanal de la clase',
        school: 'Del plan semanal de la escuela',
        family: 'Del plan semanal de la familia',
        self: (name: string) => `Del plan semanal de ${name}`,
        default: 'Sugerencia de Hoya',
      },
    },
    planEnds: (date: string) => `Fin del plan: ${date}`,
    goalTag: (name: string) => `Meta de ${name}`,
    endOfRoad: (name: string) => `${name} llegó al final del camino abierto. Viene más.`,
    error: (name: string) => `Hoya no pudo abrir la Ruta de aprendizaje de ${name}.`,
    rest: (name: string) => `${name} hizo todo lo que está abierto ahora. Viene más.`,
    beyond: (name: string) => `¡${name} sabe mucho! Vienen más aventuras.`,
    hereTag: (name: string) => `${name} está aquí`,
    ready: (_name: string) => 'Aún sin empezar',
    explored: (name: string) => `${name} exploró todo lo que está abierto ahora`,
    skillsTitle: (name: string) => `Qué practican las misiones de ${name}`,
    row: {
      title: 'Ruta de aprendizaje',
      now: (n: number, title: string) => `Ahora: Etapa ${n} · ${title}`,
      goal: (n: number, title: string) => `Meta: Etapa ${n} · ${title}`,
      started: (n: number, band: string, date: string) => `Empezó: Etapa ${n} · ${band} · ${date}`,
      cta: 'Ver la Ruta de aprendizaje',
    },
  },
  skillsNote:
    'La prueba de nivel revisa la lectura y la escucha. La escritura se practica con juegos de trazar y no se califica. Las filas cuentan las misiones terminadas que incluyen estos juegos; un juego saltado dentro de una misión también cuenta.',
  grownUpHome: {
    noPin: 'Este dispositivo no tiene PIN de adultos. Inicia sesión en la página para adultos.',
    continue: { cta: 'Continuar' },
    signIn: { family: 'Inicia sesión: herramientas de familia y clase', self: 'Inicia sesión en tu cuenta' },
  },
  access: {
    freeEnd: (name: string, product: string) => `${name} terminó las lecciones gratuitas. La Etapa 2 y las siguientes se abren con ${product}.`,
    product: {
      family: 'el Plan Familiar',
      class: 'una Licencia de Grupo',
      either: 'el Plan Familiar o una Licencia de Grupo',
    },
  },
  notes: {
    row: { title: (learner: string) => `Notas para ${learner}` },
    title: (learner: string) => `Notas para ${learner}`,
    empty: (learner: string) => `Aún no hay notas para ${learner}.`,
    putAway: 'Guardar en este dispositivo',
    status: { opened: 'Abierta' },
    hide: {
      cta: (learner: string) => `Ocultársela a ${learner}`,
      confirm: {
        title: (learner: string) => `¿Ocultarle esta nota a ${learner}?`,
        body: "Desaparece en todos los dispositivos. Quien la envió ve 'No se mostró'.",
        cta: 'Ocultar',
        cancel: { cta: 'Cancelar' },
      },
    },
    report: {
      cta: 'Reportar',
      title: 'Reportar esta nota',
      why: '¿Por qué?',
      reasons: {
        unkind: 'Hiriente',
        unsafe: 'Peligrosa',
        not_for_me: (learner: string) => `No es para ${learner}`,
        other: 'Otra cosa',
      },
      submit: { cta: 'Reportar y ocultar' },
      line: (learner: string) => `La nota desaparece para ${learner} en todos los dispositivos. Nuestro equipo revisa cada reporte.`,
      justHide: { cta: 'Solo ocultarla' },
      close: 'Cerrar',
      reported: 'Gracias. La nota ya no está.',
      emergency: 'Si alguien está en peligro, llama a los servicios de emergencia locales.',
      hidden: 'La nota está oculta.',
      done: { cta: 'Listo' },
      alreadyGone: 'Esta nota ya no está.',
      queued: 'No pudimos enviar el reporte. Lo intentaremos otra vez cuando tengas conexión.',
      tooMany: 'Demasiados reportes hoy. La nota está oculta en este dispositivo.',
    },
    mode: {
      title: 'Notas de las clases',
      options: { all: 'Todas', presets: 'Solo ánimos', off: 'Ninguna' },
      familyAlways: 'Las notas de tu familia siempre llegan.',
      classScoped: 'Cambia esto en un dispositivo de casa.',
    },
    oneTimeCard: {
      line: (mode: string) => `Notas de las clases: ${mode}.`,
      keep: { cta: 'Mantener' },
      change: { cta: 'Cambiar' },
    },
    disclosure: (learner: string) => `Los docentes ven la respuesta que ${learner} elige en sus notas.`,
    offline: 'Conéctate a internet para hacer esto.',
    saveFailed: 'No se guardó. Reintenta.',
    error: 'No se pudieron cargar las notas. Reintenta.',
    retry: { cta: 'Reintentar' },
    sendNote: { cta: 'Enviar una nota' },
  },
  /**
   * Class moves in the learner app (F-SPACE-002 T-7d): "cambio" for move and "docente" for teacher, as the console
   * frame (`console.transfer.consent`) and the consent lines (TRANSFER_CONSENT_TEXT.es) say; informal "tú".
   */
  transfer: {
    actions: {
      move: { cta: 'Cambiar' },
      review: { cta: 'Revisar' },
      setUpPin: { cta: 'Crear PIN' },
      find: { cta: 'Buscar clase' },
      sending: { cta: 'Enviando…' },
      notNow: { cta: 'Ahora no' },
      cancelRequest: { cta: 'Cancelar la solicitud' },
      cancelMove: { cta: 'Cancelar el cambio' },
      cancel: { cta: 'Cancelar' },
    },
    card: {
      classScope: 'Primero usa tu código de rescate.',
      askConsole: 'Pide al adulto que tiene la cuenta que responda en la consola.',
      needsPin: 'Primero un adulto debe crear un PIN. En Perfil, abre Para adultos y luego Zona de adultos.',
      pinTooNew: 'Los cambios se abren un día después de crear el PIN.',
      sourceAsked: (source: string) => `${source} preguntó por un cambio.`,
      learnerAsked: (destination: string) => `Pedido: un cambio a ${destination}.`,
    },
    lines: {
      checkAgain: 'Revísalo de nuevo, por favor.',
      waitingOther: 'Esperando la respuesta de la otra clase.',
      waitingClasses: 'Esperando la respuesta de las clases.',
      waitingRoom: 'Esperando lugar en la nueva clase.',
      cannotAnswer: 'Este cambio no se puede responder aquí.',
      planned: (date: string) => `Hay un cambio planeado para el ${date}.`,
      ended: 'Esta solicitud terminó.',
      joinAgain: 'Únete de nuevo a tu nueva clase.',
      moved: (name: string, destination: string) => `Cambio hecho. ${name} ya está en ${destination}. Las tarjetas y las estrellas se quedaron con ${name}.`,
      askedMoving: (source: string, name: string, destination: string) => `${source} preguntó por cambiar a ${name} a ${destination}.`,
      consoleAnswers: 'Un adulto con cuenta responde esto en la consola.',
      notNowEnds: '"Ahora no" termina esta solicitud.',
    },
    move: {
      title: 'Cambiar a otra clase',
      step1: 'Pide el código a quien enseña en la nueva clase.',
      codeLabel: 'Código de clase',
      sent: 'Solicitud enviada. Nada cambia hasta que todas las partes digan que sí.',
    },
    errors: {
      codeNotFound: 'Ese código no funcionó.',
      codeExpired: 'Ese código es muy viejo. Pide uno nuevo.',
      full: 'Esa clase está llena ahora.',
      alreadyMember: (name: string) => `${name} ya está en esa clase.`,
      tooManyAttempts: 'Muchos intentos. Inténtalo más tarde.',
      cooldown: 'Puedes pedirlo de nuevo en una semana, más o menos.',
      caregiverRequired: 'Pide al adulto que tiene la cuenta que empiece este cambio en la consola.',
      deviceConsentLocked: 'Todavía no se pueden empezar cambios en este dispositivo.',
      alreadyOpenClass: (name: string) => `Una clase ya preguntó por cambiar a ${name}. Mira la tarjeta Clases y familia.`,
      alreadyOpenLearner: (name: string) => `Ya hay un cambio pendiente para ${name}. Mira la tarjeta Clases y familia.`,
      sameSpace: (name: string) => `Ese código es de la clase donde está ${name} ahora.`,
      notTransferable: 'Ese código no sirve para un cambio.',
      destinationBusy: 'Esa clase tiene muchos cambios pendientes. Inténtalo en unos días.',
      tooManyRequests: 'Hoy se empezaron muchos cambios. Inténtalo mañana.',
      localeUnavailable: 'Aún no está disponible en tu idioma.',
      updateApp: 'Actualiza la app para ver el texto nuevo.',
    },
    consent: {
      titleSelf: (destination: string) => `¿Cambiarte a ${destination}?`,
      yesSelf: 'Sí, cambiarme',
    },
    readOnly: { title: 'Hay un cambio pendiente' },
    home: {
      learnerWaiting: (destination: string) => `Hay un cambio a ${destination} pendiente.`,
      selfWaiting: 'Hay un cambio pendiente para ti.',
    },
    a11y: {
      review: 'Revisar el cambio',
      move: (space: string) => `Cambiar desde ${space}`,
    },
  },
  browse: {
    documentTitle: 'Lecciones de Hangul Route',
    home: {
      title: 'Las lecciones',
      close: { cta: 'Cerrar' },
      howTo: 'Toca una lección para ver qué enseña y luego pruébala. No se guarda nada.',
      lessonDisplay: { cta: 'Romanización' },
      offline: 'Sin red',
      scope: {
        sampler: 'Las lecciones gratis de tu estudiante están abiertas. Las demás muestran lo que enseñan.',
        fallback: 'Mostramos las lecciones gratis. No pudimos revisar tu plan.',
      },
      pointer: 'Para ver cómo va tu estudiante, abre tu página de inicio.',
      note: {
        letterAcrossStage1: 'Esta letra se practica en toda la Etapa 1.',
        notInVersion: 'Esta lección aún no está en esta versión de la app.',
        dismiss: 'Descartar',
      },
      section: {
        label: 'Ver lecciones por',
        route: 'Ruta',
        journey: 'Recorrido',
        library: 'Colección',
      },
      stages: {
        line: (n: number) => `${n} etapas, de las letras a tus propias palabras`,
        item: (order: number, title: string) => `Etapa ${order} · ${title}`,
      },
      routeRowA11y: (rowLabel: string) => `${rowLabel} Lo muestra en el Recorrido.`,
      themes: 'Temas',
      cardSlotA11y: (rarity: string, title: string, ko: string, romanization: string) => `${rarity}, ${title}, ${ko} ${romanization}. Abre la tarjeta.`,
      wordCount: (n: number) => plural('es', n, { one: `· ${n} palabra`, other: `· ${n} palabras` }),
      wordsRowA11y: (topic: string, n: number) =>
        plural('es', n, { one: `${topic}, ${n} palabra. Abre el tema.`, other: `${topic}, ${n} palabras. Abre el tema.` }),
      wordsRowClosedA11y: (topic: string, n: number) =>
        plural('es', n, { one: `${topic}, ${n} palabra. Aún sin abrir. Abre el tema.`, other: `${topic}, ${n} palabras. Aún sin abrir. Abre el tema.` }),
      storyTileA11y: (title: string, minutes: number) =>
        `${title}. ${plural('es', minutes, { one: `Cerca de ${minutes} minuto`, other: `Cerca de ${minutes} minutos` })}.`,
    },
    keep: {
      label: 'Guardar las lecciones en este dispositivo por 7 días, también sin conexión',
      failed: 'No se pudieron guardar las lecciones en este dispositivo.',
    },
    display: {
      title: 'Romanización',
      always: 'Siempre visible',
      tap: 'Oculta hasta tocar',
      note: 'Estas opciones cambian solo esta vista previa. La configuración de los estudiantes no cambia.',
      done: { cta: 'Listo' },
    },
    episode: {
      back: 'Volver a todas las lecciones',
      stagePill: (order: number, title: string) => `Etapa ${order} · ${title}`,
      lessons: 'Lecciones',
      stories: 'Historias',
      cards: 'Tarjetas de este episodio',
      comingLater: 'Más adelante',
      open: { cta: 'Abrir' },
      openA11y: (title: string) => `Abrir ${title}`,
      storyMeta: (levels: number, scenes: number) =>
        `${plural('es', levels, { one: `${levels} nivel`, other: `${levels} niveles` })} · ${plural('es', scenes, { one: `${scenes} escena`, other: `${scenes} escenas` })}`,
    },
    cardRowA11y: (title: string, ko: string, romanization: string) => `${title}, ${ko} ${romanization}. Abre la tarjeta.`,
    minutes: (n: number) => plural('es', n, { one: `Cerca de ${n} minuto`, other: `Cerca de ${n} minutos` }),
    item: {
      back: 'Atrás',
      kind: { quest: 'Lección', story: 'Historia', vocabTopic: 'Palabras' },
      teaches: 'Qué enseña',
      where: {
        title: 'Dónde está',
        stage: (order: number) => `Etapa ${order}`,
        lesson: (n: number, of: number) => `lección ${n} de ${of}`,
        see: { cta: 'Ver en el Recorrido' },
      },
      card: 'La tarjeta que da',
      focus: 'Se enseña aquí:',
      focusChipA11y: (letter: string, romanization: string) => `${letter}, ${romanization}, se enseña aquí`,
      preview: { cta: 'Vista previa de la lección' },
      previewStory: { cta: 'Vista previa de la historia' },
      previewQuestions: { cta: 'Vista previa: preguntas' },
      present: { cta: 'Proyectar' },
      presentNote: 'Abre esto como diapositivas para una pantalla de clase o un televisor. No cambia el progreso de nadie.',
      presentBlocked: 'La pestaña nueva no se abrió. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.',
      closed: 'Se abre con el Plan Familiar o una Licencia de Grupo',
      openBilling: { cta: 'Abrir facturación' },
      wordCount: (n: number) => plural('es', n, { one: `${n} palabra`, other: `${n} palabras` }),
    },
    facts: {
      letters: 'Letras',
      words: 'Palabras',
      syllables: 'Sílabas',
      skills: 'Destrezas',
      steps: 'Pasos',
      levels: 'Niveles',
      levelGroup: 'Nivel',
      level: { listen: 'Escuchar', readAlong: 'Leer escuchando', read: 'Leer' },
      scenes: 'Escenas',
      keywords: 'Palabras clave',
      sources: 'Fuentes',
      seeSources: { cta: 'Ver las fuentes' },
    },
    topic: {
      hearA11y: (romanization: string) => `Escuchar ${romanization}`,
      previewFlashcards: { cta: 'Vista previa de las tarjetas' },
    },
    preview: {
      strip: 'Vista previa. No se guarda nada.',
      leave: { cta: 'Cerrar vista previa' },
      leaveConfirm: {
        title: '¿Salir de esta vista previa?',
        keep: { cta: 'Seguir' },
        leave: { cta: 'Salir' },
      },
    },
    end: {
      lesson: {
        title: 'Esa es toda la lección.',
        line: 'Aquí un estudiante ve de 1 a 3 estrellas y recibe:',
        lineNoCard: 'Aquí un estudiante ve de 1 a 3 estrellas.',
      },
      story: {
        title: 'Esa es toda la historia.',
        line: 'Un estudiante puede leerla otra vez cuando quiera.',
      },
      next: { cta: 'Siguiente lección' },
      again: { cta: 'Repetir vista previa' },
      back: { cta: 'Volver a la lección' },
      nextStory: { cta: 'Otra historia' },
      readAgain: { cta: 'Leer otra vez' },
      backToStory: { cta: 'Volver a la historia' },
    },
    access: {
      title: 'Esta página es para madres, padres y docentes.',
      line: {
        gate: 'Tu tiempo en la zona de adultos terminó.',
        gateUntilIntent: 'Tu tiempo en la zona de adultos terminó. Vuelve a la app y abre otra vez la zona de adultos.',
        account: 'Abre las lecciones otra vez desde tu cuenta.',
        unknown: 'En un dispositivo familiar, ábrelas desde la zona de adultos. Las familias y los docentes también pueden abrirlas desde su cuenta.',
      },
      backToGrownUp: { cta: 'Volver a la zona de adultos' },
      backToApp: { cta: 'Volver a la app' },
      openFromAccount: { cta: 'Abrir desde mi cuenta' },
      signIn: { cta: 'Entrar' },
      offline: 'Las páginas para adultos necesitan internet.',
    },
  },
  /** [TV] La pantalla de novedades de clase en la zona de adultos (TV-D4, TV-D5). */
  classScope: {
    title: 'Novedades de clase',
    ok: { cta: 'OK' },
    saving: { cta: 'Guardando…' },
    offline: 'Esto necesita internet.',
    failed: 'No se guardó. Inténtalo de nuevo.',
    stale: 'Actualiza la app para leer la versión más nueva.',
  },
  /** La tarjeta Modo proyección en la zona de adultos de la app (AMENDMENTS-LECTURE-V2 sección 3 E5, sección 12.4). */
  lecture: {
    title: 'Modo proyección',
    body: 'Muestra una lección en una TV o una pantalla grande y aprende en familia. No cambia el progreso de nadie.',
    open: { cta: 'Abrir modo proyección' },
    next: (name: string) => `Siguiente lección para ${name}`,
    opensTab: 'Se abre en una pestaña nueva',
    blocked: 'La pestaña nueva no se abrió. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.',
  },
} satisfies DeepPartial<Messages['caregiver']>;
