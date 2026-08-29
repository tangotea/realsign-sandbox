export type LessonGuide = {
  title: string;
  description: string;
  suitableFor: string;
  topics: string[];
};

export const TUTOR_LESSON_GUIDES: LessonGuide[] = [
  {
    title: "Beginner SASL",
    description: "A welcoming introduction to South African Sign Language and visual communication.",
    suitableFor: "New learners and learners building confidence with everyday signing.",
    topics: ["Introducing yourself and greetings", "Fingerspelling, names and numbers", "Days, dates, time and colours", "Basic questions and everyday signs"],
  },
  {
    title: "Fingerspelling",
    description: "Learn to fingerspell clearly and understand fingerspelled words in natural signing.",
    suitableFor: "Learners who want stronger names, places and unfamiliar-word skills.",
    topics: ["The SASL alphabet", "Fingerspelling names and places", "Reading fingerspelling", "Common fingerspelling mistakes"],
  },
  {
    title: "Everyday Conversation",
    description: "Practise natural conversations around familiar topics with a Deaf tutor.",
    suitableFor: "Learners who want to use SASL in daily life.",
    topics: ["Family and friends", "Daily routines and hobbies", "Food, shopping and plans", "Taking turns and asking follow-up questions"],
  },
  {
    title: "Receptive SASL Practice",
    description: "Build your ability to understand a Deaf person signing at a comfortable, natural pace.",
    suitableFor: "Learners who can sign some words but struggle to follow conversations.",
    topics: ["Understanding signs in context", "Following a signed story", "Natural-speed signing", "Fingerspelling, classifiers and facial grammar"],
  },
  {
    title: "Expressive SASL Practice",
    description: "Improve clarity, fluency and natural expression when you sign.",
    suitableFor: "Learners who want feedback on how they produce signs and sentences.",
    topics: ["Handshape, location and movement", "Facial expression and non-manual markers", "Signing naturally instead of word-for-word English", "Using signing space effectively"],
  },
  {
    title: "SASL Grammar",
    description: "Understand how SASL sentences are structured instead of translating directly from English.",
    suitableFor: "Learners ready to move beyond individual signs.",
    topics: ["Topic-comment structure", "Questions and negation", "Time markers and referencing", "Classifiers, role shifting and signing space"],
  },
  {
    title: "Storytelling in SASL",
    description: "Learn to describe people, events and experiences in a visual and engaging way.",
    suitableFor: "Learners who want to become more expressive and confident.",
    topics: ["Sequencing events", "Describing characters and movement", "Role shifting and classifiers", "Retelling a story clearly"],
  },
  {
    title: "Deaf Culture",
    description: "Learn respectful communication and gain insight into Deaf culture and community life.",
    suitableFor: "Anyone who wants to communicate respectfully with Deaf people.",
    topics: ["Deaf identity and community", "Getting attention and visual etiquette", "Lighting, seating and eye contact", "Common misconceptions and South African Deaf experiences"],
  },
  {
    title: "Practical SASL",
    description: "Learn useful SASL for family communication, education, healthcare or customer-facing work.",
    suitableFor: "Families and workers who need practical communication for a specific setting.",
    topics: ["Choose a practical setting", "Useful phrases and common questions", "Checking understanding", "Respectful communication and safety"],
  },
  {
    title: "Intermediate and Advanced SASL",
    description: "Develop more natural fluency, complex descriptions and confident conversation.",
    suitableFor: "Learners with a solid foundation in SASL.",
    topics: ["Longer conversations and opinions", "Complex classifiers and role shifting", "Abstract ideas and presentations", "Natural signing styles and receptive comprehension"],
  },
];

export const INTERPRETER_LESSON_GUIDES: LessonGuide[] = [
  {
    title: "Video Call SASL Interpreting",
    description: "Remote interpreting for conversations where clear visual communication is needed.",
    suitableFor: "Learners requesting a remote interpreting service.",
    topics: ["Video-call interpreting", "Turn-taking and clear communication", "Remote session preparation", "Confirming meaning and next steps"],
  },
  {
    title: "Education SASL Interpreting",
    description: "Interpreting support for school, college or other learning environments.",
    suitableFor: "Education-related interpreting requests.",
    topics: ["Classroom and lecture communication", "Questions and clarification", "Learning terminology", "Supporting accurate communication"],
  },
  {
    title: "Work or Appointment SASL Interpreting",
    description: "Interpreting support for workplace, service or appointment communication.",
    suitableFor: "Work, business and appointment-related requests.",
    topics: ["Workplace and appointment communication", "Specialist terms and context", "Clarifying information", "Planning the interpreting request"],
  },
  {
    title: "General SASL Interpreting",
    description: "Interpreting support for general conversations and situations.",
    suitableFor: "General interpreting requests that do not fit another category.",
    topics: ["Understanding the request", "Clear two-way communication", "Context and terminology", "Confirming important information"],
  },
];

export const LESSON_GUIDES = [...TUTOR_LESSON_GUIDES, ...INTERPRETER_LESSON_GUIDES];

export function lessonGuideForTitle(title?: string | null) {
  if (!title) return null;
  const exact = LESSON_GUIDES.find(guide => guide.title === title);
  if (exact) return exact;
  if (/^beginner sasl:/i.test(title)) return TUTOR_LESSON_GUIDES[0];
  return null;
}
