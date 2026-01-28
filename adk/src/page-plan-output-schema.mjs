import { z } from 'zod';

// Keep this in sync with src/lib/schema.ts (skeleton). We intentionally
// duplicate the schema (instead of importing TypeScript) so this generator can
// run standalone inside the agent container.

const MetaSchema = z
  .object({
    projectName: z.string().min(1),
    generatedAt: z.string().min(1),
    status: z.enum(['draft', 'review', 'approved']),
  })
  .strict();

const SiteSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    favicon: z.string().min(1).optional(),
  })
  .strict();

const TokensSchema = z
  .object({
    colorPrimary: z.string().min(1),
    colorAccent: z.string().min(1),
  })
  .strict();

const HeroSectionSchema = z
  .object({
    type: z.literal('hero'),
    variant: z.enum(['centered', 'split', 'video-bg']),
    props: z
      .object({
        headline: z.string().min(1),
        subheadline: z.string().min(1).optional(),
        ctaText: z.string().min(1).optional(),
        ctaLink: z.string().min(1).optional(),
        backgroundImage: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const ServicesSectionSchema = z
  .object({
    type: z.literal('services'),
    variant: z.enum(['grid', 'list', 'cards']),
    props: z
      .object({
        headline: z.string().min(1),
        items: z
          .array(
            z
              .object({
                title: z.string().min(1),
                description: z.string().min(1),
                icon: z.string().min(1).optional(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

const AboutSectionSchema = z
  .object({
    type: z.literal('about'),
    variant: z.enum(['split', 'centered', 'timeline']),
    props: z
      .object({
        headline: z.string().min(1),
        content: z.string().min(1),
        image: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const TestimonialsSectionSchema = z
  .object({
    type: z.literal('testimonials'),
    variant: z.enum(['carousel', 'grid', 'single']),
    props: z
      .object({
        headline: z.string().min(1).optional(),
        items: z
          .array(
            z
              .object({
                quote: z.string().min(1),
                author: z.string().min(1),
                role: z.string().min(1).optional(),
                avatar: z.string().min(1).optional(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

const FaqSectionSchema = z
  .object({
    type: z.literal('faq'),
    variant: z.enum(['accordion', 'two-column', 'simple']),
    props: z
      .object({
        headline: z.string().min(1).optional(),
        items: z
          .array(
            z
              .object({
                question: z.string().min(1),
                answer: z.string().min(1),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

const CtaSectionSchema = z
  .object({
    type: z.literal('cta'),
    variant: z.enum(['banner', 'split', 'minimal']),
    props: z
      .object({
        headline: z.string().min(1),
        subheadline: z.string().min(1).optional(),
        ctaText: z.string().min(1),
        ctaLink: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const ContactSectionSchema = z
  .object({
    type: z.literal('contact'),
    variant: z.enum(['simple', 'split-map', 'form']),
    props: z
      .object({
        headline: z.string().min(1),
        email: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        address: z.string().min(1).optional(),
        formAction: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const SectionSchema = z.discriminatedUnion('type', [
  HeroSectionSchema,
  ServicesSectionSchema,
  AboutSectionSchema,
  TestimonialsSectionSchema,
  FaqSectionSchema,
  CtaSectionSchema,
  ContactSectionSchema,
]);

export const PagePlanSchema = z
  .object({
    $schema: z.string().min(1).optional(),
    meta: MetaSchema,
    site: SiteSchema,
    tokens: TokensSchema,
    sections: z.array(SectionSchema).min(1),
  })
  .strict();
