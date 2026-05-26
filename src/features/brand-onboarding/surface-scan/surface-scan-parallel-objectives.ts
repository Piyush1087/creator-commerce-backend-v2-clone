/**
 * Parallel.ai `objective` strings — aligned to
 * `docs/product-team-docs/brand-onboarding/Product-parallel+gemini-prompts.md`
 * (Prompts 1–3).
 */

export const PARALLEL_SURFACE_OBJECTIVE_IDENTITY = `Analyze the homepage and about page of the provided URLs.

1. **Identity:** Find official Brand Name, Logo URL, and Social Media links (IG/TikTok).
2. **Description:** Extract the 'Tagline' and a 'Short Brand Description' (max 200 chars).
3. **Visuals:** Identify the dominant hex color codes and primary font families used in headers.
4. **Tone & Aesthetic:** Provide 3 tags for 'Tone of Voice' (e.g., Playful, Clinical) and 2 tags for 'Visual Aesthetic' (e.g., Clean, Bold).
5. **Audience:** Based on landing page imagery, suggest a 'Persona Name' and target 'Age Range'.

**Refusal:** If any field is missing, omit it. Do not look for 'Do Not Say' or 'Values' yet.`;

export const PARALLEL_SURFACE_OBJECTIVE_INVENTORY = `Target shop / services list pages.

Crawl the main navigation menu and the primary shop/services page.

1. **Inventory:** List the first 6 products or services found. For each, extract: **Name**, **Image URL**, and **Starting Price** (if visible on the list view).
2. **Categorization:** Identify 2-3 'Collections' or 'Service Categories' (e.g., 'Bestsellers', 'Skincare', 'Dental Surgery').
3. **Active Offers:** Find the name and coupon code for any visible banner offers (e.g., '10% off', 'Free Trial').
4. **Healthcare/Offline:** If addresses are visible in the footer, extract the City and Name of the locations.

**Constraint:** Do not click into individual product pages. Extract only from the list view.`;

export const PARALLEL_SURFACE_OBJECTIVE_COMPETITORS = `Focus on homepage / root metadata and on-page competitor mentions.

Collect SEO title/description, H1/H2, and any explicit competitor comparisons. This bundle will be used with the brand name + industry hint to infer a short competitor set in a later synthesis step.

**Refusal:** If there is no usable metadata, return minimal excerpts from the homepage only.`;
