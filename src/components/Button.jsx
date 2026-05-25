import React from 'react';

export const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  ...props 
}) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-gray-800',
    secondary: 'bg-gray-100 text-black hover:bg-gray-200',
    ghost: 'text-black hover:bg-gray-50',
    outline: 'border-2 border-black text-black hover:bg-black hover:text-white',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center font-semibold rounded-full
        transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export const IconButton = ({ 
  icon: Icon, 
  variant = 'ghost', 
  className = '',
  ...props 
}) => {
  const variants = {
    ghost: 'text-black hover:bg-gray-100',
    primary: 'text-white bg-black hover:bg-gray-800',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center w-10 h-10 rounded-full
        transition-all duration-200 active:scale-95
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      <Icon size={20} />
    </button>
  );
};
