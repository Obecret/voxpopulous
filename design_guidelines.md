# Voxpopulous.fr Design Guidelines

## Design Approach

**Hybrid Strategy**: Combine civic trust principles with modern SaaS aesthetics
- Marketing pages: Draw from Stripe's clarity + Notion's approachability
- Admin dashboards: Material Design patterns for data-heavy interfaces
- Citizen tools: GOV.UK's accessibility + friendly, approachable UI

**Core Principle**: Professional civic credibility with modern, inviting interface

---

## Typography

**Font Families** (Google Fonts):
- Primary: Inter (headings, UI, body text)
- Accent: Space Grotesk (hero headlines, emphasis)

**Scale**:
- Hero headlines: text-5xl/6xl, font-bold (Space Grotesk)
- Section headings: text-3xl/4xl, font-semibold
- Subsection headings: text-xl/2xl, font-semibold
- Body text: text-base/lg, font-normal
- Small text: text-sm, metadata and labels
- Buttons/CTAs: text-base, font-medium

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 3, 4, 6, 8, 12, 16, 20, 24
- Component padding: p-4, p-6, p-8
- Section spacing: py-12, py-16, py-20, py-24
- Card gaps: gap-4, gap-6, gap-8
- Element margins: mb-3, mb-4, mb-6, mb-8

**Containers**:
- Marketing pages: max-w-7xl mx-auto px-4
- Admin dashboards: max-w-screen-2xl mx-auto px-6
- Content sections: max-w-4xl for optimal reading
- Forms: max-w-md to max-w-2xl depending on complexity

**Grid Patterns**:
- Feature cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Pricing tiers: grid-cols-1 md:grid-cols-3
- Admin tables: Full-width responsive tables
- Meeting cards: grid-cols-1 lg:grid-cols-2

---

## Component Library

### Navigation
- **Global Header**: Sticky navigation with logo left, links center/right, prominent CTA button
- **Admin Sidebar**: Fixed left sidebar (64 width units) with collapsible navigation, active state indicators
- **Tenant Navigation**: Horizontal navigation below header for citizen-facing pages (Ideas, Incidents, Meetings tabs)

### Hero Sections
- **SaaS Landing Hero**: Full-width (not 100vh), centered content with max-w-4xl, headline + subheadline + dual CTAs, large hero image showcasing platform interface or civic engagement
- **Tenant Landing Hero**: Medium height (60vh-70vh), welcoming headline with commune name, 3-column grid of main features below

### Cards
- **Feature Cards**: Rounded corners (rounded-lg), shadow (shadow-md), padding p-6, icon at top, title + description
- **Idea/Incident Cards**: Compact cards with status badges, vote count, metadata row, hover effect (subtle shadow increase)
- **Meeting Cards**: Larger cards with date prominence, location, attendance info, CTA button

### Forms
- **Input Fields**: Rounded borders (rounded-md), padding py-3 px-4, focus ring with defined states
- **Textareas**: Min height h-32, same styling as inputs
- **Select Dropdowns**: Styled consistently with inputs, chevron icon
- **Buttons**: 
  - Primary CTA: Solid background, rounded-md, px-6 py-3, font-medium
  - Secondary: Outlined version with border-2
  - Ghost: Text-only for tertiary actions
- **Button Groups**: Flex gap-3 for multiple actions

### Data Display
- **Tables**: Striped rows, hover states, sticky headers, responsive (stack on mobile)
- **Status Badges**: Rounded-full, px-3 py-1, text-xs font-medium, semantic indicators
- **Stat Blocks**: Large numbers with labels, grid layout for dashboards
- **Vote Counter**: Prominent display with upvote icon, visual emphasis

### Admin Interface
- **Dashboard Cards**: White cards with shadow-sm, rounded-lg, p-6, header with actions
- **Filters Bar**: Horizontal filter chips or dropdown selectors, mb-6
- **Detail Panels**: Two-column layout (sidebar for metadata, main content area)
- **Action Buttons**: Grouped in header or footer, clear hierarchy

### Public Tracking Pages
- **Status Timeline**: Vertical timeline showing idea/incident progression
- **Info Display**: Clean card-based layout with clear sections

---

## Images

**Hero Images**:
- **Global landing (/)**: Large hero image showing citizens engaged with digital platform on tablets/phones, or diverse community members collaborating (1600x900px minimum)
- **Tenant landing (/t/:slug)**: Community-specific imagery if available, or welcoming civic space imagery (town hall, public square)

**Supporting Images**:
- Feature sections: Icons from Heroicons (outline style)
- About/How it works: Illustrative diagrams or screenshots
- Testimonials: Optional municipality logos if available
- No decorative images in admin areas - focus on functionality

---

## Page-Specific Layouts

### Global SaaS Pages
- **/** : Hero (70vh) + 3-column features + How it Works (2-column alternating) + Pricing preview + CTA section
- **/pricing**: Pricing comparison table (3 tiers), feature matrix, FAQ accordion, CTA
- **/contact**: Centered form (max-w-lg), contact info sidebar optional
- **/signup**: Clean signup form (max-w-md centered), progress indicator if multi-step

### Tenant Public Pages
- **/t/:slug**: Hero + 3-card grid (Ideas/Incidents/Meetings modules) + optional "About this tool" section
- **/t/:slug/ideas**: Filter bar + card grid, prominent "Submit idea" CTA
- **/t/:slug/incidents**: Similar to ideas, category filters emphasized
- **/t/:slug/meetings**: Calendar view or chronological list, upcoming vs. past separation

### Admin Pages
- **Sidebar layout**: 
  - Left sidebar (w-64): Logo, navigation menu, tenant switcher, logout
  - Main content: Full-width dashboard or content area with breadcrumbs
- **Dashboards**: Stat cards row + data table with filters
- **Detail views**: Split layout - main content + metadata sidebar

---

## Accessibility & Polish

- All interactive elements maintain 44x44px minimum touch targets
- Form labels clearly associated with inputs
- Error states: Red border + icon + helper text
- Success states: Green checkmark + confirmation message
- Loading states: Skeleton screens for data tables, spinners for actions
- Empty states: Helpful illustrations + CTA to get started
- Focus indicators: Visible ring on all interactive elements

---

## Key Differentiators

- **Civic Trust**: Professional typography, clean layouts, no flashy animations
- **Approachability**: Friendly micro-copy, welcoming hero sections, clear explanations
- **Efficiency**: Dense data tables for admins, streamlined forms for citizens
- **Transparency**: Clear status tracking, open communication of idea/incident lifecycle