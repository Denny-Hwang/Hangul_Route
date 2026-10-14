import type { TransferConsentText } from './transfer-consent';

/**
 * The Korean consent lines of a class move (F-SPACE-002 section 4.11, T-6d): Korean UI-locale legal text shown to a
 * guardian, never taught Korean, so the romanization scan skips this file (and only this file). Formal polite style
 * (합니다체). No Hangul follows a placeholder, and a class name is never followed by the counter word 반 (a typed
 * name often ends in it already, "햇살반"): a name sits in brackets after 지금 반 / 새 반 ("새 반({destination})으로"),
 * so the particle after the bracket follows 반 and is right for every name. "Would move" stays conditional (옮기려고 합니다).
 */
export const TRANSFER_CONSENT_TEXT_KO: TransferConsentText = {
  lines: {
    moving: '{learner} 학습자가 지금 반({source})에서 새 반({destination})으로 옮기려고 합니다.',
    new_teacher: '새 반({destination}) 선생님이 {learner} 학습자의 진도를 보게 됩니다.',
    old_teacher: '지금 반({source}) 선생님은 이동이 이루어질 때부터 그 반에서 {learner} 학습자를 볼 수 없습니다. 그 전에는 볼 수 있습니다.',
    keeps: '카드, 별, 끝낸 레슨은 {learner} 학습자에게 그대로 남습니다.',
    cooling_off: '이동은 2일 뒤에 이루어집니다. 그 전에는 가족 누구나 취소할 수 있습니다.',
    visible_list: '새 선생님이 보는 것:',
    nothing_else: '그 밖에 앱의 다른 정보는 선생님과 공유하지 않습니다.',
    visible_today: '지금 {learner} 학습자를 볼 수 있는 사람:',
    typed_names: '반 이름과 선생님 이름은 선생님이 직접 입력합니다. 저희는 이 이름을 확인하지 않습니다. 이 선생님을 아는 경우에만 계속하십시오.',
    from_teacher: '이 요청은 지금 반({source}) 선생님이 보낸 것입니다. 회원님이 보낸 것이 아닙니다.',
    premium_may_change: '지금 반({source})의 플랜으로 열려 있던 레슨은 이동 후 닫힐 수 있습니다. 이미 끝낸 레슨은 그대로 남습니다.',
    school_delete: '새 반({destination}) 선생님이 {learner} 학습자의 기록을 삭제할 수 있게 됩니다.',
    device_relink: '지금 반({source})을 통해 연결한 태블릿은 새 반({destination})에 다시 연결해야 할 수 있습니다.',
    homework_drops: '지금 반({source})에서 받은 숙제 중 끝내지 않은 숙제는 사라집니다. 끝낸 숙제는 그대로 남습니다.',
    cannot_undo: '이동은 되돌릴 수 없습니다. {learner} 학습자는 언제든지 프로필에서 반을 나갈 수 있습니다.',
    teacher_moves: '선생님이 나중에 {learner} 학습자를 다른 반으로 옮길 수 있습니다. 옮기면 알려 드립니다.',
    introduce: '{learner} 학습자가 어느 반에서 오는지 새 반({destination})에 알려 줍니다.',
  },
  items: {
    name_picture_level: '{learner} 학습자의 이름, 사진, 레벨',
    activity: '{learner} 학습자가 연습한 날, 날마다 연습한 시간, 연속으로 연습한 날 수',
    quests: '끝낸 퀘스트와 맞힌 답의 수',
    cards_letters: '얻은 카드, 배운 글자, 연습이 더 필요한 글자',
    level_check: '레벨 확인 결과',
    plan_progress: '새 반({destination})에서 받은 숙제의 진도',
    sync_time: '{learner} 학습자가 반에 들어온 때와 진도를 마지막으로 저장한 때',
    note_replies: '선생님의 쪽지에 {learner} 학습자가 고른 답',
    words: '모은 단어, 잘 아는 단어, 처음에 맞힌 답, 다시 볼 단어',
    letter_check: '한글 확인 결과와 어려웠던 글자',
    own_route: '{learner} 학습자가 고른 레슨과 학습 루트 목표',
    learner_settings: '{learner} 학습자가 반에서 쪽지를 받는지 여부',
  },
};
