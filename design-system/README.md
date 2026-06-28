# brutalist-ui

A neobrutalist design system with hard borders, bold shadows, and raw energy.

## Philosophy

Inspired by [neobrutalism](https://neobrutalism.dev/) — high contrast, thick borders, offset shadows, and bold typography. No subtle gradients, no blur shadows, no rounded-everything. Raw, functional, honest.

## Quick Start

### CSS Only (any framework)

```html
<link rel="stylesheet" href="css/index.css">
```

Or import in your CSS:
```css
@import "brutalist-ui/css/index.css";
```

### React Components

```tsx
import { Button, Card, Badge, Input } from "brutalist-ui/components";
import "brutalist-ui/css";

function App() {
  return (
    <Card>
      <h2>Welcome</h2>
      <Input label="Email" placeholder="you@example.com" />
      <Button variant="primary">Get Started</Button>
    </Card>
  );
}
```

## Design Tokens

All tokens are CSS custom properties on `:root`. Override them to theme:

```css
:root {
  --bu-primary: #FF6B00;     /* Change accent color */
  --bu-radius: 8px;           /* Rounder corners */
  --bu-border-width: 3px;     /* Thicker borders */
}
```

### Dark Mode

Add `data-theme="dark"` to `<html>`:
```html
<html data-theme="dark">
```

## Components

| Component | Description |
|---|---|
| `Button` | Primary, danger, success, ghost variants. XS, SM, MD, LG sizes. |
| `Input` | Text input with label, helper text, error state. |
| `Card` | Container with border and shadow. SM, MD, LG sizes. |
| `Badge` | Status labels: primary, success, danger, warning, info, neutral. |
| `Modal` | Dialog overlay with header, body, footer. Escape to close. |
| `Toast` | Alert banners: success, danger, warning, info. |
| `Tabs` | Tab navigation with context-based panel switching. |
| `Select` | Styled dropdown select. |
| `Tooltip` | Hover tooltip with content. |

## Utility Classes

Layout: `bu-flex`, `bu-grid`, `bu-grid-2`, `bu-grid-3`, `bu-grid-4`
Spacing: `bu-p-4`, `bu-mt-2`, `bu-gap-4`, etc.
Typography: `bu-text-sm`, `bu-font-bold`, `bu-uppercase`, etc.
Colors: `bu-text-primary`, `bu-text-muted`, `bu-text-success`, etc.

## File Structure

```
design-system/
├── css/
│   ├── tokens.css         # Design tokens (colors, spacing, typography)
│   ├── reset.css          # CSS reset and base styles
│   ├── components.css     # Component styles
│   ├── utilities.css      # Utility classes
│   └── index.css          # Main entry (imports all CSS)
├── components/
│   ├── Button/
│   ├── Input/
│   ├── Card/
│   ├── Badge/
│   ├── Modal/
│   ├── Toast/
│   ├── Tabs/
│   ├── Select/
│   ├── Tooltip/
│   └── index.ts           # Main entry (exports all components)
├── package.json
└── README.md
```

## Extraction Guide

To use in another project:

1. Copy the `design-system/` folder
2. Install peer dependency: `npm install react react-dom`
3. Import CSS: `import "design-system/css"`
4. Import components: `import { Button } from "design-system/components"`

## License

MIT
