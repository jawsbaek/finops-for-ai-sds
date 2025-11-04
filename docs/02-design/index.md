# Design Phase Documentation

This folder contains all UX/UI design specifications and visual design assets for the FinOps for AI platform.

## Documents Overview

### 1. UX Design Specification
**File**: `ux-design-specification.md` (36KB)

Comprehensive UX specification covering:
- 7 custom components (Team Dashboard, Project Dashboard, etc.)
- Component hierarchies and interactions
- User workflows and navigation patterns
- Accessibility requirements (WCAG 2.1 AA)

**Use this when**: Understanding component structure, user interactions, or implementing UI components.

---

### 2. Visual Design Directions (Interactive HTML)
**File**: `ux-design-directions.html` (49KB)

Interactive visual design mockups and exploration featuring:
- Multiple design directions with visual previews
- Component styling variations
- Interactive prototypes
- Color scheme comparisons

**Use this when**: Making visual design decisions or reviewing design options.

**How to view**: Open in a web browser to interact with design options.

---

### 3. Color Theme Exploration (Interactive HTML)
**File**: `ux-color-themes.html` (23KB)

Interactive color theme testing tool featuring:
- Light/Dark mode variations
- Color palette swatches
- Contrast ratio calculations
- Real-time theme previews

**Use this when**: Selecting color schemes or validating accessibility contrast.

**How to view**: Open in a web browser to test different color combinations.

---

### 4. Color System Guidelines
**File**: `color-system-guidelines.md` (9.8KB)

Implementation guide for the color system:
- CSS custom properties setup
- Theme switching implementation
- Accessibility requirements (4.5:1 contrast)
- Component-specific color usage

**Use this when**: Implementing theming or ensuring color accessibility.

---

## Design System Stack

- **Component Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS + CSS Custom Properties
- **Theme Support**: Light/Dark modes with system preference detection
- **Accessibility Standard**: WCAG 2.1 Level AA

---

## Quick Navigation

- **Planning Phase**: `/docs/01-planning/`
- **Implementation Phase**: `/docs/03-implementation/`
- **Operations Phase**: `/docs/05-operations/`

---

**Last Updated**: 2025-01-04
