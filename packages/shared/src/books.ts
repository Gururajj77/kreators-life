// The founder's three books (Shubham Aggarwal), the one list the Book page, Home's Books section and the public site read.
// Every word here is his: the titles and subtitles from each title page, the front cover's tagline, and the back cover word for word.
// The Relationship Method has no back cover in the founder's folder, so it carries its cover tagline and title-page subtitle only;
// nothing is written for it. A new book is one entry here, with its cover in apps/web/public/books.

/** One of the founder's books. */
export interface Book {
  /** The book's key in URLs and anchors (`/book#<slug>`). */
  slug: string;
  /** The real title, used everywhere (never the PDF's file name). */
  title: string;
  /** The subtitle from the book's own title page. */
  subtitle: string;
  author: string;
  /** Who wrote and published it, as the cover says; empty when the cover says nothing (The Relationship Method). */
  publisher: string;
  /** The front cover under apps/web/public (WebP). */
  cover: string;
  /** What the front cover shows, for screen readers. */
  coverAlt: string;
  /** The front cover's own line, where it has one. */
  tagline: string;
  /** The back cover, word for word, one string a paragraph; empty when there is none. */
  back: readonly string[];
  /** The back cover's "What's inside" lead and list, word for word; empty when there is none. */
  insideLead: string;
  inside: readonly string[];
  /** The back cover's closing line, word for word. */
  closing: string;
  /** The School program built from the book (its id in scripts/books/courses; `GET /public/books` also finds it by the book's title). */
  courseId: string;
  /** The `REWARDS` key that sends the printed book for points. */
  rewardKey: string;
}

export const BOOK_AUTHOR = 'Shubham Aggarwal';

export const BOOKS: readonly Book[] = [
  {
    slug: 'the-relationship-method',
    title: 'The Relationship Method',
    subtitle: "Clearing Your Emotional Backlog to Unlock Life's Natural Abundance",
    author: BOOK_AUTHOR,
    publisher: '',
    cover: '/books/the-relationship-method.webp',
    coverAlt: 'Front cover of The Relationship Method: a glowing pyramid of seven relationships under a night sky.',
    tagline: 'Unlock abundance with the 7 relationships pyramid',
    back: [],
    insideLead: '',
    inside: [],
    closing: '',
    courseId: 'prog-book-relationship-method',
    rewardKey: 'book_relationship_method',
  },
  {
    slug: 'dictionary-of-mistakes-for-creators',
    title: 'Dictionary of Mistakes for Creators',
    subtitle: 'A Diagnostic Manual for Breaking the Pattern of Invisibility',
    author: BOOK_AUTHOR,
    publisher: 'Written by Shubham Aggarwal | Published by FyndFlow',
    cover: '/books/dictionary-of-mistakes-for-creators.webp',
    coverAlt: 'Front cover of Dictionary of Mistakes for Creators: a curly-haired man in orange glasses on pink, with a For creators sticker.',
    tagline: '',
    back: [
      "Creating is full of ups, downs, and everything in between and mistakes? They're part of the process.",
      "The Dictionary of Mistakes is your companion through the journey of making, building, and creating. Whether you're an artist, entrepreneur, or content creator, this guide helps you see mistakes not as setbacks but as learning opportunities.",
      'Get ready to embrace imperfection, experiment with confidence, and grow your creative potential.',
    ],
    insideLead: "What's inside:",
    inside: ['How to handle creative blocks and self-doubt', 'Mistakes every creator makes (and how to learn from them)', 'Balancing your passion with the realities of work and life'],
    closing: 'For creators who dare to make mistakes, this is your guide to turning them into something brilliant.',
    courseId: 'prog-book-dom-creators',
    rewardKey: 'book_dictionary_of_mistakes',
  },
  {
    slug: 'dictionary-of-mistakes-for-20s',
    title: 'Dictionary of Mistakes for 20s',
    subtitle: 'A Field Guide to Fixing the Invisible Patterns Ruining Your 20s',
    author: BOOK_AUTHOR,
    publisher: 'Written & Published by Shubham Aggarwal',
    cover: '/books/dictionary-of-mistakes-for-20s.webp',
    coverAlt: 'Front cover of Dictionary of Mistakes for 20s: a woman in orange glasses on purple, with a For 20 year olds sticker.',
    tagline: '',
    back: [
      'Your 20s are wild, unpredictable, and full of the unknown sound familiar? The Dictionary of Mistakes is your pocket guide to getting through these crazy years with a little more clarity and a lot less stress.',
      "This isn't just about avoiding mistakes; it's about embracing them, learning, and moving forward. Whether it's work, relationships, or figuring out who you really are, this book helps you make sense of the missteps and turns them into something useful.",
    ],
    insideLead: "Here's what's inside:",
    inside: ['How to handle career confusion and find purpose', 'Navigating love, friendships, and everything in between', "Mistakes to avoid and lessons you'll thank yourself for later"],
    closing: "Because let's be real, your 20s aren't about perfection, they're about growth. Let's make those mistakes count!",
    courseId: 'prog-book-dom-20s',
    rewardKey: 'book_20_somethings',
  },
];

export const BOOK_BY_SLUG: Readonly<Record<string, Book>> = Object.assign(Object.create(null) as Record<string, Book>, Object.fromEntries(BOOKS.map((b) => [b.slug, b])));

/** Where each book can be had right now, from `GET /public/books`. Nothing here names a buyer. */
export interface BookState {
  slug: string;
  /** The Shop product under the founder's account: null when there is none yet. Only a live one has an id to open. */
  product: { id: string | null; live: boolean; priceCents: number; currency: string } | null;
  /** The School program built from the book: null until it is published. `cohortId` is the first open cohort, if any;
   *  `free` says it costs nothing, so the Book page may enrol the person in one tap (a priced one goes to School's own Enrol). */
  course: { id: string; name: string; cohortId: string | null; free: boolean } | null;
}

export interface BooksResponse {
  books: BookState[];
}
