// Component Usage Examples
// Import and use components like this:

// ============================================
// BUTTONS
// ============================================

import { Button, IconButton } from '@/components/Button';
import { Settings, ChevronUp } from 'lucide-react';

// Primary button (black with hover)
<Button variant="primary" size="md" onClick={handleClick}>
  Get Started
</Button>

// Secondary button (gray)
<Button variant="secondary" size="sm">
  Cancel
</Button>

// Ghost button (no background)
<Button variant="ghost" className="w-full">
  More options
</Button>

// Outline button (border)
<Button variant="outline" size="lg">
  Save
</Button>

// Icon button
<IconButton icon={Settings} variant="ghost" />

// ============================================
// CARDS
// ============================================

import { Card, QuickActionCard } from '@/components/Card';

// Basic card
<Card>
  <h3 className="font-bold mb-2">Title</h3>
  <p>Content here</p>
</Card>

// Hoverable card
<Card hoverable onClick={handleClick}>
  Interactive content
</Card>

// Quick action card
<QuickActionCard
  icon={Zap}
  label="Summarize page"
  onClick={() => handleAction('summarize')}
/>

// ============================================
// INPUTS
// ============================================

import { Input, VoiceInput, Textarea } from '@/components/Input';

// Text input
<Input
  placeholder="Search..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>

// Voice input with mic
<VoiceInput
  placeholder="Ask Sidekick..."
  onMicClick={handleMicClick}
  micActive={isListening}
/>

// Text area
<Textarea
  placeholder="Enter your message..."
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  rows={4}
/>

// ============================================
// STATUS & INDICATORS
// ============================================

import {
  StatusDot,
  Badge,
  ProgressStep,
  Divider,
} from '@/components/Status';

// Status indicator
<StatusDot status="listening" /> {/* idle, listening, active, success, error */}

// Badge
<Badge variant="default">New</Badge>
<Badge variant="success">● Connected</Badge>
<Badge variant="dark">Pro</Badge>

// Progress step
<ProgressStep
  number={1}
  label="Understanding command"
  status="completed" {/* pending, active, completed */}
/>

// Divider line
<Divider className="my-4" />

// ============================================
// ILLUSTRATIONS & ANIMATIONS
// ============================================

import {
  MascotPlaceholder,
  Doodle,
  ListeningAnimation,
  MicPulseRing,
} from '@/components/Illustrations';

// Mascot character
<MascotPlaceholder className="drop-shadow-lg" />

// Decorative doodles
<Doodle type="dots" /> {/* dots, waves, arrow */}

// Listening animation (bars)
<ListeningAnimation className="h-16 mb-8" />

// Mic pulse ring
<MicPulseRing size="lg" /> {/* sm, md, lg, xl */}

// ============================================
// COMPLETE SCREEN EXAMPLE
// ============================================

const MyFeatureScreen = ({ onClose, onAction }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="w-96 bg-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-lg font-bold">My Feature</h1>
        <IconButton icon={X} onClick={onClose} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <p className="text-gray-600 mb-6">Welcome to my feature</p>

        <Card hoverable onClick={() => onAction('action1')} className="mb-4">
          <h3 className="font-semibold mb-1">Action 1</h3>
          <p className="text-sm text-gray-500">Description here</p>
        </Card>

        <Card hoverable onClick={() => onAction('action2')}>
          <h3 className="font-semibold mb-1">Action 2</h3>
          <p className="text-sm text-gray-500">Description here</p>
        </Card>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <QuickActionCard
            icon={Zap}
            label="Quick 1"
            onClick={() => onAction('quick1')}
          />
          <QuickActionCard
            icon={Settings}
            label="Quick 2"
            onClick={() => onAction('quick2')}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 space-y-2">
        <Input
          placeholder="Type something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button
          variant="primary"
          className="w-full"
          onClick={() => onAction('submit')}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Submit'}
        </Button>
      </div>
    </div>
  );
};

// ============================================
// STYLING PATTERNS
// ============================================

// Responsive grid
<div className="grid grid-cols-2 gap-3">
  {/* 2 columns on mobile, auto-responsive */}
</div>

// Spacing and alignment
<div className="flex items-center justify-between gap-4">
  {/* Horizontal flex with spacing */}
</div>

// Status row
<div className="flex items-center gap-2">
  <StatusDot status="active" />
  <span className="text-sm font-medium">Active</span>
</div>

// Card with badge
<Card>
  <div className="flex items-start justify-between mb-2">
    <h3 className="font-bold">Title</h3>
    <Badge variant="success">New</Badge>
  </div>
  <p className="text-sm text-gray-600">Content</p>
</Card>

// ============================================
// ANIMATION EXAMPLES
// ============================================

// Pulsing element
<div className="animate-pulse-soft">Pulsing content</div>

// Animated input on focus
<div className="focus-within:ring-2 focus-within:ring-black">
  <Input placeholder="Animated input" />
</div>

// Sliding content
<div className="animate-slide-in">
  Slides in on mount
</div>

// Mic pulse button
<button className="bg-black text-white animate-mic-pulse rounded-full w-12 h-12">
  🎙️
</button>

// ============================================
// STATE MANAGEMENT PATTERN
// ============================================

// In App.jsx
const [screenState, setScreenState] = useState({
  currentScreen: 'main',
  micActive: false,
  assistantStatus: 'idle',
  settings: {
    voiceInput: true,
    autoReadContext: true,
    confirmRiskyActions: true,
  },
});

// Update state
const updateSetting = (key, value) => {
  setScreenState(prev => ({
    ...prev,
    settings: {
      ...prev.settings,
      [key]: value,
    },
  }));
};

// Pass to screen
<SettingsScreen
  settings={screenState.settings}
  onToggleSetting={updateSetting}
/>

// ============================================
// COMMON PATTERNS
// ============================================

// Loading state
{isLoading ? (
  <Button disabled>Loading...</Button>
) : (
  <Button onClick={handleSubmit}>Submit</Button>
)}

// Error display
{error && (
  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
    <p className="text-sm text-gray-700">{error}</p>
  </div>
)}

// List with dividers
<div className="space-y-3">
  {items.map((item, idx) => (
    <>
      <div key={item.id} className="text-sm text-black">
        {item.label}
      </div>
      {idx < items.length - 1 && <Divider />}
    </>
  ))}
</div>

// Grouped form
<div className="space-y-3">
  <Input placeholder="Field 1" />
  <Input placeholder="Field 2" />
  <Input placeholder="Field 3" />
</div>
