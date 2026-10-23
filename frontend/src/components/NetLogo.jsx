import React from 'react';

export const NetLogo = ({ size = 'md', className = '' }) => {
    const sizeMap = {
        xs: 'w-8 h-8',
        sm: 'w-12 h-12',
        md: 'w-24 h-24',
        lg: 'w-36 h-36',
        xl: 'w-44 h-44'
    };

    return (
        <div 
            className={`rounded-full overflow-hidden inline-flex items-center justify-center border-2 border-cyan-400/40 shadow-[0_0_35px_rgba(0,163,255,0.35)] bg-white shrink-0 relative ${sizeMap[size] || sizeMap.md} ${className}`}
        >
            <img 
                src="/netconsultores-logo.jpg" 
                alt="Net Consultores Logo" 
                className="w-full h-full object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[1.48] pointer-events-none select-none"
            />
        </div>
    );
};

export default NetLogo;
