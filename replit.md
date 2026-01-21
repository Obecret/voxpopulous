# Voxpopulous.fr

## Overview
Voxpopulous.fr is a multi-tenant SaaS platform designed for municipalities to enhance citizen engagement. It provides three core civic participation tools: a Citizen Idea Box, Incident Reporting, and Public Meetings management. Each municipality receives isolated data and a dedicated public-facing page with administrative access. The platform aims to offer comprehensive digital tools for public sector citizen interaction, focusing on flexible billing for diverse public sector mandates.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design
The platform is a multi-tenant SaaS, identified by a unique URL slug (`/t/:slug/...`) with isolated data per tenant. It supports a dual payment model: Stripe for automated subscriptions and administrative mandates for the French public sector. A superadmin system manages tenants, subscriptions, and billing.

### Frontend
- **Technology**: React with TypeScript, Vite build tool.
- **State Management**: TanStack React Query.
- **UI**: shadcn/ui (Radix UI-based) with Tailwind CSS, supporting dark mode.

### Backend
- **Technology**: Node.js with Express, esbuild for compilation.
- **API**: RESTful JSON API.
- **Authentication**: Session-based for admin users, bcrypt for password hashing.

### Data Layer
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM.
- **Schema**: Defined in `shared/schema.ts`, with Zod for validation; uses PostgreSQL enums.

### Key Features & Architectural Decisions
- **Multi-Tenancy**: Data isolation per tenant via URL slug.
- **Feature Gating**: Dynamic feature enablement/disablement based on subscription plan.
- **Addon System**: Optional, flat-rate per-unit features configurable per plan.
- **Billing & Quota Management**:
    - **Subscription Plans**: Dynamic plans with feature flags and quotas.
    - **Quotes & Invoices**: Comprehensive system for generating French-compliant quotes and invoices, with traceability.
    - **Tenant Billing Changes**: Scheduled plan/addon changes with proration.
    - **Association Quota**: Enforced limits based on subscription and addons.
- **EPCI & Child Tenant Management**: Supports inter-municipal cooperation (EPCI) managing subordinate communes and associations, allowing quota sharing and centralized billing.
- **Stripe Test/Live Mode System**: Superadmin-configurable toggle between Stripe test and live environments.
    - Separate price IDs stored for test and live modes (monthly/yearly for plans and addons).
    - Current mode stored in `superadminSettings` table with 'test' default.
    - Public endpoint `/api/public/stripe-mode` exposes active mode to frontend.
    - Checkout and billing UI automatically use correct price IDs based on active mode.
    - Loading state protection prevents race-condition clicks before mode loads.
- **Administrative Mandate System**: Full French public sector billing workflow, including:
    - Dual payment support (mandate or Stripe).
    - Order management with SIRET validation via INSEE API.
    - PENDING_VALIDATION → PENDING_BC → ACCEPTED → INVOICED status flow.
    - Invoice generation (FA-YYYY-NNNNN format) with 30-day terms and Chorus Pro integration support.
    - Automated payment reminders.
    - Subscription renewal process with proforma generation.
    - Activity journal for audit trails.
- **Dynamic Function Management**: System for managing lists of elected official functions (`elu_functions`) and bureau member functions (`bureau_member_functions`), configurable by superadmins and dynamically loaded.
- **Association-Specific UI Terminology**: User interface (sidebar, titles, buttons, placeholders) dynamically adapts terminology for associations versus municipalities.
- **Billing Proration Improvements**: Proration calculations are billing-cycle aware (monthly/yearly contracts) and support mandate subscriptions.
- **Global Domain Management**: Centralized domain management system for categorizing content across all tenants:
    - Two separate domain databases: `globalMunicipalityDomains` for municipalities/EPCI and `globalAssociationDomains` for associations.
    - Superadmin backoffice for CRUD operations on domains with color selection and ordering.
    - Public API endpoints: `/api/public/municipality-domains` and `/api/public/association-domains`.
    - Domain categorization for elected officials, bureau members, ideas, incidents, and meetings.
    - Forms (ideas, incidents, meetings) use global domains for categorization via select dropdowns.

## External Dependencies

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: bcrypt, express-session, connect-pg-simple
- **UI**: Radix UI, Tailwind CSS, class-variance-authority, lucide-react
- **Form Handling**: react-hook-form, @hookform/resolvers (Zod resolver), zod
- **Build Tools**: Vite, esbuild, tsx
- **Payment**: Stripe
- **Email Services**: Resend