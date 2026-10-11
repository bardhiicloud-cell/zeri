import fs from 'fs';
let content = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');

// Add Reels to allNavigation
content = content.replace(
  "{ name: 'Debati Publik', href: '/forum', icon: Users, guestAllowed: true },",
  "{ name: 'Debati Publik', href: '/forum', icon: Users, guestAllowed: true },\n    { name: 'Reels & Video', href: '/reels', icon: Video, guestAllowed: true },"
);

// We need to import Video if not imported.
if (!content.includes('Video')) {
  content = content.replace(
    "import { Menu, Home, ShieldAlert, PlusCircle, Map as MapIcon, LogOut, Bell, X, Users, MessageSquare, Phone, Heart, Award, Sun, Moon, LogIn, ChevronRight, BarChartIcon, Vote } from 'lucide-react';",
    "import { Menu, Home, ShieldAlert, PlusCircle, Map as MapIcon, LogOut, Bell, X, Users, MessageSquare, Phone, Heart, Award, Sun, Moon, LogIn, ChevronRight, BarChartIcon, Vote, Video } from 'lucide-react';"
  );
}

// Update mobileBottomNavigation to include Reels
content = content.replace(
  "{ name: 'Forum', href: '/forum', icon: Users }",
  "{ name: 'Forum', href: '/forum', icon: Users },\n    { name: 'Reels', href: '/reels', icon: Video }"
);

fs.writeFileSync('src/components/layout/AppLayout.tsx', content);
