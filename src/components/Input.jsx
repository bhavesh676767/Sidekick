import React from 'react';

export const Input = ({ 
  placeholder = '', 
  value, 
  onChange,
  className = '',
  ...props 
}) => {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`
        input-base
        ${className}
      `}
      {...props}
    />
  );
};

export const VoiceInput = ({ 
  placeholder = 'Ask Sidekick anything…',
  onMicClick,
  micActive = false,
  className = '',
}) => {
  return (
    <div className={`relative flex items-center gap-3 ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        readOnly
        className={`
          input-base flex-1
          ${micActive ? 'ring-2 ring-black bg-gray-50' : ''}
        `}
      />
      <button
        onClick={onMicClick}
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          transition-all duration-200 active:scale-95
          ${micActive 
            ? 'bg-black text-white animate-mic-pulse' 
            : 'bg-black text-white hover:bg-gray-800'
          }
        `}
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 15a4 4 0 0 0 4-4V7a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4zm0-2a2 2 0 0 1-2-2V7a2 2 0 1 1 4 0v4a2 2 0 0 1-2 2zm5-6a1 1 0 1 0 0-2h-1a1 1 0 1 0 0 2h1zm-9 0a1 1 0 1 0 0-2H5a1 1 0 1 0 0 2h1z" />
        </svg>
      </button>
    </div>
  );
};

export const Textarea = ({ 
  placeholder = '', 
  value, 
  onChange,
  className = '',
  ...props 
}) => {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`
        w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-black
        placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black
        focus:bg-white transition-all duration-200 resize-none
        ${className}
      `}
      {...props}
    />
  );
};
