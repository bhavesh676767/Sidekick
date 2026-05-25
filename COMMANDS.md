# Sidekick - Commands Cheat Sheet

## Terminal Commands

### Installation & Setup
```bash
cd "c:\Users\bhave\OneDrive\Documents\projects\coding\Sidekick"
npm install
```

### Development
```bash
# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### VSCode Quick Access
```
Open folder: c:\Users\bhave\OneDrive\Documents\projects\coding\Sidekick
```

## File Navigation

### Main App Logic
- `src/App.jsx` - State management & screen routing

### Add New Component
1. Create `src/components/MyComponent.jsx`
2. Add to `src/components/index.js`
3. Import and use in screens

### Add New Screen
1. Create `src/screens/MyScreen.jsx`
2. Add to `src/screens/index.js`
3. Update `App.jsx` renderScreen() function

### Styling
- Global CSS: `src/styles/index.css`
- Tailwind config: `tailwind.config.js`
- Custom animations defined in index.css

## Component Imports

```javascript
// Buttons
import { Button, IconButton } from '@/components/Button';

// Cards
import { Card, QuickActionCard } from '@/components/Card';

// Inputs
import { Input, VoiceInput, Textarea } from '@/components/Input';

// Status
import { StatusDot, Badge, ProgressStep, Divider } from '@/components/Status';

// Illustrations
import {
  MascotPlaceholder,
  Doodle,
  ListeningAnimation,
  MicPulseRing,
} from '@/components/Illustrations';

// Icons (Lucide)
import { Settings, ChevronUp, X, Search } from 'lucide-react';
```

## Tailwind Classes Quick Reference

### Colors
```
text-black, text-gray-600, text-gray-400
bg-black, bg-white, bg-gray-50, bg-gray-100
border-gray-200, border-gray-300
```

### Sizing
```
w-full, w-96, h-12, p-4, px-6, py-3, gap-3, rounded-full
```

### Layouts
```
flex, items-center, justify-center, items-between
grid, grid-cols-2, gap-3
```

### Typography
```
text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px)
font-semibold, font-bold, tracking-wider
```

### Effects
```
shadow-sm, shadow-md
hover:bg-gray-100, transition-all, active:scale-95
```

### Animations
```
animate-pulse-soft, animate-mic-pulse, animate-slide-in
```

## Common Patterns

### Toggle Button
```jsx
<button className={`w-12 h-7 rounded-full flex items-center transition-all
  ${isActive ? 'bg-black' : 'bg-gray-300'}`}
>
  <div className={`w-5 h-5 rounded-full bg-white transition-all transform
    ${isActive ? 'translate-x-6' : 'translate-x-1'}`}
  />
</button>
```

### Status Row
```jsx
<div className="flex items-center justify-between">
  <div>
    <h3 className="font-semibold text-black mb-1">Label</h3>
    <p className="text-xs text-gray-500">Description</p>
  </div>
  <Badge variant="success">● Connected</Badge>
</div>
```

### Loading Button
```jsx
<Button disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Submit'}
</Button>
```

### Quick Actions Grid
```jsx
<div className="grid grid-cols-2 gap-3">
  {actions.map(action => (
    <QuickActionCard
      key={action.id}
      icon={action.icon}
      label={action.label}
      onClick={() => handleAction(action.id)}
    />
  ))}
</div>
```

## State Management Pattern

```jsx
// Add state in App.jsx
const [myValue, setMyValue] = useState(initialValue);

// Pass to component
<MyScreen value={myValue} onChange={setMyValue} />

// Use in component
const MyScreen = ({ value, onChange }) => {
  return (
    <button onClick={() => onChange(newValue)}>
      Click me
    </button>
  );
};
```

## Extension Setup

### Load in Chrome
1. `npm run build`
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist` folder

### Test Content Script
- Changes visible in webpage console
- Use `chrome.tabs.sendMessage` from background

### Test Background Script
- View logs: Right-click extension → Inspect background page
- Messages flow through `chrome.runtime.onMessage`

## Folder Structure Reminder

```
Sidekick/
├── src/
│   ├── components/    ← UI components
│   ├── screens/       ← Full page screens
│   ├── styles/        ← CSS & Tailwind
│   ├── App.jsx        ← Main logic
│   ├── main.jsx       ← Entry
│   ├── background.js  ← Extension
│   └── content.js     ← Extension
├── public/
│   └── manifest.json  ← Extension config
├── index.html
└── package.json
```

## Tips & Tricks

### Quick Screen Test
Change initial state in App.jsx:
```jsx
const [currentScreen, setCurrentScreen] = useState('settings'); // Test settings
```

### Debug Component
Add to any component:
```jsx
console.log('Props:', { ...props });
```

### View Tailwind Classes
Used classes auto-compile. Check DevTools > Styles.

### Reset State
Hard refresh: Ctrl+Shift+R (Windows)

### Build Performance
- npm run build is optimized
- Vite tree-shakes unused code
- Tailwind purges unused styles

## File Paths Reference

**Main app:** `src/App.jsx`
**Screens folder:** `src/screens/`
**Components folder:** `src/components/`
**Styles:** `src/styles/index.css`
**Config:** `tailwind.config.js`
**Extension:** `public/manifest.json`
**Docs:** `README.md`, `QUICKSTART.md`, `DEVELOPMENT.md`

## Documentation Index

- **README.md** - Full feature & structure docs
- **QUICKSTART.md** - Setup & overview
- **DEVELOPMENT.md** - Dev practices & patterns
- **COMPONENT_EXAMPLES.jsx** - Code examples
- **This file** - Commands & quick reference

---

**Happy coding! 🚀**
