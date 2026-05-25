# Sidekick - Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd "c:\Users\bhave\OneDrive\Documents\projects\coding\Sidekick"
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Opens at http://localhost:5173

### 3. Build for Production
```bash
npm run build
```
Output goes to `dist/` folder

### 4. Load as Chrome Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist` folder after building

## 📁 Project Structure

```
Sidekick/
├── src/
│   ├── components/           # Reusable components
│   │   ├── Button.jsx        # Button variants
│   │   ├── Card.jsx          # Card components
│   │   ├── Input.jsx         # Input fields
│   │   ├── Status.jsx        # Status indicators
│   │   ├── Illustrations.jsx # Mascot & doodles
│   │   └── index.js
│   ├── screens/              # Full screens
│   │   ├── OnboardingScreen.jsx
│   │   ├── MainPopupScreen.jsx
│   │   ├── ListeningScreen.jsx
│   │   ├── TaskExecutionScreen.jsx
│   │   ├── SettingsScreen.jsx
│   │   └── index.js
│   ├── styles/
│   │   └── index.css         # Tailwind & animations
│   ├── App.jsx               # Main app component
│   ├── main.jsx              # React entry
│   ├── background.js         # Extension background
│   └── content.js            # Extension content
├── public/
│   ├── manifest.json         # Extension config
│   └── sidekick_logo.png     # Logo
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── README.md
├── DEVELOPMENT.md
└── LICENSE
```

## 🎨 Design System

### Colors
- **Primary**: Black (#000000)
- **Background**: White (#FFFFFF)
- **Accents**: Grays (50-900)

### Typography
- **Bold headings** for hierarchy
- **Soft body text** in gray-600
- **System font** for performance

### Spacing
- **24px border-radius** for premium feel
- **Soft shadows** for depth
- **Generous whitespace**

### Animations
- **Pulse animations** for listening
- **Smooth transitions** (200ms)
- **Scale feedback** on clicks

## 🎯 Screens Overview

### 1️⃣ Onboarding Screen
- Welcome message
- Mascot illustration
- Call-to-action button
- Decorative doodles

### 2️⃣ Main Popup
- Status indicator
- Voice input with mic button
- 6 quick action cards
- Settings button
- API status footer

### 3️⃣ Listening Screen
- Animated mic pulse ring
- Live transcript display
- Stop button
- Processing feedback

### 4️⃣ Task Execution Screen
- Step-by-step progress
- Real-time status updates
- Result display
- Action buttons

### 5️⃣ Settings Screen
- Toggle preferences
- API status display
- About section
- Back navigation

## 🧩 Components Overview

### Buttons
```jsx
<Button variant="primary" size="lg">Get Started</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">Ghost</Button>
```

### Cards
```jsx
<Card hoverable>Content</Card>
<QuickActionCard icon={Icon} label="Action" onClick={handler} />
```

### Inputs
```jsx
<Input placeholder="Type..." value={val} onChange={handler} />
<VoiceInput onMicClick={handler} micActive={isActive} />
```

### Status
```jsx
<StatusDot status="listening" />
<Badge variant="success">● Connected</Badge>
<ProgressStep number={1} label="Step" status="active" />
```

### Illustrations
```jsx
<MascotPlaceholder />
<Doodle type="dots" />
<ListeningAnimation />
<MicPulseRing size="lg" />
```

## 🔄 State Management

Main app state in [App.jsx](src/App.jsx):
- `currentScreen` - Active screen
- `micActive` - Mic state
- `assistantStatus` - idle/listening/active
- `settings` - User preferences
- `transcript` - Voice input text

## 🛠️ Development Tips

### Toggle Between Screens
Edit initial state in [App.jsx](src/App.jsx):
```jsx
const [currentScreen, setCurrentScreen] = useState('main'); // Change to test different screens
```

### Test Voice Feature
Manually set transcript in [App.jsx](src/App.jsx):
```jsx
const [transcript, setTranscript] = useState('Test transcript here');
```

### Customize Colors
Edit [tailwind.config.js](tailwind.config.js):
```js
colors: {
  black: "#000000",
  // Modify colors
}
```

### Add New Animations
Edit [src/styles/index.css](src/styles/index.css):
```css
@keyframes my-animation {
  from { /* */ }
  to { /* */ }
}
```

## 📋 Component Checklist

- ✅ Button (primary, secondary, ghost, icon)
- ✅ Card (basic, hoverable, quick actions)
- ✅ Input (text, voice, textarea)
- ✅ Status (dots, badges, progress steps, dividers)
- ✅ Illustrations (mascot, doodles, animations)
- ✅ Onboarding screen
- ✅ Main popup screen
- ✅ Listening screen
- ✅ Task execution screen
- ✅ Settings screen
- ✅ App state management
- ✅ Extension manifest
- ✅ Background script
- ✅ Content script

## 🚦 Next Steps

1. **Add Real API Integration**
   - Connect Gemini API
   - Implement Web Speech API
   - Real form filling logic

2. **Extend Functionality**
   - Tab management
   - Page summarization
   - Website navigation

3. **User Features**
   - Authentication
   - Settings persistence
   - Custom voice profiles

4. **Polish**
   - Keyboard shortcuts
   - Dark mode
   - Accessibility improvements

## 🐛 Troubleshooting

### Extension won't load?
- Make sure manifest.json is in public/ folder
- Check browser console for errors
- Verify all files are built to dist/

### Styles not loading?
- Run `npm run build` to compile CSS
- Check that Tailwind config is correct
- Verify @tailwind directives in CSS

### State not updating?
- Check React DevTools for state changes
- Verify handlers are connected properly
- Look for console errors

## 📞 Support

See [README.md](README.md) for full documentation
See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed dev guide

---

**Enjoy building Sidekick!** 🎙️✨
