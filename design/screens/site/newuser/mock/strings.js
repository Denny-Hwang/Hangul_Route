/*
 * New and changed strings of AMENDMENTS-SITE-NEWUSER (appendix A), as the mock draws them. Every value here is the
 * spec's table word for word; the build script (tools/build-mocks.mjs) loads this file into the real export of each
 * page and `patch.js` places the strings. Values the spec passes in (taught Korean, the endonyms, the contact address,
 * the caps) are never typed into a string: they arrive as arguments, as they will from `packages/i18n`.
 */
(function () {
  const plural = (n, one, other) => (n === 1 ? one : other);
  window.SN_STRINGS = {
    en: {
      nav: { startShort: 'Start' },
      hero: { forParents: "I'm a parent", forTeachers: "I'm a teacher" },
      closing: {
        title: 'Ready for your first Korean letter?',
        body: 'Stage 1 is free. No email or password. About five minutes.',
      },
      persona: {
        parentsCreate: 'Create a free family space',
        teachersCreate: 'Create a free class',
        haveAccount: 'Already have an account? Sign in',
      },
      schools: {
        title: 'Use it across a whole school',
        space: 'Create a school space, then invite teachers or create classes for them.',
        admins: (admins) =>
          `Add up to ${plural(admins, `${admins} more administrator`, `${admins} more administrators`)} with an invite link. They can open class lists and reports and move students between the school's classes. The owner manages the plan.`,
        size: (students, email) => `A school holds up to ${students} students. Need more? Write to ${email} about a School Contract.`,
        moves: 'Move a student to another class in the school. Their family is told, and the student never types a new code.',
      },
      notFound: {
        title: 'Page not found',
        body: 'The link may be old. Try the home page or start learning.',
      },
      captures: {
        discover: (letter, roman) => `The app on a phone, in the first quest: new letters, starting with ${letter} (${roman}), each with a button to hear it.`,
        home: "The learner's home screen: the next lesson with a Start button, and stories for today.",
        game: 'A mini-game: hear a sound and tap the matching letter.',
        card: (word, roman, meaning) => `A Korean culture card: ${word} (${roman}), meaning ${meaning}.`,
        report: 'A weekly report for one learner: days practiced, what went well and what to practice next.',
        classList: "The class page: this week's summary and a card for each student with their progress.",
        lectureSlide: 'A Lecture mode slide on a big screen: a letter, its stroke order and its sound.',
        og: (brand, tagline) => `Hoya the tiger next to the words ${brand}: ${tagline}`,
        caption: { home: 'Home screen', game: 'A mini-game', card: 'A culture card' },
      },
      cardMeaning: 'tiger',
    },
    es: {
      nav: { startShort: 'Empezar' },
      hero: { forParents: 'Soy madre, padre o tutor', forTeachers: 'Soy docente' },
      closing: {
        title: '¿Vamos por tu primera letra coreana?',
        body: 'La Etapa 1 es gratis. Sin correo ni contraseña. Unos cinco minutos.',
      },
      persona: {
        parentsCreate: 'Crea un espacio familiar gratis',
        teachersCreate: 'Crea una clase gratis',
        haveAccount: '¿Ya tienes una cuenta? Entrar',
      },
      schools: {
        title: 'Úsalo en toda una escuela',
        space: 'Crea un espacio de escuela y después invita a docentes o crea tú las clases de cada docente.',
        admins: (admins) =>
          `Suma hasta ${plural(admins, `${admins} administrador más`, `${admins} administradores más`)} con un enlace de invitación. Pueden abrir las listas y los informes de las clases y cambiar estudiantes entre las clases de la escuela. El plan lo gestiona quien creó la escuela.`,
        size: (students, email) => `Una escuela admite hasta ${students} estudiantes. ¿Necesitas más? Escribe a ${email} para pedir un Contrato Escolar.`,
        moves: 'Cambia a un estudiante a otra clase de la escuela. Se avisa a su familia, y el estudiante no tiene que escribir un código nuevo.',
      },
      notFound: {
        title: 'No encontramos esta página',
        body: 'Puede que el enlace sea antiguo. Prueba la página de inicio o empieza a aprender.',
      },
      captures: {
        discover: (letter, roman) => `La app en un teléfono, en la primera misión: letras nuevas, empezando por ${letter} (${roman}), cada una con un botón para escucharla.`,
        home: 'La pantalla de inicio del estudiante: la próxima lección con un botón para empezar y cuentos para hoy.',
        game: 'Un minijuego: escucha un sonido y toca la letra que corresponde.',
        card: (word, roman, meaning) => `Una tarjeta de cultura coreana: ${word} (${roman}), que significa ${meaning}.`,
        report: 'Un informe semanal de un estudiante: días de práctica, lo que salió bien y qué practicar después.',
        classList: 'La página de la clase: el resumen de la semana y una tarjeta por estudiante con su progreso.',
        lectureSlide: 'Una diapositiva del Modo proyección en pantalla grande: una letra, el orden de sus trazos y su sonido.',
        og: (brand, tagline) => `Hoya, el tigre, junto a las palabras ${brand}: ${tagline}`,
        caption: { home: 'Pantalla de inicio', game: 'Un minijuego', card: 'Una tarjeta cultural' },
      },
      cardMeaning: 'tigre',
    },
    ko: {
      nav: { startShort: '시작' },
      hero: { forParents: '부모 또는 보호자예요', forTeachers: '선생님이에요' },
      closing: {
        title: '첫 한글 글자를 만나 볼까요?',
        body: '1단계는 무료예요. 이메일도 비밀번호도 필요 없어요. 5분 정도 걸려요.',
      },
      persona: {
        parentsCreate: '무료 가족 공간 만들기',
        teachersCreate: '무료 반 만들기',
        haveAccount: '이미 계정이 있나요? 로그인',
      },
      schools: {
        title: '학교 전체에서 함께 써요',
        space: '학교 공간을 만든 뒤, 선생님을 초대하거나 선생님 대신 반을 만들어요.',
        admins: (admins) =>
          `초대 링크로 관리자를 ${admins}명 더 추가할 수 있어요. 관리자는 반 명단과 리포트를 열고, 학교 안의 반끼리 학생을 옮길 수 있어요. 플랜은 학교를 만든 분이 관리해요.`,
        size: (students, email) => `학교 하나에 학생은 최대 ${students}명이에요. 더 필요하면 ${email} 주소로 학교 계약을 문의해 주세요.`,
        moves: '학생을 학교 안의 다른 반으로 옮길 수 있어요. 가족에게 알림이 가고, 학생은 새 코드를 입력하지 않아도 돼요.',
      },
      notFound: {
        title: '페이지를 찾을 수 없어요',
        body: '오래된 링크일 수 있어요. 홈으로 가거나 배우기를 시작해 보세요.',
      },
      captures: {
        /* No particle on a value (F-I18N-001 section 3.10): the letter ends its own sentence. */
        discover: (letter, roman) => `휴대폰 속 앱의 첫 퀘스트 화면: 새 글자 몇 개와 소리 듣기 버튼. 첫 글자는 ${letter}(${roman}).`,
        home: '학습자 홈 화면: 시작 버튼이 있는 다음 레슨과 오늘의 이야기.',
        game: '미니게임: 소리를 듣고 맞는 글자를 눌러요.',
        /* The Korean UI's gloss of a Korean word is the word itself, so the meaning is not repeated. */
        card: (word, roman) => `한국 문화 카드: ${word}(${roman}).`,
        report: '학습자 한 명의 주간 리포트: 연습한 날, 잘한 점, 다음에 연습할 점.',
        classList: '반 페이지: 이번 주 요약과 학생마다 진도를 보여 주는 카드.',
        lectureSlide: '큰 화면에 띄운 강의 모드 슬라이드: 글자, 획순, 소리.',
        og: (brand, tagline) => `호랑이 호야 옆에 쓰인 글자 ${brand}: ${tagline}`,
        caption: { home: '홈 화면', game: '미니게임', card: '문화 카드' },
      },
      cardMeaning: '호랑이',
    },
  };
  /* Values the pages pass in (spec section 3.x): never typed into a string. */
  window.SN_VALUES = {
    endonyms: { en: 'English', es: 'Español', ko: '한국어' },
    htmlLang: { en: 'en', es: 'es', ko: 'ko' },
    firstLetter: 'ㅏ', // FIRST_LETTER after #806: the first letter quest 1 teaches
    firstLetterRoman: 'a',
    card: { word: '호랑이', roman: 'horangi' },
    email: 'hello@hangulroute.com',
    SCHOOL_ADMIN_CAP: 2,
    SCHOOL_LEARNER_CAP: 50,
  };
})();
