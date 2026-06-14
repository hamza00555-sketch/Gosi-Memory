/**
 * Single source for Arabic UI strings. Centralizing them keeps copy out of
 * components and makes a future i18n layer (or tone tweaks) a one-file change.
 */
export const ar = {
  appName: 'قوسي',
  appNameLatin: 'QAWSI',
  tagline: 'لعبة الذاكرة التنافسية لفريقك',

  nav: {
    home: 'الرئيسية',
    store: 'المتجر',
    missions: 'المهام',
    profile: 'الملف',
  },

  modes: {
    solo_ai: 'ضد الذكاء',
    one_vs_one: '1 ضد 1',
    two_vs_two: '2 ضد 2',
  },

  modeDesc: {
    solo_ai: 'تدرّب ضد خصم ذكي',
    one_vs_one: 'تحدَّ زميلًا مباشرة',
    two_vs_two: 'فريقان يتنافسان',
  },

  lobby: {
    start: 'ابدأ اللعب',
    coins: 'النقاط',
    level: 'المستوى',
    storePreview: 'المتجر',
    missionsPreview: 'المهام اليومية',
    chooseMode: 'اختر نمط اللعب',
  },

  room: {
    create: 'إنشاء غرفة',
    join: 'انضمام بالرمز',
    codeLabel: 'رمز الغرفة',
    invite: 'رابط الدعوة',
    copyInvite: 'نسخ الرابط',
    ready: 'جاهز',
    notReady: 'لست جاهزًا',
    waiting: 'بانتظار اللاعبين',
    readyStatus: 'الجميع جاهز',
    startMatch: 'بدء المباراة',
    host: 'المضيف',
    players: 'اللاعبون',
    leave: 'مغادرة',
  },

  game: {
    yourTurn: 'دورك',
    opponentTurn: 'دور الخصم',
    timeLeft: 'الوقت',
    score: 'النقاط',
    hiddenPhrase: 'الجملة المخفية',
    scan: 'امسح البطاقة',
    hint: 'تلميح',
    solve: 'حل الجملة',
    solvePlaceholder: 'اكتب الجملة كاملة',
    submit: 'إرسال',
    cancel: 'إلغاء',
    matched: 'مطابقة!',
    missed: 'لا تطابق',
    log: 'السجل',
  },

  results: {
    title: 'النتيجة',
    winner: 'الفائز',
    draw: 'تعادل',
    youWon: 'لقد فزت!',
    youLost: 'حظًا أوفر',
    scoreBreakdown: 'تفاصيل النقاط',
    matchedPairs: 'الأزواج المطابقة',
    phraseSolved: 'تم حل الجملة',
    phraseUnsolved: 'لم تُحل الجملة',
    rewards: 'المكافآت',
    playAgain: 'العب مجددًا',
    backHome: 'الرئيسية',
  },

  store: {
    title: 'المتجر',
    subtitle: 'تجميلية فقط — لا شراء للقوة',
    owned: 'مملوك',
    selected: 'مُختار',
    select: 'اختيار',
    buy: 'شراء',
    locked: 'مقفل',
    categories: {
      card_skin: 'أظهر البطاقات',
      ar_set: 'مجموعات AR',
      match_effect: 'تأثير المطابقة',
      victory_effect: 'تأثير الفوز',
    },
  },

  common: {
    loading: 'جارٍ التحميل…',
    back: 'رجوع',
    close: 'إغلاق',
    you: 'أنت',
    vs: 'ضد',
  },
} as const;

export type Strings = typeof ar;
