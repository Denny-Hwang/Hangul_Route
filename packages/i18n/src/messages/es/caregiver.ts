import type { DeepPartial, Messages } from '../../types';

/**
 * Spanish draft of the learner Plan screen (F-BILL-002 B-6, §6.2), reviewed by the multi-agent ko/es
 * review in the F-I18N-001 translation PR (PR 15) before `es` ships (F-I18N-001 §3.10; no review-ledger entry yet, `es` stays hidden). Status only: no price, no purchase word,
 * and nothing a native build renders mentions the web (§4.8).
 */
export const caregiver = {
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
    backToJourney: { cta: 'Volver al recorrido' },
  },
} satisfies DeepPartial<Messages['caregiver']>;
