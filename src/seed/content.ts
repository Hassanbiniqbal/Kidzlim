/**
 * Launch content for the Kidzlim book store, adapted from the original kidzlim.com copy.
 * Voice: warm, faith-centred, parent-facing ("Deen", "barakah", "Little Muslims, Big Faith").
 * Every page is editable afterwards in the admin panel.
 */
import type { Page } from '../payload-types'
import { lexical, md } from './lexical'

type Layout = NonNullable<Page['layout']>
export type MediaIds = { treasure: number; running: number; creativeMonsters: number; usmanHusna: number }

const LAST_UPDATED = '13 October 2026'

export const homeLayout = (m: MediaIds): Layout => [
  {
    blockType: 'hero',
    eyebrow: 'Little Muslims, Big Faith',
    heading: 'Faith-Based Stories',
    subheading:
      'Beautifully illustrated Islamic books that help children love Allah, the Quran and good character — printed and delivered to your door, or downloaded instantly as PDF.',
    ctaLabel: 'Browse the books',
    ctaLink: '/books',
    image: m.treasure,
  },
  {
    blockType: 'features',
    anchor: 'about',
    heading: 'Turn Story Time into Deen Time',
    intro:
      'Every Kidzlim book turns a few quiet minutes together into a moment of learning, reflection and reward — rooted in the Quran, good values and a whole lot of fun.',
    image: m.running,
    columns: '2',
    items: [
      {
        icon: 'shield',
        title: 'Rooted in Quran & Sunnah',
        text: 'Stories written with care to reflect authentic Islamic teachings, so you can read along with complete peace of mind.',
      },
      {
        icon: 'heart',
        title: 'Faith on Every Page',
        text: 'From the Prophets to Salah, duas and kindness — each book gently nurtures your child’s connection with Allah.',
      },
      {
        icon: 'sparkles',
        title: 'Read. Reflect. Grow.',
        text: 'Simple questions and reflections help children carry each lesson from the page into everyday life.',
      },
      {
        icon: 'users',
        title: 'Made for Little Hands',
        text: 'Bright illustrations, clear text and age-matched stories — from first read-alouds to confident young readers.',
      },
    ],
  },
  {
    blockType: 'features',
    anchor: 'themes',
    heading: 'Stories for Every Little Muslim',
    intro: 'Explore themes that grow with your child, every step of their Deen journey.',
    columns: '3',
    items: [
      {
        icon: 'star',
        title: 'Stories of the Prophets',
        text: 'Timeless lessons of patience, honesty and trust in Allah, told in a way young hearts understand.',
      },
      {
        icon: 'book',
        title: 'Quran & Surah Stories',
        text: 'Meet the meanings behind short surahs and help your child build a lifelong love for the Quran.',
      },
      {
        icon: 'globe',
        title: 'Arabic First Words',
        text: 'Playful vocabulary books that make the letters and words of the Quran feel familiar and fun.',
      },
      {
        icon: 'leaf',
        title: 'Akhlaq & Good Character',
        text: 'Kindness, sharing, gratitude and respect for parents — moral values brought to life through story.',
      },
      {
        icon: 'moon',
        title: 'Duas & Daily Sunnah',
        text: 'Morning and bedtime duas, Salah and everyday sunnah, woven into gentle routines your child will love.',
      },
      {
        icon: 'pen',
        title: 'Creative Activity Books',
        text: 'Drawing, colouring and crafts inspired by Islamic heritage — where learning meets imagination.',
      },
    ],
  },
  {
    blockType: 'bookGrid',
    heading: 'Featured Books',
    source: 'featured',
    limit: 8,
  },
  {
    blockType: 'features',
    anchor: 'formats',
    heading: 'Two Ways to Read',
    intro: 'Choose the format that suits your family — or get both.',
    image: m.creativeMonsters,
    columns: '2',
    items: [
      {
        icon: 'printer',
        title: 'Printed Books',
        text: 'Premium paperback and hardcover editions, printed on demand and delivered to your door. Real shipping costs are shown before you pay.',
      },
      {
        icon: 'download',
        title: 'Digital PDF',
        text: 'Instant download after checkout — perfect for travel, bedtime on the go, or printing activity pages at home.',
      },
    ],
  },
  {
    blockType: 'faq',
    heading: 'Questions from Parents',
    items: [
      {
        question: 'What ages are Kidzlim books for?',
        answer: md(
          'Our stories are written for young readers from early childhood through the primary years. Every book shows its recommended age range on its page, so you can pick the right one for your child.',
        ),
      },
      {
        question: 'Are the stories authentic?',
        answer: md(
          'Yes. Each story is written to reflect the teachings of the Quran and authentic Sunnah, with care taken over every word and illustration so you can share it with confidence.',
        ),
      },
      {
        question: 'How do printed books get to me?',
        answer: md(
          'Printed books are produced on demand by our print partner and shipped directly to your address. The exact shipping cost and estimated delivery time are shown at checkout, before you pay.',
        ),
      },
      {
        question: 'How do digital PDF downloads work?',
        answer: md(
          'Right after payment you’ll receive an email with a secure download link. The link stays active for 48 hours and can be used up to 5 times, so you can save the book to the devices you read on.',
        ),
      },
      {
        question: 'I can’t find my download email. What should I do?',
        answer: md(
          'First check your spam or promotions folder. If it’s not there, use [Resend my download](/downloads/resend) with your email and order number and we’ll send a fresh link straight away.',
        ),
      },
      {
        question: 'Which countries do you deliver to?',
        answer: md(
          'Printed books can be delivered to the countries listed at checkout, and we’re adding more over time. Digital PDFs are available worldwide.',
        ),
      },
      {
        question: 'How do I pay?',
        answer: md(
          'Payments are handled securely by Stripe — we never see or store your card details. Prices are in UAE Dirham (AED) and include VAT where applicable.',
        ),
      },
    ],
  },
  {
    blockType: 'cta',
    heading: 'Give your child a joyful, halal way to learn and grow',
    body: 'Browse our growing library of Islamic children’s books and turn story time into Deen time. No fuss. Just barakah.',
    buttonLabel: 'Shop the books',
    buttonLink: '/books',
  },
]

export const aboutLayout = (m: MediaIds): Layout => [
  {
    blockType: 'hero',
    eyebrow: 'About Kidzlim',
    heading: 'Little Muslims, Big Faith',
    subheading:
      'We create Islamic children’s books that make faith joyful — stories that help little ones love Allah, the Quran and good character, one page at a time.',
    image: m.usmanHusna,
  },
  {
    blockType: 'richText',
    content: lexical([
      { h2: 'Why we make these books' },
      {
        p: 'Parents everywhere are looking for stories they can trust — books that are fun to read, beautiful to look at and true to our Deen. Kidzlim began with a simple wish: to give every Muslim child stories that feel like theirs.',
      },
      {
        p: 'Since 2018 we have been creating Islamic content for children and families. Our books bring that same care to the printed page: authentic teachings, warm characters and illustrations children want to return to again and again.',
      },
      { h2: 'What guides us' },
      {
        ul: [
          '**Authenticity first** — every story is written to reflect the Quran and authentic Sunnah.',
          '**Joy in learning** — faith should feel exciting, never like homework.',
          '**Character that lasts** — patience, honesty, kindness and gratitude, shown through story.',
          '**For every family** — printed editions delivered to your door, or instant PDFs wherever you are.',
        ],
      },
      { h2: 'Part of NZM Group' },
      {
        p: 'Kidzlim is proudly part of [NZMGROUP.CO](https://www.nzmgroup.co), a house of brands. Follow us on [Instagram](https://www.instagram.com/kidzlim), [Facebook](https://www.facebook.com/kidzlim1/), [YouTube](https://www.youtube.com/@kidzlim) and [TikTok](https://www.tiktok.com/@kidzlim) for new releases and family reading ideas.',
      },
    ]),
  },
  {
    blockType: 'cta',
    heading: 'Start your child’s next story',
    body: 'Find books by age and theme, in print or as an instant download.',
    buttonLabel: 'Browse the books',
    buttonLink: '/books',
  },
]

export const privacyLayout = (): Layout => [
  {
    blockType: 'richText',
    content: lexical([
      { p: `**Last updated:** ${LAST_UPDATED}` },
      {
        p: 'This Privacy Policy explains how Kidzlim (“we”, “us”) collects and uses personal information when you visit our website or buy our books. We only collect what we need to run our store and look after your order.',
      },
      { h2: 'Information we collect' },
      {
        ul: [
          '**Order details** — your name, email address, the books you buy and, for printed books, your shipping address and phone number.',
          '**Payment information** — card payments are processed by Stripe. We never see or store your full card details.',
          '**Messages** — anything you send us when you contact support.',
          '**Technical data** — basic information such as browser type and pages visited, used to keep the site secure and working.',
        ],
      },
      { h2: 'How we use your information' },
      {
        ul: [
          'To process payments and fulfil your order, including printing and shipping physical books.',
          'To deliver digital books, including emailing secure download links. Digital files may be marked with the purchaser’s email address to discourage unauthorised sharing.',
          'To send order confirmations, shipping updates and support replies.',
          'To meet our legal, tax and accounting obligations.',
          'To prevent fraud and keep our store secure.',
        ],
      },
      {
        p: 'We will only send you marketing emails if you have opted in, and you can unsubscribe at any time.',
      },
      { h2: 'Who we share it with' },
      {
        p: 'We share personal information only with trusted service providers who help us run the store, and only as much as they need:',
      },
      {
        ul: [
          '**Stripe** — payment processing ([Stripe Privacy Policy](https://stripe.com/privacy)).',
          '**Gelato** — printing and delivering physical books.',
          '**Brevo** — sending order and download emails.',
          '**Our hosting provider** — storing website and order data securely.',
        ],
      },
      { p: 'We do not sell your personal information.' },
      { h2: 'Children’s privacy' },
      {
        p: 'Our books are for children, but our store is for parents and guardians. Purchases must be made by an adult, and we do not knowingly collect personal information from children.',
      },
      { h2: 'Cookies' },
      {
        p: 'We use essential cookies only — for example, to keep items in your basket and to secure checkout. We do not use advertising cookies. If this changes, we will update this policy and ask for your consent where required.',
      },
      { h2: 'How long we keep your data' },
      {
        p: 'We keep order records for as long as needed to provide our services and to meet legal and tax requirements. Download links expire automatically after a short period.',
      },
      { h2: 'Your rights' },
      {
        p: 'You can ask to access, correct or delete the personal information we hold about you, subject to legal requirements. Contact us and we will respond as soon as we can.',
      },
      { h2: 'Changes to this policy' },
      {
        p: 'We may update this Privacy Policy from time to time. Changes take effect when they are posted on this page, and we will update the “Last updated” date above.',
      },
      { h2: 'Contact us' },
      { p: 'Questions about your privacy? Reply to any order email or contact us through our social channels.' },
    ]),
  },
]

export const termsLayout = (): Layout => [
  {
    blockType: 'richText',
    content: lexical([
      { p: `**Last updated:** ${LAST_UPDATED}` },
      {
        p: 'These Terms of Use apply when you browse the Kidzlim website or buy our printed or digital books. By placing an order you agree to these terms, so please read them carefully.',
      },
      { h2: 'Who we are' },
      { p: 'The Kidzlim store is operated by Kidzlim, part of NZMGROUP.CO (House of Brands).' },
      { h2: 'Orders and pricing' },
      {
        ul: [
          'Prices are shown in UAE Dirham (AED) and include VAT where applicable.',
          'Shipping costs for printed books are calculated at checkout from your delivery address and shown before you pay.',
          'Your order is confirmed once payment has been successfully processed. We will email you a confirmation.',
          'We may cancel an order and issue a full refund if a book becomes unavailable or a pricing error occurs.',
        ],
      },
      { h2: 'Printed books' },
      {
        ul: [
          'Printed books are made to order by our print partner and shipped directly to you.',
          'Delivery times shown at checkout are estimates and may vary by destination.',
          'Because each copy is printed for you, an order can only be cancelled before it enters production.',
          'If your book arrives damaged or misprinted, please contact us with your order number and a photo and we will make it right.',
        ],
      },
      { h2: 'Digital books (PDF)' },
      {
        ul: [
          'After payment you will receive a secure download link by email. Links expire after a limited time and number of downloads.',
          'Digital books are licensed for personal, non-commercial use within your household. You may print copies for your own family.',
          'You may not share, resell, upload or distribute digital files. Files may be marked with the purchaser’s email address.',
          'Because digital books are delivered immediately, they are generally non-refundable once downloaded, unless the file is faulty.',
        ],
      },
      { h2: 'Intellectual property' },
      {
        p: 'All stories, illustrations, characters, logos and other content are owned by or licensed to Kidzlim and protected by copyright and trademark law. You may not copy or reuse them without our written permission.',
      },
      { h2: 'Using our website' },
      {
        p: 'Please do not misuse the website — for example, by trying to access it in unauthorised ways or interfering with its security. We may suspend access if we believe these terms have been broken.',
      },
      { h2: 'Liability' },
      {
        p: 'We take great care with our books and website, but to the extent permitted by law we are not liable for indirect or consequential losses. Nothing in these terms limits your statutory rights as a consumer.',
      },
      { h2: 'Changes to these terms' },
      {
        p: 'We may update these terms from time to time. The version on this page at the time of your order applies to that order.',
      },
      { h2: 'Contact us' },
      { p: 'Questions about these terms or an order? Reply to any order email and our team will help.' },
    ]),
  },
]

export const PAGE_SEO = {
  home: {
    metaTitle: 'Kidzlim | Islamic Books for Kids — Printed & PDF',
    metaDescription:
      'Beautifully illustrated Islamic children’s books: stories of the Prophets, Quran, Arabic, duas and good character. Printed and delivered, or instant PDF download.',
  },
  about: {
    metaTitle: 'About Kidzlim — Little Muslims, Big Faith',
    metaDescription:
      'Kidzlim creates authentic, joyful Islamic children’s books that help little ones love Allah, the Quran and good character.',
  },
  'privacy-policy': {
    metaTitle: 'Privacy Policy',
    metaDescription: 'How Kidzlim collects, uses and protects your personal information when you shop for books.',
  },
  'terms-of-use': {
    metaTitle: 'Terms of Use',
    metaDescription: 'Terms for buying printed and digital Islamic children’s books from Kidzlim.',
  },
} as const
