import React from 'react';

interface CCIconProps {
    className?: string;
}

export const CCIcon: React.FC<CCIconProps> = ({ className = 'w-3.5 h-3.5' }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" />
    </svg>
);

export default CCIcon;
