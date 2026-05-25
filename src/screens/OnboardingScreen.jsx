import React from 'react';
import { Button } from '../components/Button';
import { MascotPlaceholder, Doodle } from '../components/Illustrations';

export const OnboardingScreen = ({ onGetStarted }) => {
  return (
    <div className="h-full bg-white flex flex-col items-center justify-center p-6 text-center">
      {/* Decorative elements */}
      <div className="absolute top-8 left-8 opacity-30">
        <Doodle type="dots" />
      </div>
      <div className="absolute bottom-12 right-6 opacity-20">
        <Doodle type="waves" />
      </div>

      {/* Logo */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
          <span className="text-white text-xl font-bold">S</span>
        </div>
        <h1 className="text-3xl font-bold">Sidekick</h1>
      </div>

      {/* Mascot */}
      <div className="mb-8 mt-4">
        <MascotPlaceholder className="drop-shadow-lg" />
      </div>

      {/* Heading */}
      <h2 className="text-3xl font-bold text-black mb-3 leading-tight max-w-xs">
        Control the web with your voice.
      </h2>

      {/* Subtext */}
      <p className="text-base text-gray-600 mb-12 max-w-sm leading-relaxed">
        Ask Sidekick to browse, search, click, type, summarize, and automate your browser.
      </p>

      {/* CTA Button */}
      <Button 
        variant="primary" 
        size="lg"
        onClick={onGetStarted}
        className="mb-8"
      >
        Get Started
      </Button>

      {/* Footer text */}
      <p className="text-xs text-gray-400 mt-12">
        No ads. No tracking. All local.
      </p>
    </div>
  );
};
