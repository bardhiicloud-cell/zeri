import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '../../lib/store';
import { AnimatePresence, motion } from 'framer-motion';
import { coordinatesToCell } from '../../lib/municipalityNormalizer';
import { hasAnalyticsConsent, onConsentChange } from '../../lib/consent';
/** Statuses that still need institutional action. */
const OPEN_STATUSES = new Set(['Pending Review', 'Approved', 'Assigned', 'In Progress']);
/**
 * Minimum number of open problems in the same ~1.1 km cell before the citizen is
 * warned. Three is the threshold that was already in use; keeping it avoids a
 * notification for a single street defect.
 */
const ALERT_THRESHOLD = 3;
export function NearbyAlerts() {
    const reports = useStore(state => state.reports);
    const [alert, setAlert] = useState(false);
    const [locatingAllowed, setLocatingAllowed] = useState(() => hasAnalyticsConsent());
    const alertRef = useRef(false);
    // Answering the cookie banner can happen after this component mounts, so the
    // geolocation gate has to follow the consent event rather than read it once.
    useEffect(() => {
        return onConsentChange(() => setLocatingAllowed(hasAnalyticsConsent()));
    }, []);
    // The watcher must not re-arm on every `reports` update. Reading the store
    // through a ref keeps it registered exactly once, which is what stops a live
    // snapshot stream from stacking duplicate geolocation watchers.
    const reportsRef = useRef(reports);
    reportsRef.current = reports;
    useEffect(() => {
        // No consent, no sensor. Law 06/L-082 makes prior consent mandatory for
        // locating a citizen, and geolocation data is personal data under Article 1.
        if (!locatingAllowed)
            return;
        if (typeof navigator === 'undefined' || !('geolocation' in navigator))
            return;
        if (typeof window === 'undefined')
            return;
        // Ask once per session: the browser already remembers the choice, and a
        // repeated permission prompt on every mount is a privacy problem, not a feature.
        if (window.sessionStorage.getItem('zeri_nearby_alerts_prompted') === '1')
            return;
        window.sessionStorage.setItem('zeri_nearby_alerts_prompted', '1');
        let cancelled = false;
        const watchId = navigator.geolocation.watchPosition((position) => {
            if (cancelled || alertRef.current)
                return;
            const { latitude, longitude } = position.coords;
            // Compare against the anonymous ~1.1 km cell rather than the raw fix, so
            // the citizen's precise position is not retained by this component.
            const cell = coordinatesToCell(latitude, longitude);
            if (!cell)
                return;
            const nearbyUnresolved = reportsRef.current.filter((report) => OPEN_STATUSES.has(report.status) &&
                report.location?.lat != null && report.location?.lng != null &&
                Math.abs(report.location.lat - cell.lat) < 0.02 &&
                Math.abs(report.location.lng - cell.lng) < 0.02);
            if (nearbyUnresolved.length >= ALERT_THRESHOLD) {
                alertRef.current = true;
                setAlert(true);
                // Nothing more to watch for: release the sensor immediately.
                navigator.geolocation.clearWatch(watchId);
            }
        }, () => {
            // Permission denied or unavailable: fail closed and stay silent.
        }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
        return () => {
            cancelled = true;
            navigator.geolocation.clearWatch(watchId);
        };
    }, [locatingAllowed]);
    const dismiss = () => {
        alertRef.current = false;
        setAlert(false);
    };
    return (_jsx(AnimatePresence, { children: alert && (_jsxs(motion.div, { initial: { opacity: 0, y: 50 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 50 }, role: "status", "aria-live": "polite", className: "fixed bottom-20 md:bottom-4 right-4 bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] z-[9999] flex items-start gap-3 max-w-sm", children: [_jsx("div", { className: "bg-orange-100 p-2 rounded-full shrink-0 mt-0.5", children: _jsx(AlertTriangle, { className: "w-5 h-5 text-orange-600 animate-pulse" }) }), _jsxs("div", { children: [_jsx("h4", { className: "font-bold text-sm", children: dt(`Kujdes! Zonë me rrezik`) }), _jsx("p", { className: "text-xs mt-1 text-orange-700/80 font-medium", children: dt(`Keni hyrë në një zonë me përqëndrim të lartë të problemeve të paraportuara. Tregoni kujdes të shtuar.`) })] }), _jsx("button", { onClick: dismiss, "aria-label": dt('Mbyll'), className: "text-orange-400 hover:text-orange-600 shrink-0", children: _jsx(X, { className: "w-4 h-4" }) })] })) }));
}
