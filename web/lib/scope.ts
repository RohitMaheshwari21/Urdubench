// First line of the scope guard: questions asking for medical, legal or financial advice, or for
// something unsafe, are refused before any model call. The model prompt repeats the rule as a second line.
// Patterns target advice-seeking words, not topics: "Supreme Court kab bana?" is a history question.

export type OutOfScope = "medical" | "legal" | "financial" | "unsafe";

const RULES: [OutOfScope, RegExp][] = [
  [
    "unsafe",
    /\b(bomb|explosives?|make a weapon|kill (myself|someone)|suicide|khud ?kushi|hathiyar banana)\b|بم بنا|خودکشی|ہتھیار بنا/i,
  ],
  [
    "medical",
    /\b(dawai|dawa|medicine|medication|dose|dosage|tablets?|symptoms?|treatment|ilaj|diagnos\w*|doctor ko|bukhar|fever|pregnan\w*|hamal)\b|دوائی|دوا |علاج|بخار|علامات|خوراک کتنی|حمل/i,
  ],
  [
    "legal",
    /\b(lawyer|wakeel|vakeel|legal advice|sue|lawsuit|muqadma|muqaddama|talaq|divorce|zamanat|bail|f\.?i\.?r\b|court case|qanooni mashwara)\b|وکیل|مقدمہ|طلاق|ضمانت|قانونی مشورہ|ایف آئی آر/i,
  ],
  [
    "financial",
    /\b(invest\w*|stocks?|shares? (khareed|buy)|crypto\w*|bitcoin|forex|trading|loan|qarz|insurance|bima|sarmaya ?kari|paisa (kahan|kis mein) lagaun)\b|سرمایہ کاری|قرض|بیمہ|شیئرز|کرپٹو/i,
  ],
];

export function outOfScope(question: string): OutOfScope | null {
  for (const [kind, re] of RULES) if (re.test(question)) return kind;
  return null;
}

/** Urdu script if the question contains Arabic-script letters, else Roman Urdu / English. */
export function isUrduScript(text: string) {
  return /[؀-ۿ]/.test(text);
}

const REFUSAL: Record<OutOfScope, { ur: string; en: string }> = {
  medical: {
    ur: "معذرت، میں صحت یا دوا کے بارے میں مشورہ نہیں دے سکتا۔ براہِ کرم کسی ڈاکٹر سے رجوع کریں۔",
    en: "Sorry, I can't give medical advice. Please see a doctor (Maazrat, main sehat ya dawai ka mashwara nahin de sakta).",
  },
  legal: {
    ur: "معذرت، میں قانونی مشورہ نہیں دے سکتا۔ براہِ کرم کسی وکیل سے رجوع کریں۔",
    en: "Sorry, I can't give legal advice. Please talk to a lawyer (Maazrat, main qanooni mashwara nahin de sakta).",
  },
  financial: {
    ur: "معذرت، میں مالی یا سرمایہ کاری کا مشورہ نہیں دے سکتا۔",
    en: "Sorry, I can't give financial or investment advice (Maazrat, main maali mashwara nahin de sakta).",
  },
  unsafe: {
    ur: "معذرت، میں اس میں مدد نہیں کر سکتا۔ اگر آپ یا کوئی اور خطرے میں ہے تو فوراً 1122 پر کال کریں۔",
    en: "Sorry, I can't help with that. If you or someone else is in danger, call 1122 (Rescue) now.",
  },
};

export function refusal(kind: OutOfScope, question: string) {
  return REFUSAL[kind][isUrduScript(question) ? "ur" : "en"];
}

export function dontKnow(question: string) {
  return isUrduScript(question)
    ? "معذرت، مجھے اپنے ذرائع میں اس سوال کا جواب نہیں ملا۔"
    : "Sorry, I couldn't find the answer in my sources (Maazrat, mujhe apne zaraye mein iska jawab nahin mila).";
}

export const DISCLAIMER =
  "Informational only, from Urdu Wikipedia. Not medical, legal or financial advice. Check the sources.";
