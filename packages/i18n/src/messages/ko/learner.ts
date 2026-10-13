import type { DeepPartial, Messages } from '../../types';

/** Korean draft of the Profile plan card's new keys (F-BILL-002 B-6, §6.3), a draft reviewed by the multi-agent ko/es review in the F-I18N-001 translation PR (PR 16) before `ko` ships (F-I18N-001 §3.10). */
export const learner = {
  profile: {
    plan: {
      fullRoute: '전체 루트',
      open: (source: string | null) => (source === null || source.trim() === '' ? '모두 열려 있어요.' : `${source} 덕분에 모두 열려 있어요.`),
      details: { cta: '플랜 자세히 보기' },
    },
  },
  /**
   * Notes from grown-ups on the learner side (F-FEEDBACK-001 FB-5b; wireframes home/notes-card.md, notes/list.md,
   * notes/detail.md), reviewed by the multi-agent ko review against section 6.3. Plain 해요체 that a young reader and
   * an adult beginner both read; "신고" only on the self-managed link (`detail.reportSelf`); a sender stands after a
   * colon, never before a particle.
   */
  notes: {
    home: {
      title: (sender: string) => `쪽지가 왔어요. 보낸 사람: ${sender}`,
      newCount: (n: number) => `새 쪽지 ${n}개`,
      from: (sender: string) => `보낸 사람: ${sender}`,
      read: { cta: '읽기' },
    },
    profileRow: { title: '내 쪽지' },
    list: {
      title: '내 쪽지',
      groups: { new: '새 쪽지', earlier: '지난 쪽지' },
      empty: '아직 쪽지가 없어요. 선생님이나 가족이 보낸 쪽지가 여기에 보여요.',
      error: '쪽지를 열 수 없었어요. 조금 뒤에 다시 해 봐요.',
      retry: { cta: '다시 해 보기' },
    },
    detail: {
      from: (sender: string) => `보낸 사람: ${sender}`,
      suggest: { title: '이 퀘스트를 해 봐요', start: { cta: '시작하기' }, closed: '전체 루트에서 열려요' },
      reactions: { heading: '한 번 눌러서 답해요' },
      putAway: { cta: '이 쪽지 치우기' },
      putAwayDone: '치웠어요. 어른은 계속 볼 수 있어요.',
      putAwayDoneSelf: '치웠어요. 이 기기에서는 보이지 않아요.',
      tellGrownUp: { cta: '어른에게 알리기' },
      reportSelf: { cta: '이 쪽지 신고하기' },
      gone: '이 쪽지는 치워졌어요.',
      seeMyNotes: { cta: '내 쪽지 보기' },
      error: '이 쪽지를 열 수 없었어요.',
      retry: { cta: '다시 해 보기' },
    },
    reactionSeenBy: {
      teacher: '내가 고른 답은 선생님이 볼 수 있어요.',
      family: '내가 고른 답은 가족이 볼 수 있어요.',
    },
  },
} satisfies DeepPartial<Messages['learner']>;
