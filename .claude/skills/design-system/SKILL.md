---
name: design-system-premios-esland
description: Creates implementation-ready design-system guidance with tokens, component behavior, and accessibility standards. Use when creating or updating UI rules, component specifications, or design-system documentation.
---

<!-- TYPEUI_SH_MANAGED_START -->

# Premios ESLAND

## Mission
Deliver implementation-ready design-system guidance for Premios ESLAND that can be applied consistently across content site interfaces.

## Brand
- Product/brand: Premios ESLAND
- URL: https://premiosesland.com/
- Audience: readers and knowledge seekers
- Product surface: content site

## Style Foundations
- Visual style: structured, accessible, implementation-first
- Main font style: `font.family.primary=Montserrat`, `font.family.stack=Montserrat, sans-serif`, `font.size.base=10px`, `font.weight.base=400`, `font.lineHeight.base=normal`
- Typography scale: `font.size.xs=10px`, `font.size.sm=14px`, `font.size.md=15px`, `font.size.lg=16px`, `font.size.xl=20px`, `font.size.2xl=25px`, `font.size.3xl=30px`, `font.size.4xl=31px`
- Color palette: `color.text.primary=#ffffff`, `color.text.secondary=#0000ee`, `color.surface.base=#000000`, `color.text.inverse=#2255a6`, `color.surface.muted=#000527`, `color.surface.raised=#020710`, `color.surface.strong=#0f2646`
- Spacing scale: `space.1=1px`, `space.2=3.5px`, `space.3=6px`, `space.4=10px`, `space.5=11px`, `space.6=14px`, `space.7=20px`, `space.8=20.6px`
- Radius/shadow/motion tokens: `radius.xs=20px`, `radius.sm=29px`, `radius.md=30px` | `shadow.1=rgba(0, 0, 0, 0.16) 0px 3px 26px 0px` | `motion.duration.instant=300ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
concise, confident, implementation-focused

## Rules: Do
- Use semantic tokens, not raw hex values in component guidance.
- Every component must define required states: default, hover, focus-visible, active, disabled, loading, error.
- Responsive behavior and edge-case handling should be specified for every component family.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and tokens.
3. Define component anatomy, variants, and interactions.
4. Add accessibility acceptance criteria.
5. Add anti-patterns and migration notes.
6. End with QA checklist.

## Required Output Structure
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Prefer system consistency over local visual exceptions.

<!-- TYPEUI_SH_MANAGED_END -->
