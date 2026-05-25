import React from 'react';

// Playful hand-drawn style doodle components
export const MascotPlaceholder = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {/* Head - rounded rectangle with slight tilt */}
        <rect
          x="60"
          y="40"
          width="80"
          height="90"
          rx="20"
          ry="20"
          fill="white"
          stroke="black"
          strokeWidth="2.5"
          transform="rotate(-2 100 85)"
        />
        
        {/* Left eye */}
        <circle cx="75" cy="65" r="6" fill="black" />
        {/* Right eye */}
        <circle cx="125" cy="65" r="6" fill="black" />
        
        {/* Smile - curved line */}
        <path
          d="M 80 85 Q 100 95 120 85"
          stroke="black"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Left ear */}
        <ellipse cx="50" cy="55" rx="12" ry="18" fill="white" stroke="black" strokeWidth="2.5" />
        {/* Right ear */}
        <ellipse cx="150" cy="55" rx="12" ry="18" fill="white" stroke="black" strokeWidth="2.5" />
        
        {/* Body - rounded rectangle */}
        <rect
          x="55"
          y="125"
          width="90"
          height="50"
          rx="15"
          ry="15"
          fill="white"
          stroke="black"
          strokeWidth="2.5"
        />
        
        {/* Left arm */}
        <rect
          x="20"
          y="135"
          width="35"
          height="18"
          rx="9"
          ry="9"
          fill="white"
          stroke="black"
          strokeWidth="2.5"
          transform="rotate(-15 52.5 144)"
        />
        
        {/* Right arm */}
        <rect
          x="145"
          y="135"
          width="35"
          height="18"
          rx="9"
          ry="9"
          fill="white"
          stroke="black"
          strokeWidth="2.5"
          transform="rotate(15 162.5 144)"
        />
        
        {/* Microphone symbol in body */}
        <circle cx="100" cy="150" r="8" fill="none" stroke="black" strokeWidth="2" />
        <line x1="100" y1="158" x2="100" y2="168" stroke="black" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

// Decorative doodles
export const Doodle = ({ type = 'dots', className = '' }) => {
  if (type === 'dots') {
    return (
      <svg
        width="60"
        height="60"
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <circle cx="15" cy="15" r="2" fill="black" />
        <circle cx="45" cy="15" r="2" fill="black" />
        <circle cx="15" cy="45" r="2" fill="black" />
        <circle cx="45" cy="45" r="2" fill="black" />
        <circle cx="30" cy="30" r="2" fill="black" opacity="0.3" />
      </svg>
    );
  }
  
  if (type === 'waves') {
    return (
      <svg
        width="80"
        height="40"
        viewBox="0 0 80 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M 10 20 Q 15 10 20 20 T 40 20 T 60 20 T 80 20"
          stroke="black"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 10 28 Q 15 22 20 28 T 40 28 T 60 28 T 80 28"
          stroke="black"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>
    );
  }
  
  if (type === 'arrow') {
    return (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M 10 15 L 20 25 L 30 15"
          stroke="black"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  
  return null;
};

// Listening animation
export const ListeningAnimation = ({ className = '' }) => {
  return (
    <div className={`flex items-end justify-center gap-1 h-16 ${className}`}>
      <div className="w-1 h-6 bg-black rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
      <div className="w-1 h-10 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
      <div className="w-1 h-8 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
      <div className="w-1 h-12 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
      <div className="w-1 h-9 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
      <div className="w-1 h-11 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="w-1 h-7 bg-black rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
    </div>
  );
};

// Mic pulse ring
export const MicPulseRing = ({ size = 'lg', className = '' }) => {
  const sizeMap = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
    xl: 'w-48 h-48',
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeMap[size]} ${className}`}>
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-black opacity-20 animate-ping" />
      {/* Middle ring */}
      <div className="absolute inset-2 rounded-full border-2 border-black opacity-30 animate-pulse" />
      {/* Inner circle */}
      <div className="relative w-12 h-12 bg-black rounded-full flex items-center justify-center">
        <svg
          className="w-6 h-6 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 15a4 4 0 0 0 4-4V7a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4zm0-2a2 2 0 0 1-2-2V7a2 2 0 1 1 4 0v4a2 2 0 0 1-2 2z" />
        </svg>
      </div>
    </div>
  );
};
