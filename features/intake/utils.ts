import type { IntakeData } from "./schema";

export function normalizeIntake(data: IntakeData): IntakeData {
  return {
    ...data,
    project: {
      ...data.project,
      submittedAt: new Date().toISOString(),
      status: "new",
    },
    business: {
      ...data.business,
      socialLinks: data.business.socialLinks.filter((item) => item.url),
    },
    services: data.services.filter((item) => item.name.trim()),
    customers: {
      ...data.customers,
      frequentlyAskedQuestions:
        data.customers.frequentlyAskedQuestions.filter((item) => item.trim()),
    },
    brand: {
      ...data.brand,
      hasLogo: data.brand.assets.some((asset) => asset.category === "Logo"),
      inspirationSites: data.brand.inspirationSites.filter((item) => item.url),
    },
    competitors: data.competitors.filter((item) => item.trim()),
  };
}

export function toAIContext(data: IntakeData): string {
  const promoted = data.services
    .filter((service) => data.promotedServiceIds.includes(service.id))
    .map((service) => service.name)
    .join(", ");

  return [
    "WEBSITE PROJECT SOURCE BRIEF",
    "",
    `Business: ${data.business.name}`,
    `Industry: ${data.business.industry}`,
    `Business description: ${data.business.description}`,
    `Service area: ${data.business.serviceArea || "Not provided"}`,
    "",
    "SERVICES / PRODUCTS",
    ...data.services.map(
      (service) =>
        `- ${service.name} (${service.priority}): ${service.description || "No description provided"}`,
    ),
    `Priority website offerings: ${promoted || "Infer from service priorities"}`,
    "",
    "CUSTOMERS & POSITIONING",
    `Typical customers: ${data.customers.typicalCustomers}`,
    `Common reasons for contact: ${data.customers.commonReasonsForContact || "Not provided"}`,
    `Why customers choose this business: ${data.customers.whyChooseUs || "Not provided"}`,
    `Frequently asked questions: ${data.customers.frequentlyAskedQuestions.join(" | ") || "Not provided"}`,
    "",
    "WEBSITE OUTCOMES",
    `Goals: ${data.websiteGoals.goals.join(", ")}`,
    `Primary conversion action: ${data.websiteGoals.primaryAction}`,
    `Requested features: ${data.features.join(", ") || "None selected"}`,
    "",
    "BRAND & DIRECTION",
    `Available assets: ${data.brand.assets.map((asset) => asset.name).join(", ") || "None attached"}`,
    `Inspiration: ${data.brand.inspirationSites.map((site) => `${site.url}${site.notes ? ` — ${site.notes}` : ""}`).join(" | ") || "None provided"}`,
    `Recommend a design direction: ${data.brand.recommendDesignDirection ? "Yes" : "No"}`,
    `Competitors: ${data.competitors.join(", ") || "Not provided"}`,
    `Additional notes: ${data.additionalNotes || "None"}`,
  ].join("\n");
}

export function downloadJSON(data: IntakeData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${data.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "website"}-intake.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
