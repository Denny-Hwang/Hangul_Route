import type { DeepPartial, Messages } from '../../types';

/** Korean draft of the Plan screen's summary heading (F-BILL-002 B-6), a draft reviewed by the multi-agent ko/es review in the F-I18N-001 translation PR (PR 16) before `ko` ships (F-I18N-001 §3.10). */
export const a11y = {
  planStatus: (name: string, state: string) => `${name}: ${state}.`,
  /** Notes from grown-ups read aloud (F-FEEDBACK-001 FB-5b, section 6.12); `preset` and `label` arrive rendered. */
  notes: {
    card: (sender: string, preset: string) => `새 쪽지, 보낸 사람: ${sender}. ${preset} 읽기.`,
    cardMany: (n: number, sender: string) => `새 쪽지 ${n}개. 가장 최근에 보낸 사람: ${sender}. 읽기.`,
    row: (sender: string, preset: string, date: string, isNew: boolean) =>
      `${isNew ? '새 쪽지. ' : ''}보낸 사람: ${sender}, ${date}. ${preset}`,
    answer: (label: string) => `내 답: ${label}`,
    reactionPicked: (label: string) => `고른 답: ${label}`,
    questCard: (title: string) => `이 퀘스트를 해 봐요: ${title}`,
  },
} satisfies DeepPartial<Messages['a11y']>;
