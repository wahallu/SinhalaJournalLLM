/**
 * UI copy, English and Sinhala.
 *
 * Sinhala is stored here as UNICODE, always — it is the reviewable,
 * greppable, correct form, and it is what assistive technology is given at
 * render time. The legacy (ubin16s / FM / Su-Nirmala) form the newsroom
 * expects to *see* is derived from it by lib/sinhalaLegacy.unicodeToLegacy,
 * which is already covered by its own round-trip tests.
 *
 * Writing the legacy form by hand instead would mean storing strings like
 * "WmlrK mqjrej" that nobody can proofread, search, or spell-check, and that
 * silently become gibberish the moment a glyph slot is wrong. Deriving it
 * means a reviewer reads "උපකරණ පුවරුව" and the encoding is a build detail.
 *
 * Scope is the user-facing shell — navigation, dashboard, the four writing
 * tools, account screens and auth. The admin console stays English: it is
 * operator tooling, not journalist-facing.
 */

export const LANGUAGES = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'si', label: 'සිංහල', short: 'සිං' },
];

export const DEFAULT_LANGUAGE = 'en';

export const STRINGS = {
  // ── Navigation ──
  'nav.dashboard': ['Dashboard', 'උපකරණ පුවරුව'],
  'nav.grammar': ['Grammar Checker', 'ව්‍යාකරණ පරීක්ෂකය'],
  'nav.headlines': ['Headline Generator', 'ශීර්ෂ පාඨ ජනකය'],
  'nav.rewriter': ['Style Rewriter', 'ශෛලිය නැවත ලිවීම'],
  'nav.summarizer': ['News Summarizer', 'ප්‍රවෘත්ති සාරාංශකය'],
  'nav.history': ['History', 'ඉතිහාසය'],
  'nav.upgrade': ['Upgrade', 'උසස් කරන්න'],
  'nav.signIn': ['Sign in', 'ඇතුල් වන්න'],
  'nav.signOut': ['Sign out', 'ඉවත් වන්න'],
  'nav.profile': ['View profile', 'පැතිකඩ බලන්න'],
  'nav.plans': ['Plans', 'සැලසුම්'],
  'nav.feedback': ['Give us your feedback', 'ඔබේ අදහස් දක්වන්න'],
  'nav.feedbackHint': ['Takes a minute', 'විනාඩියක් ගතවේ'],
  'nav.lightMode': ['Light mode', 'ආලෝක ප්‍රකාරය'],
  'nav.darkMode': ['Dark mode', 'අඳුරු ප්‍රකාරය'],
  'nav.primary': ['Primary navigation', 'ප්‍රධාන සංචාලනය'],
  'nav.guest': ['Guest', 'අමුත්තා'],
  'nav.notSignedIn': ['Not signed in', 'ඇතුල් වී නැත'],

  // ── Dashboard ──
  'dash.morning': ['Good morning', 'සුබ උදෑසනක්'],
  'dash.afternoon': ['Good afternoon', 'සුබ දහවලක්'],
  'dash.evening': ['Good evening', 'සුබ සැන්දෑවක්'],
  'dash.late': ['Working late', 'රාත්‍රී වැඩ'],
  'dash.tagline': [
    'The first AI writing assistant built for Sinhala journalism',
    'සිංහල පුවත්පත් කලාව සඳහා තැනූ පළමු කෘත්‍රිම බුද්ධි ලේඛන සහායකයා',
  ],
  'dash.journalist': ['Journalist', 'පුවත්පත් කලාවේදියා'],
  'dash.writingTools': ['Writing tools', 'ලේඛන මෙවලම්'],
  'dash.recentActivity': ['Recent activity', 'මෑත ක්‍රියාකාරකම්'],
  'dash.freeNotice': [
    'All four writing tools are free to use without an account.',
    'මෙවලම් හතරම ගිණුමක් නොමැතිව නොමිලේ භාවිත කළ හැක.',
  ],
  'dash.saveWork': ['Sign in to save your work', 'ඔබේ වැඩ සුරැකීමට ඇතුල් වන්න'],
  'dash.signInActivity': ['Sign in to see your activity', 'ඔබේ ක්‍රියාකාරකම් බැලීමට ඇතුල් වන්න'],
  'dash.totalRuns': ['Total runs', 'මුළු ධාවන'],
  'dash.acrossTools': ['Across all tools', 'සියලු මෙවලම් හරහා'],
  'dash.unavailable': ['Unavailable', 'නොලැබේ'],

  'dash.mostUsed': ['Most used', 'වැඩිපුර භාවිත'],
  'dash.signInActivityDesc': [
    'Your runs are saved to your account. The writing tools work without one, but nothing is kept.',
    'ඔබේ ධාවන ගිණුමට සුරැකේ. ගිණුමක් නොමැතිව මෙවලම් ක්‍රියා කරයි, නමුත් කිසිවක් සුරැකෙන්නේ නැත.',
  ],
  'dash.noActivity': ['No activity yet', 'තවම ක්‍රියාකාරකම් නැත'],
  'dash.noActivityDesc': [
    'Run any writing tool and your recent work will appear here.',
    'ඕනෑම මෙවලමක් ධාවනය කරන්න, ඔබේ මෑත වැඩ මෙහි දිස්වේ.',
  ],
  'dash.loadFailed': ["Couldn't load your activity", 'ඔබේ ක්‍රියාකාරකම් පූරණය කළ නොහැකි විය'],

  // ── Tools ──
  'tool.grammarDesc': [
    'Fix Sinhala spelling, grammar, and agreement issues.',
    'සිංහල අක්ෂර වින්‍යාසය, ව්‍යාකරණ සහ එකඟතා දෝෂ නිවැරදි කරන්න.',
  ],
  'tool.headlinesDesc': [
    'Generate ranked headline candidates from an article.',
    'ලිපියකින් ශ්‍රේණිගත ශීර්ෂ පාඨ නිර්මාණය කරන්න.',
  ],
  'tool.rewriterDesc': [
    'Shift copy between formal, editorial, sports, and youth desks.',
    'විධිමත්, කතුවැකි, ක්‍රීඩා සහ තරුණ ශෛලීන් අතර මාරු කරන්න.',
  ],
  'tool.summarizerDesc': [
    'Condense long-form articles into tight summaries.',
    'දිගු ලිපි කෙටි සාරාංශ බවට පත් කරන්න.',
  ],
  'tool.optimize': ['Optimize Article', 'ලිපිය ප්‍රශස්ත කරන්න'],
  'tool.optimizeDesc': [
    'Correct, restyle, headline, and summarize in one run.',
    'එක් ධාවනයකින් නිවැරදි කර, ශෛලිය වෙනස් කර, ශීර්ෂය සහ සාරාංශය සාදන්න.',
  ],
  'tool.correct': ['Correct', 'නිවැරදි කරන්න'],
  'tool.generate': ['Generate', 'නිර්මාණය කරන්න'],
  'tool.rewrite': ['Rewrite', 'නැවත ලියන්න'],
  'tool.summarize': ['Summarize', 'සාරාංශ කරන්න'],
  'tool.result': ['Result', 'ප්‍රතිඵලය'],
  'tool.generatedHeadlines': ['Generated headlines', 'නිර්මිත ශීර්ෂ පාඨ'],
  'tool.apply': ['Apply', 'යොදන්න'],
  'tool.clear': ['Clear', 'හිස් කරන්න'],
  'tool.signInToSave': [
    'Sign in to save this to your history.',
    'මෙය ඔබේ ඉතිහාසයට සුරැකීමට ඇතුල් වන්න.',
  ],

  // ── Profile ──
  'profile.title': ['Profile', 'පැතිකඩ'],
  'profile.account': ['Account', 'ගිණුම'],
  'profile.preferences': ['Preferences', 'අභිරුචි'],
  'profile.usage': ['Usage', 'භාවිතය'],
  'profile.security': ['Security', 'ආරක්ෂාව'],
  'profile.displayName': ['Display name', 'දර්ශන නාමය'],
  'profile.addName': ['Add your name', 'ඔබේ නම එක් කරන්න'],
  'profile.member': ['Member', 'සාමාජික'],
  'profile.administrator': ['Administrator', 'පරිපාලක'],
  'profile.newsroomRoles': ['Newsroom roles', 'පුවත්පත් භූමිකා'],
  'profile.newsroomCategory': ['Newsroom category', 'පුවත්පත් වර්ගය'],
  'profile.interests': ['Interests', 'උනන්දුව'],
  'profile.noneSelected': ['None selected yet', 'තවම තෝරා නැත'],
  'profile.notSpecified': ['Not specified', 'සඳහන් කර නැත'],
  'profile.signInEmail': ['Sign-in email', 'ඇතුල්වීමේ විද්‍යුත් තැපෑල'],
  'profile.emailVerification': ['Email verification', 'විද්‍යුත් තැපැල් සත්‍යාපනය'],
  'profile.verified': ['Verified', 'සත්‍යාපිතයි'],
  'profile.verificationPending': ['Verification pending', 'සත්‍යාපනය අපේක්ෂිතයි'],
  'profile.saveChanges': ['Save changes', 'වෙනස්කම් සුරකින්න'],
  'profile.saving': ['Saving…', 'සුරකිමින්...'],
  'profile.saved': ['Profile saved', 'පැතිකඩ සුරකින ලදී'],
  'profile.discard': ['Discard', 'ඉවත ලන්න'],
  'profile.unsaved': ['You have unsaved changes', 'සුරකින නොලද වෙනස්කම් ඇත'],
  'profile.today': ['Today', 'අද'],
  'profile.thisWeek': ['This week', 'මෙම සතිය'],
  'profile.activeDays': ['Active days', 'ක්‍රියාකාරී දින'],

  // ── Plans ──
  'plans.title': ['Upgrade your workflow', 'ඔබේ කාර්යප්‍රවාහය උසස් කරන්න'],
  'plans.subtitle': [
    'Where SinAi is heading for newsrooms writing, editing, and publishing in Sinhala.',
    'සිංහලෙන් ලිවීම, සංස්කරණය සහ ප්‍රකාශනය කරන පුවත්පත් සඳහා SinAi යන දිශාව.',
  ],
  'plans.notAvailable': [
    'Paid plans are not available yet — every tool is currently free to use.',
    'ගෙවුම් සැලසුම් තවම නොමැත – සියලු මෙවලම් දැනට නොමිලේ භාවිත කළ හැක.',
  ],
  'plans.includes': ['Includes', 'ඇතුළත් වේ'],
  'plans.currentPlan': ['Current plan', 'වත්මන් සැලසුම'],
  'plans.perDay': ['requests per day', 'දෛනික ඉල්ලීම්'],
  'plans.unlimited': ['Unlimited daily requests', 'අසීමිත දෛනික ඉල්ලීම්'],
  'plans.perMonth': ['per month', 'මසකට'],
  'plans.perYear': ['per year', 'වසරකට'],
  'plans.oneOff': ['one-off', 'එක් වරක්'],

  'plans.upgrade': ['Upgrade', 'උසස් කරන්න'],
  'plans.upgradeTo': ['Upgrade to', 'උසස් කරන්න'],
  'plans.howToPay': ['How to pay', 'ගෙවන ආකාරය'],
  'plans.bankTransferIntro': [
    'Transfer the amount to the account below, then enter your bank reference. An administrator confirms the payment and moves you onto the plan.',
    'පහත ගිණුමට මුදල් යවා, ඔබේ බැංකු යොමුව ඇතුළත් කරන්න. පරිපාලකයෙකු ගෙවීම තහවුරු කර ඔබව සැලසුමට මාරු කරයි.',
  ],
  'plans.bank': ['Bank', 'බැංකුව'],
  'plans.accountName': ['Account name', 'ගිණුමේ නම'],
  'plans.accountNumber': ['Account number', 'ගිණුම් අංකය'],
  'plans.branch': ['Branch', 'ශාඛාව'],
  'plans.reference': ['Bank reference', 'බැංකු යොමුව'],
  'plans.referenceHint': [
    'The reference printed on your transfer slip.',
    'ඔබේ මුදල් යැවීමේ පත්‍රිකාවේ ඇති යොමුව.',
  ],
  'plans.noteOptional': ['Note (optional)', 'සටහන (අත්‍යවශ්‍ය නොවේ)'],
  'plans.submitRequest': ['Submit request', 'ඉල්ලීම යවන්න'],
  'plans.requestPending': ['Upgrade request pending review', 'උසස් කිරීමේ ඉල්ලීම සමාලෝචනය වෙමින්'],
  'plans.requestPendingBody': [
    'An administrator is checking your payment. Your plan changes once it is confirmed.',
    'පරිපාලකයෙකු ඔබේ ගෙවීම පරීක්ෂා කරමින් සිටී. එය තහවුරු වූ පසු ඔබේ සැලසුම වෙනස් වේ.',
  ],
  'plans.requestDeclined': ['Your last request was declined', 'ඔබේ අවසන් ඉල්ලීම ප්‍රතික්ෂේප විය'],
  'plans.cancelRequest': ['Cancel request', 'ඉල්ලීම අවලංගු කරන්න'],
  'plans.noBankDetails': [
    'Payment details have not been set up yet. Please contact the newsroom.',
    'ගෙවීම් තොරතුරු තවම සකසා නැත. කරුණාකර පුවත්පත් කාර්යාලය අමතන්න.',
  ],
  'plans.saveVsMonthly': ['a year', 'වසරකට'],

  // ── Auth ──
  'auth.signIn': ['Sign in', 'ඇතුල් වන්න'],
  'auth.signUp': ['Create account', 'ගිණුමක් සාදන්න'],
  'auth.email': ['Email', 'විද්‍යුත් තැපෑල'],
  'auth.password': ['Password', 'මුරපදය'],
  'auth.fullName': ['Full name', 'සම්පූර්ණ නම'],
  'auth.forgot': ['Forgot your password?', 'මුරපදය අමතකද?'],
  'auth.noAccount': ['No account?', 'ගිණුමක් නැද්ද?'],
  'auth.createOne': ['Create one', 'එකක් සාදන්න'],
  'auth.haveAccount': ['Already have an account?', 'දැනටමත් ගිණුමක් තිබේද?'],
  'auth.continueWorkspace': [
    'Continue to your SinAi workspace.',
    'ඔබේ SinAi ක්‍රියාවලියට පිවිසෙන්න.',
  ],

  // ── Common ──
  'common.language': ['Language', 'භාෂාව'],
  'common.cancel': ['Cancel', 'අවලංගු කරන්න'],
  'common.close': ['Close', 'වසන්න'],
  'common.loading': ['Loading', 'පූරණය වෙමින්'],
  'common.retry': ['Try again', 'නැවත උත්සාහ කරන්න'],
};

/** Every key, for the completeness test. */
export const STRING_KEYS = Object.keys(STRINGS);
