import { plural } from '../../plural';
import type { DeepPartial, Messages } from '../../types';

/**
 * Spanish public site (F-I18N-001 PR 15): metadata, the layered home, the persona pages, About, the launch-news form
 * and the 404 links. Public surface (CLAUDE.md section 1): anyone, at any age; never kids-only framing and never an age
 * range (KIDS_ONLY_FRAMING). The Privacy Policy and Terms stay English-authoritative (decision L10): only their notice and
 * back link are translated here, never a leaf under `legal.privacy` or `legal.terms`. No price anywhere.
 */
const FAQ_ADULT = {
  q: 'Soy una persona adulta que empieza. ¿Se sentirá infantil?',
  a: 'No. La Etapa 1 enseña justo lo que cualquier principiante necesita primero, las letras y sus sonidos, sin lenguaje infantil. Hoya es amable, y las tarjetas de cultura valen la pena a cualquier edad.',
} as const;
const FAQ_KOREAN = {
  q: '¿Necesito saber algo de coreano?',
  a: 'No. Lo hicimos justo para empezar desde cero. Los menús usan palabras sencillas en inglés, español o coreano, y cada palabra coreana viene con su romanización y su significado.',
} as const;

export const landing = {
  meta: {
    title: 'Hangul Route: aprende hangul desde cero con Hoya',
    tagline: 'Aprende hangul desde cero, a cualquier edad.',
    description:
      'Aprende hangul desde cero con Hoya, el tigre, a cualquier edad. Misiones de cinco minutos enseñan el alfabeto coreano y luego palabras, oraciones y cuentos. La Etapa 1 es gratis. Sin anuncios, nunca.',
    keywords: ['aprender hangul', 'alfabeto coreano', 'aprender coreano', 'coreano para principiantes', 'coreano de herencia', 'cultura coreana', 'Hoya'],
    ogDescription: 'Aprende el alfabeto coreano desde cero con Hoya, el tigre, a cualquier edad, y colecciona tarjetas de cultura coreana. La Etapa 1 es gratis.',
    twitterDescription: 'Aprende el alfabeto coreano desde cero con Hoya, el tigre, a cualquier edad, y colecciona tarjetas de cultura coreana.',
    pages: {
      learners: {
        title: 'Para estudiantes: Hangul Route',
        description: 'Aprende a leer, escuchar y escribir hangul desde cero en misiones de cinco minutos con Hoya, el tigre, y colecciona tarjetas de cultura coreana. Sin anuncios.',
      },
      parents: {
        title: 'Para madres, padres y quien cuide: Hangul Route',
        description: 'Lecciones de hangul cortas y amables, sin anuncios y con un PIN de adultos. Crea un espacio familiar gratis y mira la semana de cada estudiante.',
      },
      teachers: {
        title: 'Para docentes: Hangul Route',
        description: 'Los estudiantes se unen con un código, un enlace o un código QR, sin correos ni cuentas de estudiantes. Planifica la semana y mira quién practicó. Nunca un ranking.',
      },
      about: {
        title: 'Acerca de Hangul Route',
        description: 'Quién hace Hangul Route y las promesas que cumplimos.',
      },
      privacy: {
        title: 'Política de privacidad: Hangul Route',
        description: 'Qué recoge Hangul Route, quién puede verlo y cómo borrarlo.',
      },
      terms: {
        title: 'Términos del servicio: Hangul Route',
        description: 'Las reglas para usar Hangul Route.',
      },
      licenses: {
        title: 'Avisos de código abierto: Hangul Route',
        description: 'El software de código abierto que usa Hangul Route.',
      },
    },
  },
  brand: {
    name: 'Hangul Route',
    mark: 'HR',
  },
  nav: {
    label: 'Menú',
    learners: 'Estudiantes',
    parents: 'Familias',
    teachers: 'Docentes',
    signIn: 'Entrar',
    start: 'Empezar a aprender',
    startShort: 'Empezar',
    skip: 'Ir al contenido',
  },
  home: {
    hero: {
      title: 'Aprende hangul desde cero, a cualquier edad.',
      lead: 'El hangul es el alfabeto coreano. Aprende a leerlo, escucharlo y escribirlo con Hoya.',
      start: 'Empezar a aprender',
      // [SN] Like the console's "Soy madre, padre, tutor o docente" (`console.signIn.create.affirm`).
      forParents: 'Soy madre, padre o tutor',
      forTeachers: 'Soy docente',
      facts: 'La Etapa 1 es gratis · Sin registro para empezar · Funciona sin conexión en la mayoría de los dispositivos después de tu primera visita',
      bubble: (letter: string, romanization: string) => `¡Hola! Conozcamos la letra ${letter}\u00a0(${romanization}).`,
      guest: 'Empieza tu primera misión ya. Añade un nombre al final.',
    },
    who: {
      title: '¿Para quién es?',
      items: {
        learners: {
          title: 'Estudiantes',
          body: 'Misiones de cinco minutos, una guía que nunca regaña y tarjetas de cultura coreana.',
        },
        parents: {
          title: 'Madres, padres y quien cuide',
          body: 'Mira qué practica tu estudiante, con un PIN de adultos y sin anuncios.',
        },
        teachers: {
          title: 'Docentes',
          body: 'Tus estudiantes se unen con código, enlace o QR. Sin cuentas de estudiante.',
        },
      },
    },
    how: {
      title: 'Cómo funciona',
      steps: {
        start: { title: 'Crea un perfil', body: 'Elige un nombre y un Hoya.', guestTitle: 'Empieza ya' },
        quests: { title: 'Aprende en misiones de cinco minutos', body: 'Letras, sonidos y primeras palabras, con sonido e imágenes.' },
        collect: {
          title: 'Colecciona y sigue adelante',
          body: 'Gana tarjetas de cultura coreana. Tu progreso se guarda y se respalda.',
          guestBody: 'Gana tarjetas de cultura coreana. Añade un nombre y tu progreso se guarda y se respalda.',
        },
      },
      routeBody: 'Gana tarjetas de cultura coreana y mira toda tu Ruta de aprendizaje: dónde estás y qué sigue.',
      levelBody: 'Elige un nombre y un Hoya. La prueba de nivel es opcional.',
      guestLevelBody: 'Juega tu primera misión. Después comprueba tu nivel.',
      guestStartBody: 'Juega tu primera misión y luego añade un nombre.',
    },
    promises: {
      label: 'Nuestras promesas',
      items: { ads: 'Cero anuncios', safety: 'Seguridad infantil primero', noRed: 'Sin marcas rojas' },
    },
    closing: {
      title: '¿Vamos por tu primera letra coreana?',
      body: 'La Etapa 1 es gratis. Sin correo ni contraseña. Tu primera misión dura unos cinco minutos.',
    },
    news: {
      title: 'Noticias del lanzamiento',
      body: 'Te escribiremos cuando lleguen los planes para familias y clases.',
    },
  },
  plans: {
    title: '¿Cuánto cuesta?',
    free: {
      stage1: 'La Etapa 1 es gratis.',
    },
    paid: {
      coming: 'En la app también hay palabras, oraciones y cuentos. Los planes para familias y clases están en camino.',
      inApp: 'Los planes para familias y clases están en app.hangulroute.com.',
    },
    managedInApp: 'Los planes y la facturación se gestionan en app.hangulroute.com después de iniciar sesión.',
    managedLater: 'Cuando lleguen los planes, los gestionarás en app.hangulroute.com después de iniciar sesión.',
    // [SA] AMENDMENTS-SEATS-ADMINS 9.5: glossary Plan Familiar, Licencia de Grupo, estudiante.
    sizes: (family: number, group: number) =>
      `El Plan Familiar es para hasta ${plural('es', family, { one: `${family} estudiante`, other: `${family} estudiantes` })}. La Licencia de Grupo es para hasta ${plural('es', group, { one: `${group} estudiante`, other: `${group} estudiantes` })} en una clase o una escuela.`,
  },
  persona: {
    learners: {
      title: 'Para estudiantes',
      lead: 'Aprende a leer, escuchar y escribir hangul, una misión de cinco minutos a la vez.',
      learn: {
        title: 'Lo primero que aprendes',
        body: 'La Etapa 1 es el alfabeto coreano: las letras, sus sonidos y cómo forman sílabas.',
        bullets: { read: 'Leer letras y sílabas', listen: 'Escuchar y unir sonidos', write: 'Escribir letras trazándolas' },
      },
      quest: {
        title: 'Cómo es casi cada misión',
        bullets: {
          discover: 'Descubre: mira y escucha una letra nueva.',
          play: 'Juega: minijuegos cortos que la usan.',
          check: 'Repasa: una ronda tranquila. Si te equivocas, ves un aviso ámbar, nunca rojo.',
        },
        hoya: 'Hoya, el tigre, guía cada misión y nunca dice “mal”.',
        gamesFold: 'Ver los minijuegos',
      },
      cards: {
        title: 'Colecciona cultura coreana',
        body: 'Cada letra que aprendes te da una tarjeta: un pedacito de la comida, el arte o la vida diaria de Corea.',
        seeAll: (cards: number) =>
          plural('es', cards, { one: 'Ver la tarjeta de la Etapa 1', other: `Ver las ${cards} tarjetas de la Etapa 1` }),
      },
      route: {
        title: 'Tu Ruta de aprendizaje',
        body: 'Un mapa muestra dónde empezaste, dónde estás y qué sigue.',
      },
      faq: {
        signIn: {
          q: '¿Los estudiantes inician sesión?',
          a: 'No hace falta correo ni contraseña. Abre la app y elige tu perfil, o escribe el código de tu clase o familia. ¿Cambias de dispositivo? Usa tu código de rescate.',
        },
        code: {
          q: 'Tengo un código para unirme. ¿Dónde lo escribo?',
          a: 'Abre el enlace para unirse que comparte tu docente. O, en la app, toca Perfil, ve a Clases y familia y toca Unirme a una clase.',
        },
        offline: {
          q: '¿Funciona sin conexión?',
          a: 'En la mayoría de los dispositivos, sí: después de tu primera visita la app se abre sin conexión. Los sonidos de las letras pueden necesitar una voz coreana instalada en tu dispositivo.',
        },
        adult: FAQ_ADULT,
        korean: FAQ_KOREAN,
        // The button label is learner.placement.invite.knowSome in Spanish, word for word; "prueba de nivel" as in the app.
        level: {
          q: 'Ya sé algo de hangul. ¿Tengo que empezar desde el principio?',
          a: 'No. Al comenzar, toca «Ya sé algo de coreano» y haz una prueba de nivel. Hoya te sugiere por dónde empezar.',
          guestA: 'No. Juega la primera misión, añade un nombre y luego toca «Hacer la prueba de nivel» en Inicio. Hoya te sugiere por dónde empezar.',
        },
      },
      after: {
        title: 'Después del alfabeto',
        body: 'Palabras, frases cortas, conversaciones e historias del patrimonio, en las mismas misiones de cinco minutos.',
      },
    },
    parents: {
      title: 'Para madres, padres y quien cuide',
      lead: 'También para abuelas, abuelos y toda persona que cuide: lecciones cortas y amables que mantienen privados los datos de tu estudiante.',
      // [SN] Buttons in the infinitive, as "Empezar a aprender" and the console's "Crear una clase".
      create: 'Crear un espacio familiar gratis',
      learn: {
        title: 'Qué aprenden',
        body: 'Primero el alfabeto coreano: leer, escuchar y escribir, en misiones de cinco minutos.',
        link: 'Qué hacen al aprender',
      },
      safe: {
        title: 'Seguro por diseño',
        bullets: {
          ads: 'Sin anuncios y sin venta de datos.',
          backup:
            'El apodo y el progreso de cada estudiante se guardan en el dispositivo y se respaldan en nuestros servidores, para recuperarlos con un código de rescate. Cuando un estudiante se une a una clase o familia con un código, ese espacio ve el nombre con que se une y su progreso. Los adultos de una familia también pueden recuperar su progreso.',
          gate: 'Un PIN de adultos protege todo lo que cuesta dinero o borra datos.',
          siblings: 'Los hermanos pueden compartir un dispositivo. Cada estudiante conserva sus estrellas y tarjetas.',
        },
      },
      follow: {
        title: 'Acompaña su avance',
        body: 'Crea un espacio familiar gratis, comparte su código y mira la semana de cada estudiante: tiempo de práctica, misiones hechas y letras para repasar en compañía.',
        reports: 'Los informes de hoy, esta semana, este mes y el total muestran lo que salió bien y qué practicar después.',
        route: 'Abre la Ruta de aprendizaje de cada estudiante para ver dónde está y qué sigue.',
        notes: 'Envía una nota corta de ánimo que tu estudiante ve en la app.',
        browse: 'Con el Plan Familiar, explora cada lección tal como la ve tu estudiante.',
        lecture: 'El modo proyección muestra lecciones listas de las Etapas 1 a 7 en una TV, una computadora portátil o un teléfono en horizontal, para aprender en familia.',
      },
      faq: {
        account: { q: '¿Mi estudiante necesita una cuenta?', a: 'No. Los estudiantes nunca necesitan correo ni contraseña.' },
        learnAlong: { q: '¿Puedo aprender a su lado?', a: 'Sí. ¿Tú también aprendes coreano? Juega las mismas misiones.' },
        whatSee: {
          q: '¿Qué puedo ver?',
          a: 'La semana de cada estudiante, en tu espacio familiar después de iniciar sesión. Los estudiantes se unen con tu código familiar.',
          reports: 'La semana y los informes de cada estudiante, en tu espacio familiar después de iniciar sesión. Los estudiantes se unen con tu código familiar.',
        },
      },
    },
    teachers: {
      title: 'Para docentes',
      lead: 'Los estudiantes se unen con un código, tú planificas la semana y cada quien aprende a su ritmo.',
      create: 'Crear una clase gratis',
      tryIt: 'Probar como estudiante',
      setup: {
        title: 'Listo en minutos',
        steps: {
          space: 'Inicia sesión y crea un espacio de clase.',
          code: 'Comparte el código de la clase, el enlace para unirse o su código QR. Los estudiantes escriben el código o abren el enlace; sin correos ni cuentas de estudiantes.',
          devices: 'Los estudiantes aprenden en cualquier dispositivo con navegador.',
        },
      },
      plan: {
        title: 'Planifica y asigna',
        bullets: {
          pick: 'Elige misiones para la semana. Aparecen en la lista de tareas de cada estudiante.',
          planner: 'O usa Plan del periodo: lo arma según el nivel y el ritmo de tu clase.',
        },
      },
      class: {
        title: 'Mira cómo va la clase',
        body: 'Una vista semanal muestra quién practicó y qué letras repasar en grupo. Nunca un ranking.',
        reports: 'Informes de cada estudiante y datos de toda la clase, por día, semana, mes o en total. Nunca un ranking.',
        route: 'Abre la Ruta de aprendizaje de cada estudiante para ver dónde está y qué sigue.',
        notes: 'Envía a tus estudiantes una nota corta de ánimo.',
        browse: 'Con la Licencia de Grupo, revisa cada lección tal como la ven tus estudiantes.',
        lecture: 'Modo proyección: enseña al frente con diapositivas listas de las Etapas 1 a 7, cuentos y temas de palabras, en un proyector, una TV o un teléfono en horizontal.',
      },
      // [SN] "quien creó la escuela" is the console's word for a school's owner; "Contrato Escolar" is
      // `console.billing.planTitle.school_seat`.
      schools: {
        title: 'Úsalo en toda una escuela',
        space: 'Crea un espacio de escuela y después invita a docentes o crea tú las clases de cada docente.',
        admins: (admins: number) =>
          `Suma hasta ${plural('es', admins, { one: `${admins} admin más`, other: `${admins} admins más` })} con un enlace de invitación. Pueden abrir las listas y los informes de las clases y mover estudiantes entre las clases de la escuela.`,
        ownerPlan: 'El plan lo gestiona quien creó la escuela.',
        moves: 'Cambia a un estudiante a otra clase de la escuela. Se avisa a su familia, y el estudiante no tiene que escribir un código nuevo.',
        size: (email: string) => `¿Necesitas lugar para más estudiantes? Escribe a ${email}.`,
        sizeContract: (email: string) => `¿Necesitas lugar para más estudiantes? Escribe a ${email} para pedir un Contrato Escolar.`,
      },
      privacy: {
        title: 'Privacidad para clases',
        bullets: { initials: 'Puedes mostrar iniciales en lugar de nombres en la lista de la clase.', ads: 'Sin anuncios y sin venta de datos.' },
      },
      faq: {
        students: { q: '¿Los estudiantes necesitan cuentas?', a: 'No. Se unen con el código de la clase, el enlace o el código QR.' },
        ranking: { q: '¿Hay una tabla de posiciones?', a: 'No. Hangul Route nunca compara a los estudiantes entre sí.' },
        try: { q: '¿Puedo probarla antes?', a: 'Sí. Abre la app y juega las primeras misiones como estudiante.' },
      },
    },
    plansTitle: 'Planes',
    faqTitle: 'Preguntas',
    // [SN] "Entrar" is `landing.nav.signIn`.
    haveAccount: '¿Ya tienes una cuenta? Entrar',
    closing: {
      learners: '¿Vamos por tu primera letra?',
      parents: 'Mira la semana de tu estudiante en un solo lugar.',
      teachers: 'Lleva el hangul a tu clase esta semana.',
    },
  },
  // [SN] "Modo proyección" is the console's name for Lecture mode; "tarjeta cultural" is the app's word.
  captures: {
    discover: (letter: string, romanization: string) =>
      `La app en un teléfono, en la primera misión: letras nuevas, empezando por ${letter} (${romanization}), cada una con un botón para escucharla.`,
    home: 'La pantalla de inicio del estudiante: un saludo, la racha y las tarjetas hasta ahora, y la próxima lección con un botón para empezar.',
    game: 'Un minijuego: escucha un sonido y toca la letra que corresponde.',
    card: (word: string, romanization: string, meaning: string) => `Una tarjeta de cultura coreana: ${word} (${romanization}), que significa ${meaning}.`,
    report: 'Un informe semanal de un estudiante: días de práctica, lo que salió bien y qué practicar después.',
    classList: 'La página de la clase: el resumen de esta semana de toda la clase.',
    lectureSlide: 'Una diapositiva del Modo proyección en pantalla grande: una letra, el orden de sus trazos y su sonido.',
    caption: { home: 'Pantalla de inicio', game: 'Un minijuego', card: 'Una tarjeta cultural' },
    og: (brand: string, tagline: string) => `Hoya, el tigre, junto a las palabras ${brand}: ${tagline}`,
  },
  cards: {
    listLabel: 'Tarjetas de la Etapa 1',
    rarity: { common: 'Común', uncommon: 'Poco común', rare: 'Rara', legendary: 'Legendaria' },
    cardLabel: (romanization: string, meaning: string) => `Palabra coreana ${romanization}, significa ${meaning}`,
  },
  games: {
    listLabel: 'Minijuegos de la Etapa 1',
    family: { recognition: 'Reconocer', production: 'Producir', application: 'Aplicar', review: 'Repasar' },
    beta: 'Beta: opcional',
    // Titles mostly follow the app's game names (learner.myRoute.games).
    items: {
      'listen-pick': { title: 'Escucha y elige', blurb: 'Escucha un sonido y toca la letra o la palabra.' },
      'match-sound': { title: 'Une el sonido', blurb: 'Escucha una letra. Toca la ficha que coincide. Sin prisa.' },
      'build-letter': { title: 'Arma la sílaba', blurb: 'Junta letras para formar una sílaba coreana de verdad.' },
      'pic-word-match': { title: 'Imagen y palabra', blurb: 'Toca una imagen y luego su palabra.' },
      'trace-stroke': { title: 'Traza la letra', blurb: 'Sigue el orden de los trazos. Tu dedo aprende la forma.' },
      'odd-one-out': { title: 'Busca el intruso', blurb: 'Tres van juntas. ¿Puedes encontrar la que es diferente?' },
      'culture-quiz': { title: 'Trivia cultural', blurb: 'Una palabra coreana y cuatro respuestas. Elige lo que significa.' },
      'story-sequence': { title: 'Ordena la historia', blurb: 'Cuatro tarjetas, una historia. Tócalas en el orden en que ocurren.' },
    },
  },
  footer: {
    guide: 'Guía',
    app: 'App',
    company: 'Empresa',
    about: 'Nosotros',
    privacy: 'Privacidad',
    terms: 'Términos',
    contact: 'Contacto',
    copyright: (year: number) => `© ${year} Hangul Route`,
    language: 'Idioma',
    licenses: 'Avisos de código abierto',
  },
  waitlist: {
    label: 'Tu correo',
    placeholder: 'tu@correo.com',
    submit: 'Recibir noticias',
    sending: 'Enviando',
    retry: 'Reintentar',
    success: 'Ya estás en la lista. Te escribiremos cuando lleguen los planes para familias y clases.',
    invalid: 'Escribe un correo válido.',
    error: 'No pudimos llegar al servidor. Revisa tu conexión y reintenta.',
    rateLimited: 'Demasiados intentos. Espera un poco y reintenta.',
    unavailable: 'El registro no funciona ahora. Escríbenos y te añadimos.',
    consentLead: 'Usamos tu correo solo para enviarte noticias del lanzamiento de Hangul Route. Nunca lo vendemos ni lo compartimos. Para darte de baja, responde a cualquier mensaje o ',
    contactLink: 'escríbenos',
    privacyLink: 'Política de privacidad',
    honeypot: 'Deja este campo vacío',
  },
  about: {
    backHome: '← Ir al inicio',
    title: 'Acerca de Hangul Route',
    lead: 'Hecho por un equipo pequeño (casi siempre una persona y un tigre). Para cualquier persona que aprende hangul desde cero, a cualquier edad: familias de herencia cuyos padres o abuelos hablan coreano, fans del K-pop, la comida coreana y todo lo K, y principiantes con curiosidad que buscan una forma amable de empezar, sin culpas.',
    promises: {
      title: 'Nuestras promesas',
      plainEnglish: 'Los menús y las instrucciones usan palabras cortas y sencillas, en inglés, español o coreano.',
      koreanTaught: 'Cada palabra coreana que aprendes viene con su romanización y su significado.',
      noRed: 'Sin marcas rojas cuando te equivocas: Hoya avisa con ámbar.',
      noAds: 'Sin anuncios, nunca, y sin venta de datos.',
      localFirst:
        'El apodo y el progreso de cada estudiante se guardan en el dispositivo y se respaldan en nuestros servidores, para recuperarlos con un código de rescate.',
      gate: 'Un PIN de adultos protege todo lo que cuesta dinero o borra datos.',
    },
    feedback: {
      title: '¿Tienes comentarios?',
      body: (email: string) => `Escribe a ${email}: leemos todo.`,
    },
    privacy: 'Privacidad',
    terms: 'Términos',
  },
  legal: {
    backHome: '← Ir al inicio',
    englishAuthoritative: 'Este documento se muestra en inglés. La versión en inglés es la que se aplica.',
  },
  licenses: {
    title: 'Avisos de código abierto',
    lead: 'Hangul Route usa software de código abierto y una fuente tipográfica que hicieron otras personas. Cada uno mantiene su propia licencia. Esta página los muestra con sus avisos de copyright y el texto completo de cada licencia.',
    notOpen: 'Hangul Route en sí no es de código abierto.',
    copyright: 'Copyright (c) 2026 Sungjoo Hwang. Todos los derechos reservados.',
    softwareTitle: 'Software',
    fontsTitle: 'Fuentes',
    noticesTitle: 'Archivos NOTICE',
    fullText: 'Texto de la licencia',
    usedIn: 'Se usa en',
    where: { app: 'App', web: 'Sitio web', server: 'Servidor', ios: 'App de iOS' },
  },
  notFound: {
    body: 'Puede que el enlace sea antiguo. Prueba la página de inicio o empieza a aprender.',
    home: 'Ir a la página de inicio',
    start: 'Empezar a aprender',
    title: 'No encontramos esta página',
  },
  localeBanner: {
    label: 'Sugerencia de idioma',
    viewIn: (endonym: string) => `Ver en ${endonym.toLocaleLowerCase('es')}`,
    dismiss: 'Cerrar',
    close: { cta: '×' },
  },
} satisfies DeepPartial<Messages['landing']>;
