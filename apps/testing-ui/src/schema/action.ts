import { z } from 'zod';

/**
 * Locator hint. The runner uses these to resolve a Playwright `Locator`. The
 * MVP resolver tries role + name, then accessible text, then an explicit
 * selector. `position` is reserved for an AI fallback that picks the right
 * candidate when more than one element matches.
 */
export const hintSchema = z.object({
  text: z.string().min(1).optional(),
  role: z
    .enum([
      'alert',
      'banner',
      'button',
      'checkbox',
      'combobox',
      'dialog',
      'form',
      'heading',
      'link',
      'list',
      'listitem',
      'main',
      'menu',
      'menuitem',
      'navigation',
      'option',
      'progressbar',
      'radio',
      'region',
      'row',
      'searchbox',
      'status',
      'switch',
      'tab',
      'table',
      'textbox',
    ])
    .optional(),
  selector: z.string().min(1).optional(),
  position: z.enum(['header', 'main', 'footer', 'modal']).optional(),
});

export type Hint = z.infer<typeof hintSchema>;

export const stepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('navigate'),
    path: z.string().startsWith('/'),
  }),
  z.object({
    kind: z.literal('click'),
    hint: hintSchema,
  }),
  z.object({
    kind: z.literal('input'),
    hint: hintSchema,
    value: z.string(),
  }),
  z.object({
    kind: z.literal('scroll'),
    direction: z.enum(['up', 'down']),
    amount: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal('intercept'),
    pattern: z.string().min(1),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    respond: z.object({
      status: z.number().int().min(100).max(599),
      body: z.unknown().optional(),
    }),
  }),
  z.object({
    kind: z.literal('waitFor'),
    hint: hintSchema,
  }),
]);

export type Step = z.infer<typeof stepSchema>;

export const actionSchema = z.object({
  action: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'action names must be lowercase-kebab'),
  parameters: z.array(z.string().min(1)).optional(),
  steps: z.array(stepSchema).min(1),
  screenshot: z.boolean().default(true),
  diff: z
    .object({
      pixelThreshold: z.number().min(0).max(1).default(0.1),
      maxDiffRatio: z.number().min(0).max(1).default(0.005),
    })
    .optional(),
});

export type Action = z.infer<typeof actionSchema>;
