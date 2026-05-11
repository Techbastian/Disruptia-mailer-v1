---
name: Disruptia Mailer
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#464554'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#777585'
  outline-variant: '#c7c4d6'
  surface-tint: '#4e4cd0'
  primary: '#342fb7'
  on-primary: '#ffffff'
  primary-container: '#4d4bcf'
  on-primary-container: '#d5d4ff'
  inverse-primary: '#c2c1ff'
  secondary: '#7d5800'
  on-secondary: '#ffffff'
  secondary-container: '#ffb700'
  on-secondary-container: '#6b4b00'
  tertiary: '#3c4755'
  on-tertiary: '#ffffff'
  tertiary-container: '#535f6d'
  on-tertiary-container: '#cdd9ea'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c2c1ff'
  on-primary-fixed: '#0b006b'
  on-primary-fixed-variant: '#3430b7'
  secondary-fixed: '#ffdea9'
  secondary-fixed-dim: '#ffba26'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4100'
  tertiary-fixed: '#d8e3f5'
  tertiary-fixed-dim: '#bcc7d8'
  on-tertiary-fixed: '#111c29'
  on-tertiary-fixed-variant: '#3c4856'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin: 32px
---

## Brand & Style

The brand personality of this design system is authoritative yet inclusive, blending high-performance SaaS utility with a commitment to accessibility and professional growth. It targets organizations focused on diversity, equity, and inclusion (DEI), requiring a UI that feels reliable and human-centric. 

The chosen design style is **Corporate / Modern Minimalism**. It prioritizes clarity through generous whitespace, a structured dashboard layout, and a refined color application. By utilizing high-contrast accents against a clean, neutral foundation, the interface ensures that critical actions are unmistakable while maintaining a calm, focused environment for managing complex communications.

## Colors

The color palette is derived directly from the official branding to maintain visual continuity across the product ecosystem. 

- **Primary (#4D4BCF):** Reserved for primary calls-to-action (CTAs), active navigation states, and key interactive elements. It provides a confident, tech-forward anchor for the UI.
- **Secondary (#FFB700):** Used sparingly as an accent for highlights, status indicators, or secondary interactions to draw attention without overwhelming the primary flow.
- **Tertiary/Neutral Dark (#081420):** Applied to primary headings and high-contrast text to ensure WCAG 2.1 compliance and readability.
- **Neutral Light (#F8F9FA):** Serves as the page background to provide a soft contrast against pure white cards, reducing eye strain in a dashboard environment.

## Typography

This design system uses a dual-sans-serif pairing to balance character with functionality. **Manrope** is used for headlines to provide a modern, geometric feel that aligns with the brand’s "disruptive" yet professional nature. **Inter** is utilized for body text and labels for its exceptional legibility and systematic performance in data-heavy dashboard environments.

Hierarchy is established through clear weight stepping and consistent line heights. Letter spacing is slightly tightened on large headlines for impact and slightly loosened on small labels to ensure maximum accessibility for users with visual impairments.

## Layout & Spacing

The design system employs a **Fixed Grid** model for the main content area with a max-width of 1440px, centered on the screen. This ensures a consistent reading experience across large monitors. 

The layout utilizes a 12-column system with 24px gutters. Dashboard sidebars are fixed at 280px, while the main content area scales fluidly within its container. Spacing follows a linear 8px scale to maintain a rhythmic vertical flow, ensuring that related elements are grouped tightly (8px - 16px) and distinct sections are separated clearly (40px - 64px).

## Elevation & Depth

To maintain a minimalist and clean aesthetic, depth is conveyed through **Tonal Layering** and **Ambient Shadows**. 

The main background is a very light gray (#F8F9FA). Primary content containers (cards) are pure white (#FFFFFF). To separate these cards from the background, a single, highly diffused shadow is used: `0px 4px 20px rgba(8, 20, 32, 0.04)`. This creates a subtle "lift" without adding visual clutter. Hover states on interactive cards should slightly increase this shadow to `0px 8px 30px rgba(8, 20, 32, 0.08)` to provide tactile feedback.

## Shapes

The shape language is defined as **Rounded**, utilizing a base 0.5rem (8px) radius for most UI components. This choice balances the professional rigor of the brand with an approachable, DEI-friendly softness. 

- **Standard Buttons & Inputs:** 8px (rounded-md)
- **Large Cards & Containers:** 16px (rounded-lg)
- **Avatars & Chips:** 100px (rounded-pill) for distinct identification.

## Components

- **Buttons:** Primary buttons use the brand blue (#4D4BCF) with white text. Secondary buttons use a subtle gray outline or ghost style. High-contrast focus states are mandatory for accessibility.
- **Cards:** White backgrounds, 16px corner radius, and the ambient shadow defined in the Elevation section. Card headers should use a subtle bottom border (#EDF2F7) instead of a heavy shadow.
- **Input Fields:** Use a 1px border (#D1D5DB) that shifts to the primary brand blue on focus. Labels must always be visible (never placeholder-only) to meet accessibility standards.
- **Chips/Badges:** Used for email tags or status indicators. These use low-saturation versions of the primary/secondary colors with high-contrast text to ensure readability.
- **Lists:** Clean rows with 16px vertical padding and subtle dividers. Hover states should use the neutral background color.
- **Additional Components:** The system includes a 'Progress Tracker' for mailer campaigns and 'Accessibility Toggle' shortcuts within the dashboard header.