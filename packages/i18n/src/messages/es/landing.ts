import { plural } from '../../plural';
import type { DeepPartial, Messages } from '../../types';

/**
 * Spanish public site (F-I18N-001 PR 15): metadata, the layered home, the persona pages, About, the launch-news form
 * and the 404 links. Public surface (CLAUDE.md section 1): anyone, at any age; never kids-only framing and never an age
 * range (KIDS_ONLY_FRAMING). The Privacy Policy and Terms stay English-authoritative (decision L10): only their notice,
 * draft line and back link are translated here, never a leaf under `legal.privacy` or `legal.terms`. No price anywhere.
 */
const FAQ_ADULT = {
  q: 'Soy una persona adulta que empieza. ¿Se sentirá infantil?',
  a: 'No. La Etapa 1 enseña justo lo que cualquier principiante necesita primero, las letras y sus sonidos, sin lenguaje infantil. Hoya es amable, y las tarjetas de cultura valen la pena a cualquier edad.',
} as const;
const FAQ_KOREAN = {
  q: '¿Necesito saber algo de coreano?',
  a: 'No: lo hicimos justo para empezar desde cero. Las instrucciones están en un español sencillo y claro. El coreano solo aparece como lo que se aprende.',
} as const;

export const landing = {
  meta: {
    title: 'Hangul Route: aprende hangul desde cero con Hoya',
    tagline: 'Aprende hangul desde cero, a cualquier edad.',
    description:
      'Aprende hangul desde cero con Hoya, el tigre, a cualquier edad: familias de herencia coreana, fans de la cultura K y principiantes con curiosidad. Misiones de cinco minutos enseñan el alfabeto coreano para leer, escuchar y escribir, y cada letra te da una tarjeta de cultura coreana. La Etapa 1 es gratis y vienen más etapas. Sin anuncios, nunca.',
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
        description: 'Lecciones de hangul cortas y amables, sin anuncios y con un control para adultos. Crea un espacio familiar gratis y mira la semana de cada estudiante.',
      },
      teachers: {
        title: 'Para docentes: Hangul Route',
        description: 'Los estudiantes se unen con un código de clase, sin correos ni cuentas de estudiantes. Planifica la semana y mira quién practicó. Nunca un ranking.',
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
    skip: 'Ir al contenido',
  },
  home: {
    hero: {
      title: 'Aprende hangul desde cero, a cualquier edad.',
      lead: 'Misiones cortas y divertidas te enseñan a leer, escuchar y escribir el alfabeto coreano, con Hoya, el tigre, como guía.',
      start: 'Empezar a aprender',
      grownUps: '¿Familia o docente? Busca tu página',
      facts: 'Funciona en tu navegador · No hay que instalar nada · La app funciona sin conexión en la mayoría de los dispositivos después de tu primera visita',
      bubble: (letter: string, romanization: string) => `¡Annyeong! Conozcamos la letra ${letter}\u00a0(${romanization}).`,
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
          body: 'Mira qué practica tu estudiante, con control para adultos y sin anuncios.',
        },
        teachers: {
          title: 'Docentes',
          body: 'Los estudiantes se unen con un código. Sin correos ni cuentas.',
        },
      },
    },
    how: {
      title: 'Cómo funciona',
      steps: {
        start: { title: 'Abre la app', body: 'Elige quién aprende y empieza.' },
        quests: { title: 'Aprende en misiones de cinco minutos', body: 'Letras, sonidos y primeras palabras, con sonido e imágenes en cada pantalla.' },
        collect: { title: 'Colecciona y sigue adelante', body: 'Gana tarjetas de cultura coreana. Tu progreso se guarda y se respalda.' },
      },
      routeBody: 'Gana tarjetas de cultura coreana y mira toda tu Ruta de aprendizaje: dónde estás y qué sigue.',
      levelBody: 'Elige quién aprende o comprueba tu nivel.',
    },
    promises: {
      label: 'Nuestras promesas',
      items: { ads: 'Cero anuncios', safety: 'Seguridad infantil primero', noRed: 'Sin marcas rojas' },
    },
    news: {
      title: 'Noticias del lanzamiento',
      body: 'Deja tu correo y te enviaremos la noticia del lanzamiento. Nada más.',
    },
  },
  plans: {
    title: '¿Cuánto cuesta?',
    free: {
      stage1: 'La Etapa 1 es gratis.',
    },
    paid: {
      coming: 'Vienen más etapas, con planes para familias y clases.',
      inApp: 'Los planes para familias y clases están en app.hangulroute.com.',
    },
    managedInApp: 'Los planes y la facturación se gestionan en app.hangulroute.com después de iniciar sesión.',
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
          a: 'En la app: toca Perfil, ve a Clases y familia y toca Unirme a una clase.',
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
          a: 'No. Al comenzar, toca Ya sé algo de coreano y haz una breve prueba de nivel. Hoya te sugiere por dónde empezar.',
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
      signIn: 'Entrar como familia',
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
          gate: 'Un control para adultos protege todo lo que cuesta dinero o borra datos.',
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
        lecture: 'El modo proyección pone una lección en tu TV para aprender en familia.',
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
      signIn: 'Entrar como docente',
      tryIt: 'Probar como estudiante',
      setup: {
        title: 'Listo en minutos',
        steps: {
          space: 'Inicia sesión y crea un espacio de clase.',
          code: 'Comparte el código de la clase. Los estudiantes lo escriben en la app; sin correos ni cuentas de estudiantes.',
          devices: 'Los estudiantes aprenden en cualquier dispositivo con navegador.',
        },
      },
      plan: {
        title: 'Planifica y asigna',
        bullets: {
          pick: 'Elige misiones para la semana. Aparecen en la lista de tareas de cada estudiante.',
          planner: 'O deja que el planificador arme una ruta del periodo según el nivel y el ritmo de tu clase.',
        },
      },
      class: {
        title: 'Mira cómo va la clase',
        body: 'Una vista semanal muestra quién practicó y qué letras repasar en grupo. Nunca un ranking.',
        reports: 'Informes de cada estudiante y datos de toda la clase, por día, semana, mes o en total. Nunca un ranking.',
        route: 'Abre la Ruta de aprendizaje de cada estudiante para ver dónde está y qué sigue.',
        notes: 'Envía a tus estudiantes una nota corta de ánimo.',
        browse: 'Con un plan de clase o escolar, revisa cada lección tal como la ven tus estudiantes.',
        lecture: 'Modo proyección: enseña al frente con un proyector o una TV, con lecciones listas.',
      },
      privacy: {
        title: 'Privacidad para clases',
        bullets: { initials: 'Muestra solo iniciales en la lista de la clase.', ads: 'Sin anuncios y sin venta de datos.' },
      },
      faq: {
        students: { q: '¿Los estudiantes necesitan cuentas?', a: 'No. Se unen con el código de la clase dentro de la app.' },
        ranking: { q: '¿Hay una tabla de posiciones?', a: 'No. Hangul Route nunca compara a los estudiantes entre sí.' },
        try: { q: '¿Puedo probarla antes?', a: 'Sí. Abre la app y juega las primeras misiones como estudiante.' },
      },
    },
    plansTitle: 'Planes',
    faqTitle: 'Preguntas',
    closing: {
      learners: '¿Vamos por tu primera letra?',
      parents: 'Mira la semana de tu estudiante en un solo lugar.',
      teachers: 'Lleva el hangul a tu clase esta semana.',
    },
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
    submit: 'Quiero la invitación',
    sending: 'Enviando',
    retry: 'Reintentar',
    success: 'Ya estás en la lista. Te escribiremos cuando Hangul Route se lance.',
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
      plainEnglish: 'Los menús y las instrucciones usan un español sencillo y claro (CEFR Pre-A1).',
      koreanTaught: 'El coreano se usa solo para lo que se enseña.',
      noRed: 'Sin marcas rojas cuando te equivocas: Hoya avisa con ámbar.',
      noAds: 'Sin anuncios, nunca. Sin anuncios dirigidos a niños. Punto.',
      localFirst:
        'El apodo y el progreso de cada estudiante se guardan en el dispositivo y se respaldan en nuestros servidores, para recuperarlos con un código de rescate.',
      gate: 'Control para adultos con una multiplicación ante cualquier compra o acción que borre datos.',
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
    draft: 'Borrador para revisión. Este documento es un borrador de trabajo que espera la revisión de asesoría legal calificada antes del lanzamiento público.',
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
    body: 'No encontramos esta página.',
    home: 'Ir a la página de inicio',
    start: 'Empezar a aprender',
  },
  localeBanner: {
    label: 'Sugerencia de idioma',
    viewIn: (endonym: string) => `Ver en ${endonym}`,
    dismiss: 'Cerrar',
    close: { cta: '×' },
  },
} satisfies DeepPartial<Messages['landing']>;
