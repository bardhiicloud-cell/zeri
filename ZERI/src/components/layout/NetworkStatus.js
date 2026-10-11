import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
export function NetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { language } = useLanguage();
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    if (isOnline)
        return null;
    const getMessage = () => {
        if (language === 'en')
            return 'You are offline. Your reports will sync automatically when the connection is restored.';
        if (language === 'sr')
            return 'Van mreže ste. Vaši izveštaji će se automatski sinhronizovati kada se veza uspostavi.';
        return 'Ju jeni jashtë linje. Raportimet tuaja do të sinkronizohen automatikisht kur të rikthehet lidhja.';
    };
    return (_jsxs("div", { className: "bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-[11px] sm:text-xs font-bold z-[9999] relative shadow-sm dark:shadow-none border-b border-amber-600 animate-in slide-in-from-top-full duration-500", children: [_jsx(WifiOff, { className: "w-4 h-4 shrink-0" }), _jsx("span", { className: "text-center", children: getMessage() })] }));
}
