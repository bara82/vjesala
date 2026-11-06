# Vješala

Igra vješala na hrvatskom za djecu i odrasle. Statična web-aplikacija (HTML/CSS/JS, bez builda), objavljena na GitHub Pages i instalabilna kao PWA — radi i u zrakoplovnom načinu rada.

## Mogućnosti
- 12 kategorija riječi prilagođenih djeci (`words.js`) i 3 težine (lako / srednje / teško)
- Igra za dvoje: jedan igrač zadaje riječ (uz neobavezni trag), drugi pogađa
- Hrvatska slova i dvoslovi (NJ, LJ, DŽ kao jedno slovo); fizička tipkovnica također radi
- Pomoć (otkrije slovo za 1 život), pogađanje cijele riječi (−2 života ako krivo)
- Statistika i nastavak prekinute igre (spremljeno lokalno na uređaju)
- Svijetla i tamna tema prema postavkama uređaja

## Offline
`service-worker.js` sprema sve datoteke pri prvom otvaranju. Nakon promjene bilo koje datoteke povećaj `VERSION` u `service-worker.js` da bi se uređaji osvježili.

## Dodavanje riječi
Dopiši riječi u odgovarajuću kategoriju u `words.js` (velikim slovima). Izbjegavaj riječi u kojima su N+J, L+J ili D+Ž zasebna slova (npr. „injekcija”).
