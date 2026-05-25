# Sidekick - AI Voice Assistant Browser Extension

A premium, minimal black-and-white browser extension UI for an AI voice assistant that can understand webpages, open websites, search, click buttons, fill forms, summarize content, manage tabs, and execute browser tasks through natural conversation.

## Features

- 🎙️ **Voice-controlled interface** - Hands-free browsing with natural language
- 📋 **Quick actions** - Summarize, search, open websites, fill forms, click buttons, manage tabs
- ✨ **Premium minimalist design** - Black and white with soft rounded corners
- 🎨 **Hand-drawn mascot** - Friendly assistant character
- ⚙️ **Customizable settings** - Toggle voice input, auto-context reading, safety confirmations
- 🚀 **Production-ready** - Built with React and Tailwind CSS

## Project Structure

```
sidekick/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Button.jsx       # Primary, secondary, ghost buttons
│   │   ├── Card.jsx         # Card and quick action cards
│   │   ├── Input.jsx        # Text inputs and voice input
│   │   ├── Status.jsx       # Status indicators, badges, progress
│   │   ├── Illustrations.jsx # Mascot, doodles, animations
│   │   └── index.js         # Barrel export
│   ├── screens/             # Full-screen views
│   │   ├── OnboardingScreen.jsx    # Welcome screen
│   │   ├── MainPopupScreen.jsx     # Main assistant interface
│   │   ├── ListeningScreen.jsx     # Active listening state
│   │   ├── TaskExecutionScreen.jsx # Task progress view
│   │   ├── SettingsScreen.jsx      # Configuration panel
│   │   └── index.js                # Barrel export
│   ├── styles/
│   │   └── index.css        # Global styles & Tailwind
│   ├── App.jsx              # Main app with state management
│   ├── main.jsx             # React DOM entry
│   ├── background.js        # Chrome extension background
│   └── content.js           # Content script for webpages
├── public/
│   └── manifest.json        # Chrome extension manifest
├── index.html               # HTML entry point
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

## Components

### UI Components
- **Button** - Primary, secondary, ghost, and outline variants
- **IconButton** - Icon-only button component
- **Card** - Reusable card with optional hover effects
- **Input/VoiceInput** - Text input and voice command field
- **StatusDot** - Animated status indicator
- **Badge** - Label badges with variants
- **ProgressStep** - Step indicators for task execution
- **Divider** - Separator line

### Illustrations
- **MascotPlaceholder** - Cute hand-drawn assistant character
- **Doodle** - Decorative doodle elements (dots, waves, arrows)
- **ListeningAnimation** - Animated sound wave bars
- **MicPulseRing** - Animated microphone pulse ring

### Screens
1. **Onboarding** - Welcome with mascot and call-to-action
2. **Main Popup** - Quick actions grid, voice input, greeting
3. **Listening** - Animated mic with transcript display
4. **Task Execution** - Step-by-step progress and results
5. **Settings** - Toggle preferences and API status

## Design System

### Colors
- **Primary**: Pure black (#000000)
- **Background**: White (#FFFFFF)
- **Grays**: 50-900 scale for depth

### Typography
- **Font**: System font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- **Weights**: Light, normal, medium, semibold, bold
- **Sizes**: 12px - 40px with proper line-height

### Spacing & Corners
- **Border Radius**: 24px (default), 12-32px variants
- **Shadows**: Soft shadows (0.05 - 0.12 opacity)
- **Spacing**: 4px grid system

### Animations
- **Pulse animations** for listening state
- **Slide-in** for new content
- **Smooth transitions** for interactions
- **Scale transforms** for button feedback

## Setup & Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Chrome Extension Setup

1. Build the project: `npm run build`
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Features Breakdown

### Onboarding Screen
- Logo: "Sidekick"
- Heading: "Control the web with your voice."
- Subheading: Explanation of capabilities
- Mascot illustration
- Call-to-action button

### Main Popup
- Header with logo, status indicator, settings
- Personalized greeting (e.g., "Hey Bhavesh,")
- Voice command input with mic button
- 6 quick action cards:
  - Summarize page
  - Open website
  - Fill form
  - Search web
  - Click button
  - Manage tabs
- Footer showing API status

### Listening State
- Large animated mic pulse ring
- Live transcript display
- Listening/Processing status
- Stop button

### Task Execution
- Current task title
- Step-by-step progress indicators
- Visual progression through steps
- Result display on completion
- Action buttons (New Command, Close)

### Settings
- Voice input toggle
- Auto-read page context toggle
- Confirm risky actions toggle
- Gemini API status
- Speech API status
- Version & support info

## State Management

The app uses React hooks for simple state management:
- `currentScreen` - Active screen enum
- `micActive` - Microphone state
- `assistantStatus` - idle, listening, active
- `settings` - User preferences
- `executionSteps` - Task progress

## Mocked Features

All assistant responses and task execution are mocked to allow for UI testing:
- Voice transcripts randomly selected from predefined list
- Task execution simulates step progression
- Results are static example text
- API statuses are hardcoded

## Styling

Uses **Tailwind CSS** for utility-first styling with custom configuration:
- Custom color palette (black, white, grays)
- Extended spacing and border-radius
- Soft box-shadow values
- Custom animations (pulse-soft, mic-pulse, slide-in)
- Typography scale optimized for UI

## Browser Compatibility

- Chrome 90+
- Edge 90+
- Brave 1.20+
- Other Chromium-based browsers

## Future Enhancements

- [ ] Real Gemini API integration
- [ ] Web Speech API integration
- [ ] Real DOM manipulation and form filling
- [ ] Tab management functionality
- [ ] Page summarization logic
- [ ] User authentication
- [ ] Cloud sync for settings
- [ ] Custom voice profiles
- [ ] Keyboard shortcuts
- [ ] Dark mode support

## License

MIT

## Author

Built with ❤️ for the Sidekick project
