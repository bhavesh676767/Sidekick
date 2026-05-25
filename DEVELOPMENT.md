# Sidekick Component Development Guide

## Quick Reference

### Creating New Components

Components should follow these patterns:

```jsx
// src/components/MyComponent.jsx
import React from 'react';

export const MyComponent = ({ 
  children, 
  className = '',
  variant = 'default',
  ...props 
}) => {
  return (
    <div className={`base-classes ${className}`} {...props}>
      {children}
    </div>
  );
};
```

### Component Best Practices

1. **Props**: Always include `className` and spread `...props`
2. **Variants**: Use variant patterns for different component states
3. **Defaults**: Provide sensible defaults for all optional props
4. **Exports**: Add to barrel export files (components/index.js)

## Available Tailwind Classes

### Button Classes
- `.btn-primary` - Black button with hover effect
- `.btn-secondary` - Gray button
- `.btn-ghost` - Hover background only
- `.btn-icon` - Icon button (10x10)

### Card Classes
- `.card` - Base card styling
- `.card-hover` - Card with hover effects

### Input Classes
- `.input-base` - Text input styling
- `.badge` - Badge/label styling

## Animations

- `animate-pulse-soft` - Gentle pulsing animation
- `animate-mic-pulse` - Microphone button animation
- `animate-slide-in` - Slide in from top

## Color System

- Use `text-black` and `bg-black` for primary
- Use `text-gray-600` for secondary text
- Use `bg-gray-50` and `bg-gray-100` for backgrounds
- Use `border-gray-200` for subtle borders

## Typography

- `text-xs` - 12px (small labels)
- `text-sm` - 14px (secondary text)
- `text-base` - 16px (body)
- `text-lg` - 18px (large)
- `text-xl` - 20px
- `text-2xl` - 24px (subheadings)
- `text-3xl` - 32px (headings)
- `text-4xl` - 40px (main titles)

## Spacing

- `p-4` - 16px padding
- `p-5` - 20px padding
- `gap-3` - 12px gap
- `gap-4` - 16px gap
- `mb-8` - 32px margin-bottom

## Creating New Screens

1. Create file in `src/screens/MyScreen.jsx`
2. Accept state and handlers as props
3. Use existing components
4. Add to App.jsx screen switcher
5. Export from screens/index.js

## State Management

The app uses React hooks. To add new state:

1. Add useState hook in App.jsx
2. Pass state and setter as props
3. Update corresponding screen component

Example:
```jsx
const [myState, setMyState] = useState(initialValue);

// Pass to screen
<MyScreen state={myState} onStateChange={setMyState} />
```

## Testing Screens Locally

1. Update App.jsx initial screen state
2. Run `npm run dev`
3. Open http://localhost:5173
4. Navigate between screens using buttons

## Common Customization

### Changing Colors
Edit `tailwind.config.js` theme colors:
```js
colors: {
  black: "#000000",
  // Update colors here
}
```

### Adjusting Spacing
Update `tailwind.config.js` spacing:
```js
spacing: {
  // Add custom spacing values
}
```

### Adding Animations
Add keyframes in `src/styles/index.css`:
```css
@keyframes my-animation {
  /* animation frames */
}
```

## Extension Development Notes

- Background script: `src/background.js`
- Content script: `src/content.js`
- Manifest: `public/manifest.json`
- Messages use Chrome's `chrome.runtime.onMessage` API
- All extension functionality is ready for implementation
