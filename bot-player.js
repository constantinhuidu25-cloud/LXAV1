// DEPRECATED — nu mai folosi acest script.
//
// A fost inlocuit de `functions/lxa-player.js`, care ruleaza automat ca
// Netlify Scheduled Function si foloseste 3 conturi fixe (LXA/AXL/WOW),
// cate unul per dificultate (1/2/3), fara sa creeze conturi noi la fiecare
// rulare. Acest script vechi:
//  - punea link catre domeniul vechi/sters "drollyv2.netlify.app" in loc de
//    site-ul curent live;
//  - folosea un singur cont (ID 12, numit "LXA") cu dificultate random 1-7,
//    desi backend-ul suporta doar 1-3;
//  - ar intra in conflict de nume cu noul cont "LXA" din lxa-player.js daca
//    ar mai fi rulat.
//
// Fisierul e lasat aici doar ca istoric; nu mai porni acest proces.

console.log('[bot-player] Deprecated. Keep-alive-ul ruleaza acum din functions/lxa-player.js ca Netlify Scheduled Function.');
process.exit(0);
