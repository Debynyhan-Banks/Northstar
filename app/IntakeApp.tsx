"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEmptyIntake,
  intakeSchema,
  type IntakeData,
} from "@/features/intake/schema";
import { ApiSubmissionProvider } from "@/features/intake/submission";
import {
  downloadJSON,
  normalizeIntake,
  toAIContext,
} from "@/features/intake/utils";

const DRAFT_KEY = "northstar-website-intake-v1";
const STEP_KEY = `${DRAFT_KEY}-step`;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const steps = [
  ["01", "Your business", "The essentials"],
  ["02", "What you offer", "Services & products"],
  ["03", "Your customers", "Audience & positioning"],
  ["04", "Website goals", "What success looks like"],
  ["05", "Features & brand", "Tools, files & inspiration"],
  ["06", "Review", "Check and submit"],
] as const;

const goalOptions = [
  "Get more phone calls",
  "Generate quote requests",
  "Book appointments",
  "Sell products",
  "Accept payments",
  "Showcase services",
  "Showcase projects/work",
  "Build credibility",
  "Educate customers",
  "Recruit employees",
  "Collect leads",
  "Promote a physical location",
  "Other",
];

const featureOptions = [
  "Call",
  "Text",
  "Email",
  "Request a quote",
  "Schedule an appointment",
  "Pay online",
  "Buy products",
  "Upload photos",
  "Upload documents",
  "Apply for financing",
  "Apply for jobs",
  "Create an account",
  "Access a customer portal",
  "Live chat",
  "Newsletter signup",
  "View a gallery",
  "Read reviews/testimonials",
  "Other",
];

const actionOptions = [
  "Call us",
  "Request service",
  "Schedule an appointment",
  "Request a quote",
  "Buy now",
  "Visit our location",
  "Apply",
  "Contact us",
];

const assetCategories = [
  "Logo",
  "Business photos",
  "Team photos",
  "Product photos",
  "Project photos",
  "Brochures / menus",
  "Marketing material",
  "Brand guide",
  "Business cards",
];

type SelectedFile = { file: File; category: string };

function Field({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <div className="field-heading">
        <label className="field-label">
          {label} {required && <span className="required">Required</span>}
        </label>
        {hint && <p className="field-hint">{hint}</p>}
      </div>
      {children}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <div className="choice-grid">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            type="button"
            className={`choice-card ${active ? "selected" : ""}`}
            aria-pressed={active}
            onClick={() => onToggle(option)}
            key={option}
          >
            <span className="choice-check" aria-hidden="true">
              {active ? "✓" : ""}
            </span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="section-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}

function ReviewSection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="review-card">
      <div className="review-card-header">
        <h2>{title}</h2>
        <button type="button" className="text-button" onClick={() => onEdit(step)}>
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}

function Answer({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="answer">
      <dt>{label}</dt>
      <dd>{value || <span className="muted">Not provided</span>}</dd>
    </div>
  );
}

export default function IntakeApp() {
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [assetCategory, setAssetCategory] = useState(assetCategories[0]);
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<IntakeData | null>(null);
  const [submissionMode, setSubmissionMode] = useState<"connected" | "preview">(
    "preview",
  );
  const [submitError, setSubmitError] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);

  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    reset,
    trigger,
    handleSubmit,
    clearErrors,
    formState: { errors },
  } = useForm<IntakeData>({
    resolver: zodResolver(intakeSchema),
    defaultValues: createEmptyIntake(),
    mode: "onBlur",
  });

  const servicesArray = useFieldArray({ control, name: "services" });
  const socialsArray = useFieldArray({ control, name: "business.socialLinks" });
  const inspirationArray = useFieldArray({
    control,
    name: "brand.inspirationSites",
  });

  const values = watch();
  const provider = useMemo(() => new ApiSubmissionProvider(), []);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      const storedStep = Number(localStorage.getItem(STEP_KEY) || 0);
      if (draft) {
        const parsed = JSON.parse(draft) as IntakeData;
        reset(parsed);
        setStep(Math.min(Math.max(storedStep, 0), steps.length - 1));
        setRestored(true);
        window.setTimeout(() => setRestored(false), 4200);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(STEP_KEY);
    }
  }, [reset]);

  useEffect(() => {
    let timer: number;
    const subscription = watch((data) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [watch]);

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
    mainRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const toggleArrayValue = useCallback(
    (
      path: "websiteGoals.goals" | "features" | "promotedServiceIds",
      value: string,
    ) => {
      const current = getValues(path) as string[];
      setValue(
        path,
        current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
        { shouldDirty: true, shouldValidate: true },
      );
      clearErrors(path);
    },
    [clearErrors, getValues, setValue],
  );

  const goToStep = (nextStep: number) => setStep(nextStep);

  const continueToNext = async () => {
    const pathsByStep: Array<Array<keyof IntakeData | string>> = [
      ["business", "contact"],
      ["services", "promotedServiceIds"],
      ["customers"],
      ["websiteGoals"],
      ["features", "brand", "featureDetails"],
    ];
    const valid = await trigger(pathsByStep[step] as never);
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const resetIntake = () => {
    if (!window.confirm("Clear this intake and start again? This cannot be undone.")) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(STEP_KEY);
    reset(createEmptyIntake());
    setSelectedFiles([]);
    setStep(0);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setFileError("");
    const incoming = Array.from(files);
    if (selectedFiles.length + incoming.length > MAX_FILES) {
      setFileError(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    const oversized = incoming.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileError(`${oversized.name} is larger than 15 MB.`);
      return;
    }
    const next = [
      ...selectedFiles,
      ...incoming.map((file) => ({ file, category: assetCategory })),
    ];
    setSelectedFiles(next);
    setValue(
      "brand.assets",
      next.map(({ file, category }) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        category,
      })),
      { shouldDirty: true },
    );
  };

  const removeFile = (index: number) => {
    const next = selectedFiles.filter((_, itemIndex) => itemIndex !== index);
    setSelectedFiles(next);
    setValue(
      "brand.assets",
      next.map(({ file, category }) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        category,
      })),
      { shouldDirty: true },
    );
  };

  const submitIntake = async (data: IntakeData) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const normalized = normalizeIntake(data);
      const result = await provider.submit(normalized);
      if (provider.uploadAsset && result.mode === "connected") {
        for (const asset of selectedFiles) {
          await provider.uploadAsset(result.submissionId, asset.file, asset.category);
        }
      }
      setSubmissionMode(result.mode);
      setSubmitted(normalized);
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(STEP_KEY);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't submit your brief just yet.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="confirmation-page">
        <div className="brand-lockup confirmation-brand">
          <span className="brand-mark">N</span>
          <span>Northstar Brief</span>
        </div>
        <section className="confirmation-card">
          <div className="success-mark" aria-hidden="true">
            ✓
          </div>
          <p className="eyebrow">Brief complete</p>
          <h1>Thank you, {submitted.contact.name.split(" ")[0]}.</h1>
          <p className="confirmation-lead">
            Your website brief for <strong>{submitted.business.name}</strong> is
            organized and ready for the next step.
          </p>
          {submissionMode === "preview" && (
            <div className="preview-notice">
              <strong>Preview submission</strong>
              <span>
                Download the structured copy below. Automatic storage and email
                begin as soon as the Google connection is added.
              </span>
            </div>
          )}
          <div className="confirmation-actions">
            <button className="primary-button" onClick={() => downloadJSON(submitted)}>
              Download brief
            </button>
            <button
              className="secondary-button"
              onClick={() => navigator.clipboard.writeText(toAIContext(submitted))}
            >
              Copy AI-ready context
            </button>
          </div>
          <p className="confirmation-footnote">
            A copy is formatted as maintainable JSON, ready for strategy and
            website generation.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="progress-panel">
        <div className="brand-lockup">
          <span className="brand-mark">N</span>
          <span>Northstar Brief</span>
        </div>
        <div className="progress-copy">
          <p className="eyebrow light">Website project</p>
          <h2>Let’s build from what you know best.</h2>
          <p>
            Tell us about your business. We’ll turn it into a clear, strategic
            website plan.
          </p>
        </div>
        <nav aria-label="Intake progress" className="step-list">
          {steps.map(([number, title, subtitle], index) => (
            <button
              type="button"
              className={`step-item ${index === step ? "current" : ""} ${index < step ? "complete" : ""}`}
              onClick={() => index < step && goToStep(index)}
              disabled={index > step}
              aria-current={index === step ? "step" : undefined}
              key={number}
            >
              <span className="step-number">{index < step ? "✓" : number}</span>
              <span>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="privacy-note">
          <span className="privacy-icon">●</span>
          <span>
            <strong>Saved on this device</strong>
            Your progress is kept private until you submit.
          </span>
        </div>
      </aside>

      <section className="form-panel">
        <header className="mobile-header">
          <div className="brand-lockup dark">
            <span className="brand-mark">N</span>
            <span>Northstar Brief</span>
          </div>
          <span className="mobile-step">{step + 1} / {steps.length}</span>
        </header>
        <div className="mobile-progress" aria-hidden="true">
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        {restored && (
          <div className="toast" role="status">
            <span>✓</span> Your saved progress has been restored.
          </div>
        )}

        <form onSubmit={handleSubmit(submitIntake)} noValidate>
          <div ref={mainRef} tabIndex={-1} className="form-content">
            {step === 0 && (
              <>
                <SectionIntro eyebrow="Step 1 of 6" title="First, tell us about your business.">
                  Share the practical details you already know. No website jargon
                  required.
                </SectionIntro>
                <div className="section-block">
                  <h2>Business details</h2>
                  <div className="form-grid two-col">
                    <Field label="Business name" required error={errors.business?.name?.message}>
                      <input {...register("business.name")} placeholder="Acme Home Services" autoComplete="organization" />
                    </Field>
                    <Field label="Industry / category" required error={errors.business?.industry?.message}>
                      <select {...register("business.industry")}>
                        <option value="">Select one</option>
                        <option>Home services</option>
                        <option>Professional services</option>
                        <option>Health & wellness</option>
                        <option>Retail & ecommerce</option>
                        <option>Food & hospitality</option>
                        <option>Real estate</option>
                        <option>Education</option>
                        <option>Nonprofit</option>
                        <option>Technology</option>
                        <option>Other</option>
                      </select>
                    </Field>
                  </div>
                  <Field
                    label="What does your business do?"
                    hint="A few sentences is perfect. Explain it the way you would to a new customer."
                    required
                    error={errors.business?.description?.message}
                  >
                    <textarea {...register("business.description")} rows={5} placeholder="We help homeowners…" />
                  </Field>
                  <div className="form-grid two-col">
                    <Field label="Existing website" hint="Optional" error={errors.business?.website?.message}>
                      <input {...register("business.website")} type="url" placeholder="https://" inputMode="url" />
                    </Field>
                    <Field label="Service area / market" hint="Where do you serve customers?">
                      <input {...register("business.serviceArea")} placeholder="Greater Raleigh area" />
                    </Field>
                  </div>
                </div>

                <div className="section-block">
                  <h2>Primary contact</h2>
                  <div className="form-grid two-col">
                    <Field label="Your name" required error={errors.contact?.name?.message}>
                      <input {...register("contact.name")} autoComplete="name" placeholder="Jordan Lee" />
                    </Field>
                    <Field label="Email" required error={errors.contact?.email?.message}>
                      <input {...register("contact.email")} type="email" autoComplete="email" placeholder="jordan@company.com" />
                    </Field>
                    <Field label="Phone" required error={errors.contact?.phone?.message}>
                      <input {...register("contact.phone")} type="tel" autoComplete="tel" placeholder="(555) 123-4567" />
                    </Field>
                  </div>
                </div>

                <details className="optional-section">
                  <summary>Address and social links <span>Optional</span></summary>
                  <div className="optional-content">
                    <Field label="Street address">
                      <input {...register("business.address.street")} autoComplete="street-address" placeholder="123 Main Street" />
                    </Field>
                    <div className="form-grid address-grid">
                      <Field label="City"><input {...register("business.address.city")} autoComplete="address-level2" /></Field>
                      <Field label="State"><input {...register("business.address.state")} autoComplete="address-level1" /></Field>
                      <Field label="ZIP code"><input {...register("business.address.postalCode")} autoComplete="postal-code" inputMode="numeric" /></Field>
                    </div>
                    <div className="repeat-list">
                      {socialsArray.fields.map((field, index) => (
                        <div className="inline-repeat" key={field.id}>
                          <input {...register(`business.socialLinks.${index}.platform`)} aria-label={`Social platform ${index + 1}`} placeholder="Instagram" />
                          <input {...register(`business.socialLinks.${index}.url`)} aria-label={`Social URL ${index + 1}`} placeholder="https://" inputMode="url" />
                          <button type="button" className="icon-button" aria-label={`Remove social link ${index + 1}`} onClick={() => socialsArray.remove(index)}>×</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="add-button" onClick={() => socialsArray.append({ platform: "", url: "" })}>+ Add social link</button>
                  </div>
                </details>
              </>
            )}

            {step === 1 && (
              <>
                <SectionIntro eyebrow="Step 2 of 6" title="What do you offer?">
                  Add your core services or products. We’ll use these to shape the
                  site’s content and priorities.
                </SectionIntro>
                <div className="repeat-list service-list">
                  {servicesArray.fields.map((field, index) => (
                    <article className="repeat-card" key={field.id}>
                      <div className="repeat-card-header">
                        <span>Offering {index + 1}</span>
                        {servicesArray.fields.length > 1 && (
                          <button type="button" className="text-button danger" onClick={() => servicesArray.remove(index)}>Remove</button>
                        )}
                      </div>
                      <Field label="Name" required error={errors.services?.[index]?.name?.message}>
                        <input {...register(`services.${index}.name`)} placeholder="Kitchen remodeling" />
                      </Field>
                      <Field label="Short description" hint="What is included or who is it for?">
                        <textarea {...register(`services.${index}.description`)} rows={3} placeholder="Full-service design and renovation…" />
                      </Field>
                      <Field label="Business priority">
                        <div className="segmented-control">
                          {(["primary", "secondary", "supporting"] as const).map((priority) => (
                            <label key={priority}>
                              <input type="radio" value={priority} {...register(`services.${index}.priority`)} />
                              <span>{priority[0].toUpperCase() + priority.slice(1)}</span>
                            </label>
                          ))}
                        </div>
                      </Field>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="add-card-button"
                  onClick={() => servicesArray.append({ id: crypto.randomUUID(), name: "", description: "", priority: "secondary" })}
                >
                  <span>+</span>
                  <strong>Add another service or product</strong>
                </button>
                {values.services.some((service) => service.name.trim()) && (
                  <div className="section-block highlight-block">
                    <Field label="Which are most important for the new website to promote?" hint="Choose as many as you need.">
                      <div className="compact-choices">
                        {values.services.filter((service) => service.name.trim()).map((service) => (
                          <label key={service.id} className="check-row">
                            <input
                              type="checkbox"
                              checked={values.promotedServiceIds.includes(service.id)}
                              onChange={() => toggleArrayValue("promotedServiceIds", service.id)}
                            />
                            <span>{service.name}</span>
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <SectionIntro eyebrow="Step 3 of 6" title="Help us understand your customers.">
                  Plain language is best. Your answers help us find the right message
                  and build trust with the right people.
                </SectionIntro>
                <div className="question-stack">
                  <Field
                    label="Who are your typical customers?"
                    hint="For example: homeowners, restaurants, property managers, parents, students, or small businesses."
                    required
                    error={errors.customers?.typicalCustomers?.message}
                  >
                    <textarea {...register("customers.typicalCustomers")} rows={4} placeholder="Our typical customers are…" />
                  </Field>
                  <Field label="What do customers usually contact you about?">
                    <textarea {...register("customers.commonReasonsForContact")} rows={4} placeholder="Most people reach out when…" />
                  </Field>
                  <Field
                    label="Why should someone choose your company instead of another company?"
                    hint="Think about your experience, approach, service, guarantees, reputation, or anything customers value."
                  >
                    <textarea {...register("customers.whyChooseUs")} rows={5} placeholder="Customers choose us because…" />
                  </Field>
                  <Field label="What questions do customers ask repeatedly?" hint="Add the real questions you hear most often.">
                    <div className="repeat-list">
                      {values.customers.frequentlyAskedQuestions.map((_, index) => (
                        <div className="inline-repeat single" key={index}>
                          <input {...register(`customers.frequentlyAskedQuestions.${index}`)} placeholder="How long does the process take?" />
                          <button type="button" className="icon-button" aria-label={`Remove question ${index + 1}`} onClick={() => {
                            const next = getValues("customers.frequentlyAskedQuestions").filter((_, itemIndex) => itemIndex !== index);
                            setValue("customers.frequentlyAskedQuestions", next, { shouldDirty: true });
                          }}>×</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="add-button" onClick={() => setValue("customers.frequentlyAskedQuestions", [...getValues("customers.frequentlyAskedQuestions"), ""], { shouldDirty: true })}>+ Add a common question</button>
                  </Field>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <SectionIntro eyebrow="Step 4 of 6" title="What should the website accomplish?">
                  Choose the outcomes that matter. We’ll determine the best site
                  structure and conversion path later.
                </SectionIntro>
                <Field label="What do you want this website to accomplish?" required error={errors.websiteGoals?.goals?.message}>
                  <ChoiceGrid options={goalOptions} selected={values.websiteGoals.goals} onToggle={(option) => toggleArrayValue("websiteGoals.goals", option)} />
                </Field>
                {values.websiteGoals.goals.includes("Other") && (
                  <Field label="Tell us about the other goal">
                    <input {...register("websiteGoals.otherGoal")} placeholder="Describe the outcome" />
                  </Field>
                )}
                <div className="section-block priority-block">
                  <p className="number-badge">1</p>
                  <Field
                    label="What is the single most important action you want a visitor to take?"
                    hint="This becomes the primary call to action across the website."
                    required
                    error={errors.websiteGoals?.primaryAction?.message}
                  >
                    <select {...register("websiteGoals.primaryAction")}>
                      <option value="">Choose one</option>
                      {actionOptions.map((action) => <option key={action}>{action}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <SectionIntro eyebrow="Step 5 of 6" title="Features, files, and inspiration.">
                  Tell us what customers should be able to do and share any materials
                  you already have.
                </SectionIntro>
                <Field label="What should customers be able to do on your website?" hint="Select all that apply.">
                  <ChoiceGrid options={featureOptions} selected={values.features} onToggle={(option) => toggleArrayValue("features", option)} />
                </Field>
                {(values.features.includes("Schedule an appointment") || values.features.includes("Buy products") || values.features.includes("Other")) && (
                  <div className="conditional-panel">
                    {values.features.includes("Schedule an appointment") && (
                      <Field label="Do you already use a scheduling platform?">
                        <input {...register("featureDetails.schedulingPlatform")} placeholder="Calendly, Acuity, Square, or not yet" />
                      </Field>
                    )}
                    {values.features.includes("Buy products") && (
                      <Field label="Approximately how many products do you expect to sell?">
                        <input {...register("featureDetails.productCount")} placeholder="About 25" />
                      </Field>
                    )}
                    {values.features.includes("Other") && (
                      <Field label="What else should customers be able to do?">
                        <input {...register("featureDetails.other")} placeholder="Describe the feature" />
                      </Field>
                    )}
                  </div>
                )}

                <div className="section-block">
                  <h2>Brand and business files</h2>
                  <p className="section-copy">Attach anything useful. You can add up to 10 files, 15 MB each.</p>
                  <div className="upload-controls">
                    <select value={assetCategory} onChange={(event) => setAssetCategory(event.target.value)} aria-label="File category">
                      {assetCategories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                    <label className="upload-button">
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                        onChange={(event) => {
                          addFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                      <span className="upload-symbol">↑</span>
                      <span><strong>Choose files</strong><small>Images, PDFs, and Office files</small></span>
                    </label>
                  </div>
                  {fileError && <p className="field-error" role="alert">{fileError}</p>}
                  {selectedFiles.length > 0 && (
                    <div className="file-list">
                      {selectedFiles.map(({ file, category }, index) => (
                        <div className="file-row" key={`${file.name}-${index}`}>
                          <span className="file-icon">{file.name.split(".").pop()?.toUpperCase().slice(0, 4)}</span>
                          <span><strong>{file.name}</strong><small>{category} · {(file.size / 1024 / 1024).toFixed(1)} MB</small></span>
                          <button type="button" className="icon-button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(index)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="upload-note">Files stay on this device until submission. If you refresh, simply reattach them.</p>
                </div>

                <div className="section-block">
                  <h2>Design inspiration</h2>
                  <p className="section-copy">Share up to three websites you like. You don’t need to know design terminology.</p>
                  <div className="repeat-list">
                    {inspirationArray.fields.map((field, index) => (
                      <article className="repeat-card compact" key={field.id}>
                        <div className="repeat-card-header">
                          <span>Website {index + 1}</span>
                          <button type="button" className="text-button danger" onClick={() => inspirationArray.remove(index)}>Remove</button>
                        </div>
                        <Field label="Website URL" error={errors.brand?.inspirationSites?.[index]?.url?.message}>
                          <input {...register(`brand.inspirationSites.${index}.url`)} placeholder="https://" inputMode="url" />
                        </Field>
                        <Field label="What do you like about it?" hint="Optional">
                          <input {...register(`brand.inspirationSites.${index}.notes`)} placeholder="The calm colors and clear service pages" />
                        </Field>
                      </article>
                    ))}
                  </div>
                  {inspirationArray.fields.length < 3 && (
                    <button type="button" className="add-button" onClick={() => inspirationArray.append({ url: "", notes: "" })}>+ Add an inspiration website</button>
                  )}
                  <label className="recommend-card">
                    <input type="checkbox" {...register("brand.recommendDesignDirection")} />
                    <span className="choice-check" aria-hidden="true">{values.brand.recommendDesignDirection ? "✓" : ""}</span>
                    <span><strong>I’m not sure — recommend a design direction for me.</strong><small>We’ll use your business and goals to develop the right visual direction.</small></span>
                  </label>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <SectionIntro eyebrow="Step 6 of 6" title="Review your website brief.">
                  Add any final context, then check your answers before submitting.
                </SectionIntro>
                <div className="section-block">
                  <Field label="Are there competitors or similar businesses we should know about?" hint="Optional — add names or website URLs.">
                    <div className="repeat-list">
                      {values.competitors.map((_, index) => (
                        <div className="inline-repeat single" key={index}>
                          <input {...register(`competitors.${index}`)} placeholder="Competitor name or https://" />
                          <button type="button" className="icon-button" aria-label={`Remove competitor ${index + 1}`} onClick={() => setValue("competitors", getValues("competitors").filter((_, itemIndex) => itemIndex !== index), { shouldDirty: true })}>×</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="add-button" onClick={() => setValue("competitors", [...getValues("competitors"), ""], { shouldDirty: true })}>+ Add competitor</button>
                  </Field>
                  <Field label="Is there anything else we should know about your business or website project?" hint="Optional">
                    <textarea {...register("additionalNotes")} rows={5} placeholder="Timing, upcoming changes, special requirements, or anything else…" />
                  </Field>
                </div>

                <div className="review-heading">
                  <p className="eyebrow">Your responses</p>
                  <h2>Everything in one place</h2>
                  <p>Please check the details below. You can edit any section.</p>
                </div>
                <div className="review-list">
                  <ReviewSection title="Business" step={0} onEdit={goToStep}>
                    <dl className="answer-grid">
                      <Answer label="Business" value={values.business.name} />
                      <Answer label="Industry" value={values.business.industry} />
                      <Answer label="Contact" value={`${values.contact.name} · ${values.contact.email}`} />
                      <Answer label="Service area" value={values.business.serviceArea} />
                      <Answer label="What you do" value={values.business.description} />
                    </dl>
                  </ReviewSection>
                  <ReviewSection title="Services & products" step={1} onEdit={goToStep}>
                    <div className="review-tags">{values.services.filter((item) => item.name).map((item) => <span key={item.id}>{item.name} <small>{item.priority}</small></span>)}</div>
                  </ReviewSection>
                  <ReviewSection title="Customers & positioning" step={2} onEdit={goToStep}>
                    <dl className="answer-grid single-column">
                      <Answer label="Typical customers" value={values.customers.typicalCustomers} />
                      <Answer label="Why choose you" value={values.customers.whyChooseUs} />
                    </dl>
                  </ReviewSection>
                  <ReviewSection title="Website goals" step={3} onEdit={goToStep}>
                    <dl className="answer-grid">
                      <Answer label="Goals" value={values.websiteGoals.goals.join(", ")} />
                      <Answer label="Primary action" value={values.websiteGoals.primaryAction} />
                    </dl>
                  </ReviewSection>
                  <ReviewSection title="Features & brand" step={4} onEdit={goToStep}>
                    <dl className="answer-grid">
                      <Answer label="Features" value={values.features.join(", ")} />
                      <Answer label="Assets" value={values.brand.assets.length ? `${values.brand.assets.length} file${values.brand.assets.length === 1 ? "" : "s"}` : "No files attached"} />
                      <Answer label="Design direction" value={values.brand.recommendDesignDirection ? "Please recommend one" : `${values.brand.inspirationSites.length} inspiration site${values.brand.inspirationSites.length === 1 ? "" : "s"}`} />
                    </dl>
                  </ReviewSection>
                </div>

                <label className="consent-row">
                  <input type="checkbox" required />
                  <span>I’ve reviewed the information above and it’s ready to submit.</span>
                </label>
                {submitError && <div className="submit-error" role="alert">{submitError}</div>}
              </>
            )}
          </div>

          <footer className="form-footer">
            <div className="footer-inner">
              <button type="button" className="reset-button" onClick={resetIntake}>Clear draft</button>
              <div className="nav-actions">
                {step > 0 && <button type="button" className="secondary-button" onClick={() => setStep((current) => current - 1)}>Back</button>}
                {step < steps.length - 1 ? (
                  <button type="button" className="primary-button" onClick={continueToNext}>Continue <span>→</span></button>
                ) : (
                  <button type="submit" className="primary-button submit-button" disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit Website Brief"} <span>→</span>
                  </button>
                )}
              </div>
            </div>
          </footer>
        </form>
      </section>
    </main>
  );
}
