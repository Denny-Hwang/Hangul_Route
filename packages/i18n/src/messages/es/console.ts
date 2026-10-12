import { plural } from '../../plural';
import type { DeepPartial, Messages } from '../../types';

/** A usage count, "{n} de {cap} <sustantivos>" or "{n} <sustantivos>" when there is no cap (null). */
const usageCount =
  (one: string, other: string) =>
  (n: number, cap: number | null): string =>
    cap === null ? plural('es', n, { one: `${n} ${one}`, other: `${n} ${other}` }) : plural('es', cap, { one: `${n} de ${cap} ${one}`, other: `${n} de ${cap} ${other}` });

/**
 * Spanish draft of the console keys F-BILL-002 B-6 adds or changes (§6.1), reviewed by the
 * multi-agent ko/es review in the F-I18N-001 translation PR (PR 15) before `es` ships (§3.10): there is no review-ledger entry yet, so `i18n-status` reports the namespace
 * "not reviewed", and `es` stays hidden (`LOCALE_STATUS`). Every other console key falls back to
 * English until the translation PR. Neutral international Spanish, "tú", no gendered adjective
 * about a person; names, dates and amounts arrive as arguments. Four existing keys the new lines
 * name (`title`, `manage.cta`, `planTitle`) are drafted too, and the whole `entitlementStatus`
 * object beside the two changed values, so one page or card never names a plan, a status, the page
 * or a button two ways or in two languages.
 */
export const consoleMsgs = {
  entitlementStatus: {
    trial: 'prueba',
    trialEnds: (date: string) => `prueba · termina el ${date}`,
    active: 'activo',
    activeRenews: (date: string) => `activo · se renueva el ${date}`,
    pastDueKept: 'el pago necesita atención · la ruta completa sigue una semana',
    pastDuePaused: 'el pago necesita atención · ruta completa en pausa',
    cancelled: 'cancelado',
    cancelledEnds: (date: string) => `cancelado · termina el ${date}`,
    ended: 'terminó',
    endedOn: (date: string) => `terminó el ${date}`,
  },
  billing: {
    title: 'Facturación',
    manage: { cta: 'Gestionar suscripción' },
    planTitle: { free: 'Gratis', family_lifetime: 'Plan Familiar', group_license: 'Licencia de Grupo', school_seat: 'Contrato Escolar' },
    promo: { disclosure: '¿Tienes un código?' },
    contact: { mailSubject: 'Contrato escolar de Hangul Route' },
    testMode: 'Modo de prueba: no se cobra ninguna tarjeta real.',
    notConfigured: 'Los pagos aún no están configurados. No se cobró nada.',
    liveOff: 'Los pagos aún no están abiertos. No se cobró nada.',
    offline: 'No tienes conexión. Los planes y recibos necesitan conexión.',
    retry: { cta: 'Reintentar' },
    sections: { yours: 'Tus planes', add: 'Añadir un plan', help: 'Ayuda' },
    kind: { family: 'Familia', class: 'Clase', school: 'Escuela' },
    archived: '(en archivo)',
    coverage: {
      free: 'Plan gratuito',
      family: 'Plan Familiar',
      license: 'Licencia de Grupo',
      contract: 'Contrato Escolar',
      school: (school: string) => `Con la licencia de ${school}`,
      schoolUntil: (school: string, date: string) => `Con la licencia de ${school} hasta el ${date}`,
    },
    status: {
      renewsOn: (date: string) => `Se renueva el ${date}`,
      endsOn: (date: string) => `Termina el ${date}`,
    },
    readOnly: {
      family: 'La persona que creó esta familia gestiona este plan.',
      class: 'Quien creó la clase gestiona este plan.',
      school: 'Tu escuela gestiona este plan.',
    },
    usage: {
      learners: usageCount('estudiante', 'estudiantes'),
      students: usageCount('estudiante', 'estudiantes'),
      teachers: usageCount('docente', 'docentes'),
    },
    connectLearner: { line: 'Siguiente: conecta a un estudiante con esta familia.', cta: 'Conectar un estudiante' },
    buy: {
      forSpace: (plan: string, space: string) => `${plan} para ${space}`,
      family_lifetime: { cta: 'Obtener Plan Familiar' },
      group_license: { cta: 'Obtener Licencia de Grupo' },
    },
    includesLines: {
      family: {
        everyLesson: 'Cada lección de cada Etapa, incluidas las nuevas',
        learners: (n: number) => plural('es', n, { one: `Hasta ${n} estudiante en una familia`, other: `Hasta ${n} estudiantes en una familia` }),
        cloudSave: 'Guardado en la nube en cada dispositivo',
        browse: 'Explora cada lección como la ve tu estudiante',
        reports: 'Informes de lo que salió bien y qué practicar después',
        notes: 'Envía notas a tus estudiantes',
      },
      license: {
        everyStudent: 'Cada lección para cada estudiante mientras siga en la clase',
        noCap: (cap: number) => `Sin tope de ${cap} estudiantes`,
        school: (teachers: number, students: number) =>
          `Una escuela admite hasta ${plural('es', teachers, { one: `${teachers} docente`, other: `${teachers} docentes` })} y ${plural('es', students, { one: `${students} estudiante`, other: `${students} estudiantes` })}`,
        browse: 'Explora cada lección como la ven tus estudiantes',
        reports: 'Informes de estudiantes y de la clase',
        notes: 'Envía notas a tu clase',
      },
    },
    noSpaces: {
      title: 'Los planes son de una familia o de una clase.',
      family: { cta: 'Crear para mí o mi familia' },
      class: { cta: 'Crear una clase' },
    },
    alreadyActive: 'Este plan ya está activo. No se cobró nada.',
    checking: 'Ya casi: estamos comprobando tu plan.',
    done: 'Gracias. El plan está activo. Tus estudiantes lo tendrán la próxima vez que abran Hangul Route.',
    stillProcessing: 'Tu pago se realizó. El plan aparecerá aquí en un minuto.',
    checkAgain: { cta: 'Revisar de nuevo' },
    receipts: {
      title: 'Recibos',
      all: { cta: 'Todos los recibos' },
      empty: 'Aún no hay recibos.',
      older: 'Los pagos anteriores están en el correo de recibo de Stripe.',
      beyondLimit: 'Recibos más antiguos: mira los correos de Stripe o escríbenos.',
      kind: { purchase: 'Pago', renewal: 'Renovación', refund: 'Reembolso', failed: 'El pago no se realizó' },
      column: { date: 'Fecha', what: 'Qué', plan: 'Plan', amount: 'Importe' },
      test: { pill: 'prueba' },
      view: { cta: 'Ver recibo' },
      viewA11y: (date: string) => `Ver el recibo del ${date} (abre Stripe en una pestaña nueva)`,
      linkFailed: 'Ahora no se puede abrir este recibo.',
      pageTitle: (space: string) => `${space} · recibos`,
      notYours: 'Esta página es para la persona que paga este espacio.',
      cantLoad: 'Ahora no se pueden cargar los recibos.',
      back: { cta: 'Volver a Facturación' },
    },
    stepUp: {
      title: 'Confirma que eres tú',
      body: 'Antes de un pago, un cambio de plan o un recibo, vuelve a iniciar sesión.',
      reason: 'Así los pagos están seguros en un dispositivo compartido.',
      cta: 'Continuar',
      cancel: { cta: 'Ahora no' },
      cancelled: 'No se cambió nada.',
      unavailable: 'Ahora no se puede confirmar. Inténtalo de nuevo en un momento.',
    },
    help: {
      refund: (email: string) => `¿Preguntas o un reembolso? Escribe a ${email}.`,
      learners: 'Los estudiantes nunca ven precios ni recibos.',
      sharedDevice: '¿Dispositivo compartido? Cierra sesión al terminar.',
    },
    pastDue: 'Un pago no se realizó. Actualiza tu tarjeta en Gestionar suscripción; tus estudiantes mantienen la ruta completa una semana.',
  },
} satisfies DeepPartial<Messages['console']>;
