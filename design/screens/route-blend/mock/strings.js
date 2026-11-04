/*
 * BL-D mock words: the draft strings of docs/specs/AMENDMENTS-ROUTE-CLASS-BLEND.md section 19 in en, with es and
 * ko drafts for the rows that add them (BL-4, BL-5, BL-7, BL-8, BL-9 put them in packages/i18n and take them
 * through the multi-agent review). Keys keep the spec's names. `existing.*` is the frame around the new words: the
 * value of the packages/i18n key on main where one exists (wizard step, length chips, Re-pace, Present this plan,
 * From class, the source line), else a board placeholder (names, lesson titles, the week line of GX-11 #942).
 * A design reference, not shipped code.
 *
 * A page marks text with data-t="key" (and data-a='[args]' for a function); "wd:N" is weekday N (0 = Sunday)
 * in the long form, "wds:N" the short form, "wdl:N,N" a list of long names (Intl.ListFormat), "wdsl:N,N" a list of
 * short names. ?lang=en|es|ko picks the locale; ?text=200 sets the html text size to 200 %.
 */
(function () {
  const plural = (lang, n, forms) => forms[new Intl.PluralRules(lang).select(n)] ?? forms.other;
  // es: a weekly habit takes the plural article and plural names ("los martes", "los sábados y domingos"); "el
  // martes" is one coming Tuesday. lunes to viernes are the same in the plural; sábado and domingo add -s.
  const esPl = (names) => names.replace(/\b(sábado|domingo)\b/gu, '$1s');

  const S = {
    en: {
      existing: {
        back: '← Back to Evening Class D',
        planTerm: 'Plan a term',
        stepOf: (n, total) => `Step ${n} of ${total}`,
        howLong: 'How long?',
        len4: '4 weeks', len12: '12 weeks', len6m: '6 months', lenCustom: 'Choose weeks',
        suggested: 'Suggested',
        starts: 'Starts',
        daysOff: 'Days off',
        addBreak: '+ Add a break',
        sessionsNote: (s, w) => `That is ${s} sessions in ${w} weeks.`,
        backBtn: 'Back', next: 'Next',
        previewTitle: 'Your route',
        week: 'Week', dates: 'Dates', kind: 'Kind',
        learn: 'Learn', review: 'Review',
        weeksLabel: 'The weeks of the route',
        draftLine: 'A draft; nothing reaches a learner until you publish.',
        change: 'Change something', use: 'Use this route',
        thisWeek: 'This week',
        repace: 'Re-pace from today',
        present: 'Present this plan',
        fromTeacher: 'From class',
        fromClassPlan: "From your class's weekly plan",
        continue: 'Continue',
        next1: 'Next: Family at the Table',
        stage1: 'Stage 1 · Hangul: you are in your goal stage',
        routeTitle: 'Route',
        tabs: ['Home', 'Route', 'Library', 'Profile'],
        homeTitle: 'Hi, Mina',
        today: 'Today',
        profileTitle: 'Profile',
        dailyReview: 'Daily Review',
        pinRequired: 'PIN required',
        familyHome: 'Family',
        reportTitle: "Mina's report",
        weekLine: 'Practiced 3 of the last 7 days · 24 min',
        weeklyPlanMake: 'Make a weekly plan',
        weeklyPlanOpen: 'Your weekly plan',
      },
      console: {
        meeting: { title: 'How does this class meet?' },
        classDays: 'Class',
        classLength: 'Class length',
        practice: {
          row: 'Learners also practice on their own',
          days: 'times a week',
          minutes: 'min each time',
          inline: ['{n}', 'times a week', '×', '{m}', 'min each time'],
          suggested: (days) => `Practice on ${days}`,
          change: 'Change days',
          everyDay: 'Practice every day',
          afterClass: (wd) => `also after class on ${wd}`,
        },
        mode: {
          title: 'How do class and practice fit together?',
          overlap: 'Practice what class taught',
          overlapHint: "Each class's lessons come back on the practice days after it.",
          split: 'Class and practice cover different lessons',
          splitHint: 'Practice days also bring new lessons from the groups class has started. Covers more, faster.',
        },
        keepAverage: 'Keep the average when there are days off',
        classDayOff: 'Only the class is off',
        preview: {
          header: (total, classDays, classMin, practiceDays, practiceMin) =>
            `About ${total} sessions a week: ${plural('en', classDays, { one: `${classDays} class day`, other: `${classDays} class days` })} (${classMin} min) and ${plural('en', practiceDays, { one: `${practiceDays} practice day`, other: `${practiceDays} practice days` })} (${practiceMin} min each, plus about 2-3 minutes of Daily Review).`,
          perDay: (c, p) => `Class days teach about ${plural('en', c, { one: `${c} lesson`, other: `${c} lessons` })}; practice days play about ${p}.`,
          average: (s, t) => `${s} sessions in all, ${t} a teaching week.`,
          start: (date) => `Starts with the first class on ${date}.`,
          refresh: 'Refresh',
          everyDay: 'on all 7 days',
          classCol: 'Class', practiceCol: 'Practice',
          practiceOnlyTag: 'practice only',
          lesson: (n) => `First letters ${n}`,
          classReview: 'Review together',
        },
        readout: {
          classDays: (n, total) => `Class days so far: ${n} of ${total}`,
          move: 'Move this class day',
          addPractice: 'Add practice days to this plan',
          stopPractice: 'Stop practice days',
          // existing console.curriculum.readout.line (the class aggregate), reused unchanged
          practiceAgg: (done, total, planned) => `${done} / ${total} so far · ${planned} planned`,
        },
        lecture: {
          classDay: (wd, n) => `Class day: ${wd} · ${plural('en', n, { one: `${n} lesson`, other: `${n} lessons` })}`,
          classLength: (m) => `Class length: ${m} min`,
        },
        family: {
          classLine: (cls, wd, n) => `In: ${cls} · class on ${wd}, practice ${n} times a week`,
          pause: 'Pause the family weekly plan while class runs',
          classHasPractice: (name, days) => `${name}'s class has practice days on ${days}.`,
        },
        report: {
          practiceWeek: (n) => plural('en', n, { one: `Practiced on ${n} day this week`, other: `Practiced on ${n} days this week` }),
        },
      },
      learner: {
        planLine: (classDays, practicePart) => `Your class's weekly plan: class on ${classDays}, ${practicePart}.`,
        practiceOn: (days) => `practice on ${days}`,
        practiceMost: 'practice on most days',
        practiceAllBut: (wd) => `practice every day except ${wd}`,
        practiceEvery: 'practice every day',
        refresh: 'Refresh',
        refreshLine: 'Look back at what class taught.',
        classToday: 'Class today.',
        ownResting: "Your own weekly plan is resting while your class's plan has practice days.",
        seeIt: 'See it',
        ownBack: 'Your own weekly plan is back.',
        proposalInstead: "Your class's weekly plan has practice days for you.",
        practiceDays: { title: 'My practice days', hint: 'Pick the days you practice. Your lessons stay the same.', count: 'Days a week' },
      },
      a11y: {
        fromClassMet: 'From class. You met this in class.',
        practiceDay: (wd) => `Practice day, ${wd}`,
        refresh: 'Refresh: look back at what class taught',
      },
    },

    es: {
      existing: {
        back: '← Volver a Evening Class D',
        planTerm: 'Plan del periodo',
        stepOf: (n, total) => `Paso ${n} de ${total}`,
        howLong: '¿Cuánto dura?',
        len4: '4 semanas', len12: '12 semanas', len6m: '6 meses', lenCustom: 'Elegir semanas',
        suggested: 'Sugerido',
        starts: 'Empieza',
        daysOff: 'Días libres',
        addBreak: '+ Añadir pausa',
        sessionsNote: (s, w) => `Son ${s} sesiones en ${w} semanas.`,
        backBtn: 'Atrás', next: 'Siguiente',
        previewTitle: 'Tu ruta',
        week: 'Semana', dates: 'Fechas', kind: 'Tipo',
        learn: 'Aprender', review: 'Repaso',
        weeksLabel: 'Las semanas de la ruta',
        draftLine: 'Es un borrador; nada llega a los estudiantes hasta que lo publiques.',
        change: 'Cambiar algo', use: 'Usar esta ruta',
        thisWeek: 'Esta semana',
        repace: 'Reajustar desde hoy',
        present: 'Presentar este plan',
        fromTeacher: 'De la clase',
        fromClassPlan: 'Del plan semanal de tu clase',
        continue: 'Continuar',
        next1: 'Siguiente: La familia a la mesa',
        stage1: 'Etapa 1 · Hangul: estás en tu etapa meta',
        routeTitle: 'Ruta',
        tabs: ['Inicio', 'Ruta', 'Biblioteca', 'Perfil'],
        homeTitle: 'Hola, Mina',
        today: 'Hoy',
        profileTitle: 'Perfil',
        dailyReview: 'Repaso diario',
        pinRequired: 'requiere PIN',
        familyHome: 'Familia',
        reportTitle: 'Informe de Mina',
        weekLine: 'Practicó 3 de los últimos 7 días · 24 min',
        weeklyPlanMake: 'Armar un plan semanal',
        weeklyPlanOpen: 'Tu plan semanal',
      },
      console: {
        meeting: { title: '¿Cómo se reúne esta clase?' },
        classDays: 'Clase',
        classLength: 'Duración de la clase',
        practice: {
          row: 'Los estudiantes también practican por su cuenta',
          days: 'veces por semana',
          minutes: 'min cada vez',
          inline: ['{n}', 'veces por semana', '×', '{m}', 'min cada vez'],
          suggested: (days) => `Práctica: ${days}`,
          change: 'Cambiar días',
          everyDay: 'Práctica todos los días',
          afterClass: (wd) => `también después de la clase de los ${esPl(wd)}`,
        },
        mode: {
          title: '¿Cómo se combinan la clase y la práctica?',
          overlap: 'Practicar lo que enseñó la clase',
          overlapHint: 'Las lecciones de cada clase vuelven en los días de práctica que siguen.',
          split: 'La clase y la práctica cubren lecciones distintas',
          splitHint: 'Los días de práctica también traen lecciones nuevas de los grupos que la clase ya empezó. Avanza más, y más rápido.',
        },
        keepAverage: 'Mantener el promedio cuando hay días libres',
        classDayOff: 'Solo se cancela la clase',
        preview: {
          header: (total, classDays, classMin, practiceDays, practiceMin) =>
            `Unas ${total} sesiones por semana: ${plural('es', classDays, { one: `${classDays} día de clase`, other: `${classDays} días de clase` })} (${classMin} min) y ${plural('es', practiceDays, { one: `${practiceDays} día de práctica`, other: `${practiceDays} días de práctica` })} (${practiceMin} min cada uno, más unos 2-3 minutos de Repaso diario).`,
          perDay: (c, p) => `Los días de clase enseñan ${plural('es', c, { one: 'una lección', other: `unas ${c} lecciones` })}; los días de práctica hacen ${plural('es', p, { one: 'una', other: `unas ${p}` })}.`,
          average: (s, t) => `${s} sesiones en total, ${t} por semana con clases.`,
          start: (date) => `Empieza con la primera clase, el ${date}.`,
          refresh: 'Refrescar',
          everyDay: 'los 7 días',
          classCol: 'Clase', practiceCol: 'Práctica',
          practiceOnlyTag: 'solo práctica',
          lesson: (n) => `Primeras letras ${n}`,
          classReview: 'Repaso en grupo',
        },
        readout: {
          classDays: (n, total) => `Días de clase hasta hoy: ${n} de ${total}`,
          move: 'Mover este día de clase',
          addPractice: 'Añadir días de práctica a este plan',
          stopPractice: 'Quitar los días de práctica',
          practiceAgg: (done, total, planned) => `${done} / ${total} hasta ahora · ${plural('es', planned, { one: `${planned} planeado`, other: `${planned} planeados` })}`,
        },
        lecture: {
          classDay: (wd, n) => `Día de clase: ${wd} · ${plural('es', n, { one: `${n} lección`, other: `${n} lecciones` })}`,
          classLength: (m) => `Duración de la clase: ${m} min`,
        },
        family: {
          classLine: (cls, wd, n) => `En: ${cls} · clase los ${esPl(wd)}, práctica ${n} veces por semana`,
          pause: 'Pausar el plan semanal de la familia mientras dure la clase',
          classHasPractice: (name, days) => `La clase de ${name} tiene días de práctica los ${esPl(days)}.`,
        },
        report: {
          practiceWeek: (n) => plural('es', n, { one: `Practicó ${n} día esta semana`, other: `Practicó ${n} días esta semana` }),
        },
      },
      learner: {
        planLine: (classDays, practicePart) => `Plan semanal de tu clase: clase los ${esPl(classDays)}, ${practicePart}.`,
        practiceOn: (days) => `práctica los ${esPl(days)}`,
        practiceMost: 'práctica casi todos los días',
        practiceAllBut: (wd) => `práctica todos los días menos los ${esPl(wd)}`,
        practiceEvery: 'práctica todos los días',
        refresh: 'Refrescar',
        refreshLine: 'Vuelve a mirar lo que enseñó la clase.',
        classToday: 'Hoy hay clase.',
        ownResting: 'Tu propio plan semanal descansa mientras el plan de tu clase tiene días de práctica.',
        seeIt: 'Verlo',
        ownBack: 'Tu propio plan semanal volvió.',
        proposalInstead: 'El plan semanal de tu clase tiene días de práctica para ti.',
        practiceDays: { title: 'Mis días de práctica', hint: 'Elige los días en que practicas. Tus lecciones siguen iguales.', count: 'Días por semana' },
      },
      a11y: {
        fromClassMet: 'De la clase. Lo viste en clase.',
        practiceDay: (wd) => `Día de práctica, ${wd}`,
        refresh: 'Refrescar: vuelve a mirar lo que enseñó la clase',
      },
    },

    ko: {
      existing: {
        back: '← Evening Class D(으)로 돌아가기',
        planTerm: '학기 계획하기',
        stepOf: (n, total) => `${total}단계 중 ${n}단계`,
        howLong: '기간',
        len4: '4주', len12: '12주', len6m: '6개월', lenCustom: '주 수 고르기',
        suggested: '추천',
        starts: '시작일',
        daysOff: '쉬는 날',
        addBreak: '+ 쉬는 기간 추가',
        sessionsNote: (s, w) => `${w}주 동안 ${s}번이에요.`,
        backBtn: '뒤로', next: '다음',
        previewTitle: '내 루트',
        week: '주', dates: '날짜', kind: '종류',
        learn: '배우기', review: '복습',
        weeksLabel: '루트의 주별 계획',
        draftLine: '초안이에요. 게시하기 전에는 학습자에게 아무것도 가지 않아요.',
        change: '바꾸기', use: '이 루트 쓰기',
        thisWeek: '이번 주',
        repace: '오늘부터 진도 다시 맞추기',
        present: '이 계획 발표하기',
        fromTeacher: '반에서',
        fromClassPlan: '반의 주간 계획에서',
        continue: '계속하기',
        next1: '다음: 식탁에 모인 가족',
        stage1: '1단계 · 한글: 목표 단계에 있어요',
        routeTitle: '루트',
        tabs: ['홈', '루트', '라이브러리', '프로필'],
        homeTitle: '안녕, Mina',
        today: '오늘',
        profileTitle: '프로필',
        dailyReview: '오늘의 복습',
        pinRequired: 'PIN 필요',
        familyHome: '가족',
        reportTitle: 'Mina의 리포트',
        weekLine: '지난 7일 중 3일 연습 · 24분',
        weeklyPlanMake: '주간 계획 만들기',
        weeklyPlanOpen: '내 주간 계획',
      },
      console: {
        meeting: { title: '이 반은 수업을 어떻게 하나요?' },
        classDays: '수업',
        classLength: '수업 길이',
        practice: {
          row: '학생들은 혼자서도 연습해요',
          days: '한 주에 몇 번',
          minutes: '한 번에 몇 분',
          inline: ['주', '{n}', '회', '×', '한 번에', '{m}', '분'],
          suggested: (days) => `연습: ${days}`,
          change: '요일 바꾸기',
          everyDay: '매일 연습',
          afterClass: (wd) => `${wd} 수업 뒤에도`,
        },
        mode: {
          title: '수업과 연습을 어떻게 맞출까요?',
          overlap: '수업에서 배운 것을 연습해요',
          overlapHint: '수업마다 배운 레슨이 그 뒤 연습하는 날에 다시 나와요.',
          split: '수업과 연습에서 서로 다른 레슨을 해요',
          splitHint: '연습하는 날에는 수업에서 시작한 묶음의 새 레슨도 나와요. 더 많이, 더 빨리 나가요.',
        },
        keepAverage: '쉬는 날이 있어도 한 주 평균 지키기',
        classDayOff: '수업만 쉬어요',
        preview: {
          header: (total, classDays, classMin, practiceDays, practiceMin) =>
            `한 주에 약 ${total}번: 수업하는 날 ${classDays}일(${classMin}분), 연습하는 날 ${practiceDays}일(한 번에 ${practiceMin}분, 오늘의 복습 2~3분쯤 더).`,
          perDay: (c, p) => `수업하는 날에는 레슨을 ${c}개쯤 배우고, 연습하는 날에는 ${p}개쯤 해요.`,
          average: (s, t) => `모두 ${s}번, 수업이 있는 주마다 ${t}번.`,
          start: (date) => `${date} 첫 수업부터 시작해요.`,
          refresh: '되짚기',
          everyDay: '7일 모두',
          classCol: '수업', practiceCol: '연습',
          practiceOnlyTag: '연습에서만',
          lesson: (n) => `첫 글자 ${n}`,
          classReview: '함께 복습',
        },
        readout: {
          classDays: (n, total) => `지금까지 수업: ${total}번 중 ${n}번`,
          move: '이 수업일 옮기기',
          addPractice: '이 계획에 연습하는 날 더하기',
          stopPractice: '연습하는 날 그만두기',
          practiceAgg: (done, total, planned) => `지금까지 ${done} / ${total} · ${planned}개 계획됨`,
        },
        lecture: {
          classDay: (wd, n) => `수업일: ${wd} · 레슨 ${n}개`,
          classLength: (m) => `수업 길이: ${m}분`,
        },
        family: {
          classLine: (cls, wd, n) => `소속: ${cls} · ${wd} 수업, 주 ${n}회 연습`,
          pause: '수업 기간에는 가족 주간 계획 잠시 멈추기',
          classHasPractice: (name, days) => `${name}의 반은 ${days}에 연습해요.`,
        },
        report: {
          practiceWeek: (n) => `이번 주 ${n}일 연습했어요`,
        },
      },
      learner: {
        planLine: (classDays, practicePart) => `반의 주간 계획: ${classDays} 수업, ${practicePart}.`,
        practiceOn: (days) => `${days} 연습`,
        practiceMost: '거의 매일 연습',
        practiceAllBut: (wd) => `${wd} 빼고 매일 연습`,
        practiceEvery: '매일 연습',
        refresh: '되짚기',
        refreshLine: '수업에서 배운 것을 다시 봐요.',
        classToday: '오늘은 수업이 있어요.',
        ownResting: '반의 계획에 연습하는 날이 있는 동안 내 주간 계획은 쉬고 있어요.',
        seeIt: '보기',
        ownBack: '내 주간 계획이 다시 시작됐어요.',
        proposalInstead: '반의 주간 계획에 나를 위한 연습하는 날이 있어요.',
        practiceDays: { title: '내 연습 요일', hint: '연습할 요일을 골라요. 레슨은 그대로예요.', count: '한 주에 며칠' },
      },
      a11y: {
        fromClassMet: '반에서. 수업에서 만났어요.',
        practiceDay: (wd) => `연습하는 날, ${wd}`,
        refresh: '되짚기: 수업에서 배운 것을 다시 봐요',
      },
    },
  };

  const params = new URLSearchParams(location.search);
  const lang = S[params.get('lang')] ? params.get('lang') : 'en';
  const LOCALE = { en: 'en-US', es: 'es-ES', ko: 'ko-KR' }[lang];
  const SUNDAY = Date.UTC(2026, 10, 1); // 2026-11-01 is a Sunday
  const wd = (n, style = 'long') => new Intl.DateTimeFormat(LOCALE, { weekday: style, timeZone: 'UTC' }).format(new Date(SUNDAY + n * 864e5));
  // Korean joins weekday names with a middle dot (수요일·금요일·일요일): Intl's "및" is formal, and its commas run
  // into the comma that separates the class part from the practice part. en and es use Intl.ListFormat.
  const list = (names) => (lang === 'ko' ? names.join('·') : new Intl.ListFormat(LOCALE, { type: 'conjunction' }).format(names));
  const date = (iso) => new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  const nums = (s) => s.split(',').filter(Boolean).map(Number);

  /** Week order from Monday, as the spec's tables read (practiceDaysFor's order of the cycles is the generator's). */
  const weekOrder = (days) => [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

  /**
   * Section 7's line. The practice part collapses past 3 names: "practice every day" when the practice days cover
   * every weekday, or every non-class day (the class days hold the class, so the week is full: 1 class + 6 practice,
   * Tue; Wed to Mon, reads "every day", as the console's "Practice every day" for the same plan); "every day except
   * {weekday}" when 6 practice days leave out a day that has no class either; "most days" for 4 or more otherwise;
   * 1-3 days by name. The rule matches the console's suggested-days line (10.1), so teacher and learner read the same.
   */
  function planLine(classDays, practiceDays) {
    const L = S[lang].learner;
    const distinct = [...new Set(practiceDays)];
    const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !distinct.includes(d) && !classDays.includes(d));
    let part;
    if (free.length === 0 && distinct.length >= 4) part = L.practiceEvery;
    else if (distinct.length === 6 && free.length === 1) part = L.practiceAllBut(wd(free[0]));
    else if (distinct.length >= 4) part = L.practiceMost;
    else part = L.practiceOn(list(weekOrder(distinct).map((d) => wd(d))));
    return L.planLine(list(weekOrder(classDays).map((d) => wd(d))), part);
  }

  function arg(a) {
    if (typeof a !== 'string') return a;
    if (a.startsWith('wd:')) return wd(Number(a.slice(3)));
    if (a.startsWith('wds:')) return wd(Number(a.slice(4)), 'short');
    if (a.startsWith('wdl:')) return list(nums(a.slice(4)).map((d) => wd(d)));
    if (a.startsWith('wdsl:')) return nums(a.slice(5)).map((d) => wd(d, 'short')).join(', ');
    if (a.startsWith('date:')) return date(a.slice(5));
    return a;
  }

  function t(key, args) {
    const value = key.split('.').reduce((o, k) => (o == null ? o : o[k]), S[lang]);
    if (value === undefined) throw new Error(`no string ${key} in ${lang}`);
    return typeof value === 'function' ? value(...(args ?? []).map(arg)) : value;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-t]').forEach((el) => {
      el.textContent = t(el.dataset.t, el.dataset.a ? JSON.parse(el.dataset.a) : []);
    });
    root.querySelectorAll('[data-t-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.tAria, el.dataset.aa ? JSON.parse(el.dataset.aa) : []));
    });
    root.querySelectorAll('[data-wd]').forEach((el) => {
      el.textContent = wd(Number(el.dataset.wd), el.dataset.style ?? 'short');
    });
    root.querySelectorAll('[data-date]').forEach((el) => {
      el.textContent = date(el.dataset.date);
    });
  }

  window.RB = { S, lang, params, t, wd, list, date, planLine, apply };
  document.documentElement.lang = lang;
  if (params.get('text') === '200') document.documentElement.classList.add('text200');
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.beforeApply === 'function') window.beforeApply(window.RB);
    apply();
    document.documentElement.dataset.ready = 'yes';
  });
})();
