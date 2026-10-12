import { plural } from '../../plural';
import type { DeepPartial, Messages } from '../../types';

/**
 * Spanish public site (F-I18N-001 PR 15): metadata, the layered home, the persona pages, the old landing
 * sections, About, the launch-news form and the 404 links. Public surface (CLAUDE.md section 1): anyone, at any
 * age; never kids-only framing and never an age range (KIDS_ONLY_FRAMING). The Privacy Policy and Terms stay
 * English-authoritative (decision L10): only their notice, draft line and back link are translated here, never a
 * leaf under `legal.privacy` or `legal.terms`. No price anywhere.
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
      'Aprende hangul desde cero con Hoya, el tigre: para cualquier persona, a cualquier edad, familias de herencia coreana, fans de la cultura K y principiantes con curiosidad. Misiones de cinco minutos, 8 minijuegos, tarjetas de cultura coreana para coleccionar y un Recorrido del patrimonio por 7 etapas y 5 temas culturales. La Etapa 1 es gratis y vienen más etapas. Sin anuncios, nunca.',
    keywords: ['aprender hangul', 'alfabeto coreano', 'aprender coreano', 'coreano para principiantes', 'coreano de herencia', 'cultura coreana', 'Hoya'],
    ogDescription: 'Recorrido del patrimonio + tarjetas de cultura coreana + Hoya, el tigre. Empieza el coreano desde cero, a cualquier edad. La Etapa 1 es gratis.',
    twitterDescription: 'Recorrido del patrimonio + tarjetas de cultura coreana + Hoya, el tigre. Empieza el coreano desde cero, a cualquier edad.',
    pages: {
      learners: {
        title: 'Para estudiantes: Hangul Route',
        description: 'Aprende a leer, escuchar y escribir hangul desde cero en misiones de cinco minutos con Hoya, el tigre, y colecciona tarjetas de cultura coreana. Sin anuncios.',
      },
      parents: {
        title: 'Para familias: Hangul Route',
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
    playNow: { cta: 'Jugar ahora' },
    cards: 'Tarjetas',
    games: 'Juegos',
    learners: 'Estudiantes',
    parents: 'Familias',
    dashboard: 'Panel',
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
      bubble: (letter: string, romanization: string) => `¡Annyeong! Conozcamos ${letter} (${romanization}).`,
    },
    who: {
      title: '¿Para quién es?',
      items: {
        learners: {
          title: 'Estudiantes',
          body: 'Misiones de cinco minutos, una guía que nunca regaña y tarjetas de cultura coreana.',
          linkLabel: 'Para estudiantes',
        },
        parents: {
          title: 'Familias',
          body: 'Mira qué practica tu estudiante, con control para adultos y sin anuncios.',
          linkLabel: 'Para familias',
        },
        teachers: {
          title: 'Docentes',
          body: 'Los estudiantes se unen con un código. Sin correos ni cuentas.',
          linkLabel: 'Para docentes',
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
      },
    },
    parents: {
      title: 'Para familias',
      lead: 'Para madres, padres, abuelos y quien cuide: lecciones cortas y amables que mantienen privados los datos de tu estudiante.',
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
        lecture: 'Enseña al frente con un proyector o una TV.',
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
  hero: {
    badges: { allAges: 'Toda edad', heritage: 'Familias de herencia', fans: 'Fans de la cultura K' },
    titleLines: ['Aprende hangul desde cero,', 'a cualquier edad.'],
    lead: (letter: string) =>
      `Hoya, el tigre, te guía desde ${letter} hasta el Chuseok: misiones de cinco minutos, instrucciones en español sencillo y tarjetas de cultura coreana para coleccionar en el camino. Niños, adolescentes y adultos juegan las mismas misiones. Se juega, no se estudia. Nunca un mal gesto.`,
    play: { cta: 'Jugar en el navegador' },
    seeCards: { cta: 'Ver las tarjetas' },
    facts: 'Nada que descargar · Sin anuncios · Funciona sin conexión tras tu primera visita',
    bubble: (letter: string) => `¡Annyeong! Conozcamos ${letter}.`,
  },
  trust: {
    label: 'Confianza',
    items: {
      coppa: { title: 'Seguridad infantil primero', body: 'Sin rastreo de terceros. Pedimos lo mínimo posible.' },
      ads: { title: 'Cero anuncios', body: 'Sin anuncios de terceros. Sin venta de datos. Los ingresos son solo dentro de la app.' },
      offline: {
        title: 'Sirve sin conexión',
        body: 'Después de tu primera visita la app se abre sin conexión. Los sonidos de las letras necesitan una voz coreana en tu dispositivo hasta que lleguen nuestras grabaciones.',
      },
      antiShame: { title: 'Diseño sin vergüenza', body: 'Si te equivocas, ves ámbar. Nada de rojo. Nada de culpa por la racha.' },
    },
  },
  how: {
    title: 'Cómo funciona',
    steps: {
      journey: { title: 'Recorrido del patrimonio', body: '7 etapas × 5 temas culturales. Cada estudiante traza su propia ruta por el coreano.' },
      games: { title: 'Minijuegos', body: 'Toca, arma, traza y une: juegos de cinco minutos que caben en cualquier día, a cualquier edad.' },
      collect: {
        title: 'Colecciona cultura',
        body: (cards: number) =>
          plural('es', cards, {
            one: `Gana ${cards} tarjeta del patrimonio en la Etapa 1: del kimchi al Chuseok y al gayageum.`,
            other: `Gana ${cards} tarjetas del patrimonio en la Etapa 1: del kimchi al Chuseok y al gayageum.`,
          }),
      },
    },
  },
  cards: {
    eyebrow: 'El ciclo de premios',
    title: (cards: number) =>
      plural('es', cards, {
        one: `${cards} tarjeta del patrimonio. Una Corea, una tarjeta a la vez.`,
        other: `${cards} tarjetas del patrimonio. Una Corea, una tarjeta a la vez.`,
      }),
    body: (cards: number, common: number, uncommon: number, rare: number, legendary: number) =>
      `Cada letra que aprendes te da un pedazo real de la cultura coreana: un tazón de ramyeon, una luna de Chuseok, un columpio de una pintura de Dano. La Etapa 1 trae ${plural('es', cards, { one: `${cards} tarjeta`, other: `${cards} tarjetas` })}: ${common} comunes, ${uncommon} poco comunes, ${rare} raras y ${legendary} legendarias.`,
    listLabel: 'Tarjetas de la Etapa 1',
    rarity: { common: 'Común', uncommon: 'Poco común', rare: 'Rara', legendary: 'Legendaria' },
    cardLabel: (romanization: string, meaning: string) => `Palabra coreana ${romanization}, significa ${meaning}`,
    more: 'La Etapa 2 (Palabras) suma más de 30 tarjetas. La Etapa 7 (Expresión propia) completa la colección en 175.',
  },
  games: {
    eyebrow: (shipped: number, beta: number) => {
      const games = plural('es', shipped, { one: `${shipped} minijuego`, other: `${shipped} minijuegos` });
      return beta > 0 ? `${games} + ${beta} en beta` : games;
    },
    title: 'Ninguno se siente como la escuela.',
    body: 'Cuatro familias de práctica (reconocer, producir, aplicar y repasar) en rondas de 90 segundos. Hoya nunca dice “mal”.',
    listLabel: 'Minijuegos de la Etapa 1',
    family: { recognition: 'Reconocer', production: 'Producir', application: 'Aplicar', review: 'Repasar' },
    beta: 'Beta: opcional',
  },
  hoya: {
    eyebrow: 'Conoce a Hoya',
    title: 'Un tigre que nunca dice “mal”.',
    body: 'Hoya es un tigre joven y la única voz de la app. Los cuentos coreanos empiezan con “Hace mucho, cuando los tigres fumaban tabaco…”, así que el tigre es el personaje abuelo de Corea. Hoya es joven: así los estudiantes conocen a un compañero, no a una autoridad.',
    bubble: (korean: string, romanization: string) => `${korean} · ${romanization} · ¡casi!`,
    points: {
      wrong: { title: '¿Te equivocaste?', body: (korean: string) => `Hoya dice “${korean}” (casi) en ámbar, nunca en rojo.` },
      right: { title: '¿Respuesta correcta?', body: 'Una estrella, una tarjeta, un festejo tranquilo. Sin sonidos de monedas.' },
      streak: { title: 'Rachas sin culpa.', body: 'Salta un día. Hoya se alegra de verte cuando vuelves.' },
    },
  },
  parents: {
    eyebrow: 'Para familias',
    title: 'Cinco minutos al día. Nada raro.',
    body: 'Muchos de nuestros estudiantes son niños, así que Hangul Route también está hecho para madres y padres cansados. Presta el teléfono cinco minutos y vuelve a encontrar una letra coreana nueva y una tarjeta del patrimonio. ¿Tú también aprendes coreano? Juega las mismas misiones. Llévalo en un vuelo largo: la app funciona sin conexión después de tu primera visita.',
    points: {
      localFirst: {
        title: 'El progreso se respalda.',
        body: 'El apodo y el progreso de cada estudiante se guardan en el dispositivo y se respaldan en nuestros servidores, para recuperarlos con un código de rescate. Cuando un estudiante se une a una clase o familia con un código, ese espacio ve el nombre con que se une y su progreso. Los adultos de una familia también pueden recuperar su progreso.',
      },
      gate: { title: 'Control adulto.', body: 'Todo lo que cuesta dinero o borra datos está tras una pregunta sencilla de multiplicar.' },
      shared: { title: 'Hermanos en un dispositivo.', body: 'Cada estudiante conserva sus estrellas y tarjetas. Sin ventas insistentes.' },
    },
  },
  pricing: {
    title: 'Precios',
    lines: {
      stage1: { name: 'Etapa 1', detail: 'gratis' },
      stages: { name: 'Más etapas', detail: 'pronto' },
      classroom: { name: 'Planes para clases', detail: 'pronto' },
    },
    footnote: 'Sin anuncios de terceros, nunca.',
  },
  faq: {
    title: 'Preguntas frecuentes',
    items: {
      who: {
        q: '¿Para quién es Hangul Route?',
        a: 'Para cualquier persona que aprende hangul desde cero, a cualquier edad: niños, adolescentes y adultos, familias de herencia coreana y fans de la cultura K. Todos juegan las mismas misiones. La Etapa 1 (Hangul) sirve tanto para quien ya lee bien como para quien aún no lee: cada pantalla tiene voz e imágenes.',
      },
      adult: FAQ_ADULT,
      different: {
        q: '¿Qué la hace diferente de otras apps de idiomas?',
        a: 'Casi todas empiezan con listas de vocabulario. Nosotros empezamos con el alfabeto y la cultura coreana, una tarjeta del patrimonio a la vez. Y nunca hay rojo.',
      },
      korean: FAQ_KOREAN,
      session: {
        q: '¿Cuánto dura una sesión?',
        a: 'Una misión toma unos 5 minutos. Casi todos hacen de 1 a 3 misiones por sesión. Puedes parar cuando quieras: sin vergüenza por la racha.',
      },
      cost: {
        q: '¿Cuánto cuesta?',
        a: 'La Etapa 1 es gratis. Vienen más etapas y planes para clases. Sin anuncios.',
      },
    },
  },
  get: {
    title: 'Prueba Hangul Route esta semana.',
    body: 'Hangul Route funciona en tu navegador: ábrelo, agrégalo a tu pantalla de inicio y funciona sin conexión. Deja tu correo y te enviaremos la noticia del lanzamiento.',
    play: { cta: 'Jugar ahora, gratis' },
    devices: 'Funciona en iPhone, Android, iPad y Chromebook, con cualquier navegador moderno.',
  },
  footer: {
    guide: 'Guía',
    app: 'App',
    product: 'Producto',
    cards: 'Tarjetas',
    games: 'Minijuegos',
    dashboard: 'Panel familiar',
    console: 'Consola docente',
    company: 'Empresa',
    about: 'Nosotros',
    privacy: 'Privacidad',
    terms: 'Términos',
    contact: 'Contacto',
    copyright: (year: number) => `© ${year} Hangul Route`,
    language: 'Idioma',
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
    lead: 'Hecho por un equipo pequeño (casi siempre una persona y un tigre). Para cualquier persona que aprende hangul desde cero, a cualquier edad: familias de herencia cuyos padres o abuelos hablan coreano, fans del K-pop, la comida coreana y todo lo K, y principiantes con curiosidad que buscan una entrada amable y sin vergüenza.',
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
