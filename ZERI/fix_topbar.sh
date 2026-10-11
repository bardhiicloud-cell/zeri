#!/bin/bash
sed -i "s/const hiddenRoutes = \['\/', '\/login', '\/register', '\/admin', '\/approvals'\];/const hiddenRoutes = ['\/', '\/login', '\/register', '\/admin', '\/approvals', '\/harta', '\/raporto', '\/statistikat', '\/forum', '\/reels', '\/donacion', '\/kontakte', '\/detailed-registry', '\/sondazhet'];/g" src/components/layout/TopBar.tsx
