import { z } from 'zod';

/**
 * Stage 2 contract: page_plan.json is validated at build time.
 * Keep changes versioned and interfaces stable.
 */

export const MetaSchema = z
  .object({
    projectName: z.string().min(1, 'meta.projectName is required'),
    generatedAt: z
      .string()
      .datetime({ offset: true })
      .or(z.string().datetime({ local: true }))
      .describe('ISO datetime string'),
    status: z.enum(['draft', 'review', 'approved']),
  })
  .strict();

export const SiteSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    favicon: z.string().min(1).optional(),
  })
  .strict();

export const TokensSchema = z
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

export const SectionSchema = z.discriminatedUnion('type', [
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
    /** Optional JSON Schema reference for editor tooling */
    $schema: z.string().min(1).optional(),
    meta: MetaSchema,
    site: SiteSchema,
    tokens: TokensSchema,
    sections: z.array(SectionSchema).min(1),
  })
  .strict();

export type Meta = z.infer<typeof MetaSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type Tokens = z.infer<typeof TokensSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type PagePlan = z.infer<typeof PagePlanSchema>;
