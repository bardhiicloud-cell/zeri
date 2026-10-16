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

  if (isOnline) return null;

  const getMessage = () => {
    if (language === 'en') return 'You are offline. Sending a report or looking up a Track ID needs a connection; nothing is sent until it returns, so keep the form open and try again.';
    if (language === 'sr') return 'Van mreže ste. Slanje prijave i provera Track ID-a zahtevaju vezu; ništa se ne šalje dok se ne vrati, pa ostavite formular otvoren i pokušajte ponovo.';
    return 'Ju jeni jashtë linje. Dërgimi i raportit dhe kërkimi me Track ID kërkojnë lidhje; asgjë nuk dërgohet derisa të kthehet, prandaj mbajeni formularin hapur dhe provoni përsëri.';
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-[11px] sm:text-xs font-bold z-[9999] relative shadow-sm dark:shadow-none border-b border-amber-600 animate-in slide-in-from-top-full duration-500">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span className="text-center">{getMessage()}</span>
    </div>
  );
}
