import { z } from "zod";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case (a-z, 0-9, -)");

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color like #2B5CFF")
  .transform((v) => v.toUpperCase());

export const sectionStatusSchema = z.enum(["planned", "published"]);

export const logoVariantSchema = z.object({
  id: slug,
  name: z.string().min(1),
  file: z.string().regex(/^[\w.-]+\.svg$/, "must be an .svg filename inside logos/"),
  previewBg: hex,
  usage: z.string().min(1),
});

export const logoGroupSchema = z.object({
  key: slug,
  label: z.string().min(1),
  description: z.string().min(1),
  variants: z.array(logoVariantSchema).min(1, "a logo group needs at least one variant"),
});

export const colorSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  hex,
  cmyk: z.string().min(1).optional(),
  pantone: z.string().min(1).optional(),
});

export const paletteSchema = z.object({
  name: z.string().min(1),
  colors: z.array(colorSchema).min(1),
});

export const brandSchema = z
  .object({
    slug,
    name: z.string().min(1),
    description: z.string().min(1),
    status: z.enum(["published", "draft"]),
    /** Sidebar position; lower comes first. Ties sort by name. */
    order: z.number().int().default(100),
    updatedAt: z.iso.date("must be an ISO date (YYYY-MM-DD)"),
    contact: z.email(),
    logoGroups: z.array(logoGroupSchema).default([]),
    palettes: z.array(paletteSchema).default([]),
    sections: z
      .object({
        typography: sectionStatusSchema.default("planned"),
        guidelines: sectionStatusSchema.default("planned"),
        screenshots: sectionStatusSchema.default("planned"),
      })
      .default({ typography: "planned", guidelines: "planned", screenshots: "planned" }),
  })
  .superRefine((brand, ctx) => {
    if (brand.status === "published" && brand.logoGroups.length === 0) {
      ctx.addIssue({ code: "custom", path: ["logoGroups"], message: "a published brand needs at least one logo group" });
    }

    const groupKeys = new Set<string>();
    brand.logoGroups.forEach((group, g) => {
      if (groupKeys.has(group.key)) {
        ctx.addIssue({ code: "custom", path: ["logoGroups", g, "key"], message: `duplicate group key "${group.key}"` });
      }
      groupKeys.add(group.key);
    });

    // Variant ids name the output files (<slug>-<id>.svg), so they must be unique per brand.
    const variantIds = new Set<string>();
    brand.logoGroups.forEach((group, g) =>
      group.variants.forEach((variant, v) => {
        if (variantIds.has(variant.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["logoGroups", g, "variants", v, "id"],
            message: `duplicate variant id "${variant.id}"`,
          });
        }
        variantIds.add(variant.id);
      }),
    );
  });

export type SectionStatus = z.infer<typeof sectionStatusSchema>;
export type LogoVariant = z.infer<typeof logoVariantSchema>;
export type LogoGroup = z.infer<typeof logoGroupSchema>;
export type BrandColor = z.infer<typeof colorSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type Brand = z.infer<typeof brandSchema>;
