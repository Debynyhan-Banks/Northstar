import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => !value || /^https?:\/\//i.test(value), {
    message: "Enter a full URL beginning with http:// or https://",
  });

export const intakeSchema = z.object({
  project: z.object({
    submittedAt: z.string().optional(),
    status: z.enum(["draft", "new"]),
    schemaVersion: z.literal("1.0"),
  }),
  business: z.object({
    name: z.string().trim().min(1, "Business name is required"),
    industry: z.string().trim().min(1, "Choose a business category"),
    description: z
      .string()
      .trim()
      .min(20, "Tell us a little more about what your business does"),
    address: z.object({
      street: z.string().trim(),
      city: z.string().trim(),
      state: z.string().trim(),
      postalCode: z.string().trim(),
    }),
    serviceArea: z.string().trim(),
    website: optionalUrl,
    socialLinks: z.array(
      z.object({
        platform: z.string().trim(),
        url: optionalUrl,
      }),
    ),
  }),
  contact: z.object({
    name: z.string().trim().min(1, "Contact name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    phone: z.string().trim().min(7, "Enter a valid phone number"),
  }),
  services: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1, "Service or product name is required"),
        description: z.string().trim(),
        priority: z.enum(["primary", "secondary", "supporting"]),
      }),
    )
    .min(1, "Add at least one service or product"),
  promotedServiceIds: z.array(z.string()),
  customers: z.object({
    typicalCustomers: z
      .string()
      .trim()
      .min(10, "Tell us a little more about your typical customers"),
    commonReasonsForContact: z.string().trim(),
    whyChooseUs: z.string().trim(),
    frequentlyAskedQuestions: z.array(z.string()),
  }),
  websiteGoals: z.object({
    goals: z.array(z.string()).min(1, "Choose at least one website goal"),
    primaryAction: z.string().trim().min(1, "Choose the most important action"),
    otherGoal: z.string().trim(),
  }),
  features: z.array(z.string()),
  featureDetails: z.object({
    schedulingPlatform: z.string().trim(),
    productCount: z.string().trim(),
    other: z.string().trim(),
  }),
  brand: z.object({
    hasLogo: z.boolean(),
    assets: z.array(
      z.object({
        name: z.string(),
        size: z.number(),
        type: z.string(),
        category: z.string(),
      }),
    ),
    inspirationSites: z.array(
      z.object({
        url: optionalUrl,
        notes: z.string().trim(),
      }),
    ),
    recommendDesignDirection: z.boolean(),
  }),
  competitors: z.array(z.string()),
  additionalNotes: z.string().trim(),
});

export type IntakeData = z.infer<typeof intakeSchema>;

export const createEmptyIntake = (): IntakeData => ({
  project: { status: "draft", schemaVersion: "1.0", submittedAt: "" },
  business: {
    name: "",
    industry: "",
    description: "",
    address: { street: "", city: "", state: "", postalCode: "" },
    serviceArea: "",
    website: "",
    socialLinks: [],
  },
  contact: { name: "", email: "", phone: "" },
  services: [
    {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      priority: "primary",
    },
  ],
  promotedServiceIds: [],
  customers: {
    typicalCustomers: "",
    commonReasonsForContact: "",
    whyChooseUs: "",
    frequentlyAskedQuestions: [],
  },
  websiteGoals: { goals: [], primaryAction: "", otherGoal: "" },
  features: [],
  featureDetails: { schedulingPlatform: "", productCount: "", other: "" },
  brand: {
    hasLogo: false,
    assets: [],
    inspirationSites: [],
    recommendDesignDirection: false,
  },
  competitors: [],
  additionalNotes: "",
});
