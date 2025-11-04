# tweakcn Theme Migration Design

**Date**: 2025-11-02
**Status**: Approved
**Type**: Theme Refinement

## Overview

Refine the current Premium Indigo theme by using tweakcn (a visual theme editor for shadcn/ui) to adjust border radius and spacing variables. The goal is to maintain the existing color palette while fine-tuning spatial properties for better visual consistency.

## Background

The project currently uses:
- Tailwind CSS v4 with `@theme` block syntax
- Premium Indigo dark theme
- 20+ shadcn/ui components (Button, Card, Input, Dialog, etc.)
- CSS variable-based theming with `--color-` prefix

## Requirements

### Functional Requirements
1. Use tweakcn to visually adjust border radius values
2. Maintain current Premium Indigo color palette unchanged
3. Adjust only CSS variables that tweakcn supports (colors, radius)
4. Keep component variant definitions unchanged
5. Work in isolated git worktree for safety

### Non-Functional Requirements
1. Preserve Tailwind v4 `@theme` syntax compatibility
2. Maintain hot-reload development workflow
3. Ensure all existing components remain functional
4. Document all changed values for future reference

## Approach: Manual Workflow with tweakcn Web Editor

### Why This Approach?
- Leverages tweakcn's powerful visual editor and real-time previews
- Minimizes copy-paste operations (one-time at the end)
- Safe isolation via git worktree
- Compatible with Tailwind v4's `@theme` block

## Architecture

### 1. Git Worktree Setup

```bash
# Create new branch and worktree
git worktree add ../finops-for-ai-sds-tweakcn tweakcn-theme-migration

# Install dependencies in worktree
cd ../finops-for-ai-sds-tweakcn
bun install

# Run development server
bun run dev
```

**Benefits**:
- Complete isolation from main branch
- Can switch back to main work anytime
- Safe experimentation environment

### 2. CSS Variable Format Conversion

**Current Format (Tailwind v4 `@theme`)**:
```css
@theme {
  --color-background: 240 67% 6%;
  --color-primary: 239 84% 67%;
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}
```

**tweakcn Format (Tailwind v3 standard)**:
```css
:root {
  --background: 240 67% 6%;
  --primary: 239 84% 67%;
  --radius: 0.5rem;
}
```

**Conversion Mapping**:
- Remove `--color-` prefix for tweakcn import
- Use only `--radius` (single value) in tweakcn
- Add `--color-` prefix back when exporting to project

### 3. tweakcn Workflow

1. **Navigate to tweakcn.com/editor/theme**

2. **Load Current Theme**
   - Convert current CSS variables to tweakcn format
   - Import into tweakcn editor
   - Or manually enter color values

3. **Adjust Border Radius**
   - Use visual slider to adjust `--radius`
   - Preview changes across all component examples
   - Typical range: 0.25rem - 0.75rem
   - Current value: 0.5rem

4. **Export Results**
   - Click "Export" to copy adjusted CSS variables
   - Note the new `--radius` value
   - Calculate ratio change for other radius variables

### 4. Apply Changes to Project

**Conversion Back to Tailwind v4**:
```css
/* tweakcn output */
--radius: 0.75rem;  /* Changed from 0.5rem */

/* Calculate ratio: 0.75 / 0.5 = 1.5x */

/* Apply ratio to all radius variables */
@theme {
  --radius-sm: 0.375rem;   /* 0.25 × 1.5 */
  --radius-md: 0.5625rem;  /* 0.375 × 1.5 */
  --radius-lg: 0.75rem;    /* 0.5 × 1.5 */
  --radius-xl: 1.125rem;   /* 0.75 × 1.5 */
  --radius: 0.75rem;       /* base value */
}
```

**Update globals.css**:
- Edit `src/styles/globals.css` in worktree
- Replace radius variables in `@theme` block
- Keep all other variables unchanged

**Hot Reload Verification**:
- Development server automatically reloads
- Check all components visually
- Test different variants (outline, ghost, etc.)

### 5. Validation Process

**Visual Checks**:
- [ ] Button variants (default, outline, ghost, link)
- [ ] Card components with different content
- [ ] Input and form controls
- [ ] Dialog and modal corners
- [ ] Dropdown menus and popovers
- [ ] All other UI components

**Responsive Testing**:
- [ ] Mobile viewport (375px)
- [ ] Tablet viewport (768px)
- [ ] Desktop viewport (1440px+)

**Build Validation**:
```bash
bun run typecheck
bun run build
```

### 6. Commit and PR

**Commit Message Format**:
```
chore: Refine theme border radius via tweakcn

- Adjusted border radius from 0.5rem to [NEW_VALUE]
- Used tweakcn visual editor for optimal spacing
- All radius variables updated proportionally
- Verified across all shadcn/ui components
```

**PR Template**:
- **Title**: `chore: Refine theme spacing and border radius with tweakcn`
- **Description**:
  - Summary of changes (radius adjustment)
  - Before/after values
  - Optional: Screenshots of key components
- **Testing**: All components verified visually and via build

## Data Flow

```
Current globals.css (Tailwind v4)
    ↓
Convert to tweakcn format (remove --color- prefix)
    ↓
Import to tweakcn.com
    ↓
Visual adjustment with live preview
    ↓
Export adjusted CSS variables
    ↓
Convert back to Tailwind v4 (add --color- prefix)
    ↓
Apply to globals.css in worktree
    ↓
Hot reload → Visual verification
    ↓
Build & TypeCheck
    ↓
Commit & PR
```

## Component Impact

### Components Affected
All 20+ installed shadcn/ui components will reflect radius changes:
- accordion, alert, avatar, badge, button
- card, checkbox, dialog, dropdown-menu
- form, input, label, popover, progress
- select, separator, sonner, switch, tabs, tooltip

### Components Unchanged
- Component variant definitions (no code changes)
- Component logic and functionality
- Component props and APIs

## Rollback Strategy

### If Changes Don't Look Good
1. Simply don't commit - discard changes in worktree
2. Or revert specific variables to original values
3. Or delete worktree: `git worktree remove ../finops-for-ai-sds-tweakcn`

### If Merged to Main and Need Rollback
1. Create new PR with original radius values
2. Or revert the merged PR commit

## Known Limitations

### tweakcn Constraints
- Only supports single `--radius` value (not radius-sm/md/lg/xl)
- Primarily focused on colors and basic radius
- Doesn't support custom spacing scales
- Uses Tailwind v3 format (requires conversion)

### Workarounds
- Manually calculate proportional radius values
- Use ratio multiplication for multiple radius variables
- Adjust spacing variables directly in code if needed

## Future Considerations

### If Additional Spacing Adjustments Needed
- Edit Tailwind config directly (if using traditional config)
- Or add custom spacing variables to `@theme` block
- Consider creating spacing presets for consistency

### If Wanting More tweakcn Integration
- Could create npm script to automate conversion
- Could document conversion process in CONTRIBUTING.md
- Could create custom tweakcn preset for this project

## Success Criteria

- [ ] Border radius adjusted to desired value
- [ ] All components visually consistent
- [ ] No TypeScript errors
- [ ] Production build succeeds
- [ ] All tests pass (if applicable)
- [ ] Changes documented in commit message
- [ ] PR approved and merged

## References

- tweakcn Website: https://tweakcn.com
- tweakcn Editor: https://tweakcn.com/editor/theme
- tweakcn GitHub: https://github.com/jnsahaj/tweakcn
- Tailwind CSS v4 Theme Docs: https://tailwindcss.com/docs/v4-beta
- shadcn/ui Theming: https://ui.shadcn.com/docs/theming
