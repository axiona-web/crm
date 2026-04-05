# Axiona CRM

Interné CRM pre správu kontaktov, obchodov, pipeline a provízií — s AI asistentom.

**Stack:** Vanilla HTML + CSS + JS · localStorage · Anthropic API  
**Hosting:** GitHub Pages (zadarmo)

---

## Funkcie

- **Dashboard** — prehľad pipeline, vážená hodnota, čakajúce provízie
- **Kontakty** — klienti, obchodníci, partneri (CRUD + vyhľadávanie)
- **Pipeline** — obchody podľa fáz, posúvanie stagov
- **Provízie** — sledovanie, označovanie vyplatených
- **AI Asistent** — Claude vidí tvoje dáta, radí, analyzuje, píše emaily
- **Export/Import** — záloha cez JSON

---

## Lokálne spustenie

Stačí otvoriť `index.html` v prehliadači — žiadny server, žiadny build step.

```bash
# alebo cez jednoduchý HTTP server
npx serve .
# prípadne
python3 -m http.server 8080
```

---

## Nasadenie na GitHub Pages

1. Vytvor repo na GitHube (napr. `axiona-crm`)
2. Nahraj súbory:
```bash
git init
git add .
git commit -m "init: axiona crm"
git remote add origin https://github.com/TVOJE_MENO/axiona-crm.git
git push -u origin main
```
3. Na GitHube → Settings → Pages → Source: **main branch / root**
4. CRM beží na `https://TVOJE_MENO.github.io/axiona-crm`

---

## AI Asistent — API kľúč

1. Choď na [console.anthropic.com](https://console.anthropic.com)
2. Vytvor API kľúč
3. V CRM → **Nastavenia** → vlož kľúč

Kľúč sa ukladá iba v tvojom `localStorage`, nikam sa neposiela okrem Anthropic API.

> ⚠️ Ak plánuješ repo ako **public**, API kľúč nikdy nepridávaj do kódu. Vždy sa zadáva cez UI.

---

## Dáta

Všetky dáta sú v `localStorage` tvojho prehliadača. Pre zálohu použi **Export JSON** v Nastaveniach.

---

## Roadmap

- [ ] Export do CSV
- [ ] Aktivity log (stretnutia, hovory, emaily)
- [ ] Notifikácie pre blížiace sa uzatvorenia
- [ ] Tagy a kategórie
- [ ] Viacero používateľov (vyžaduje backend)
