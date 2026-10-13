# Raul & Andreea — Wedding Planner

Aplicație web statică pentru organizarea nunții, construită pornind de la structura aplicației atașate.

## Funcții

- 3 categorii de invitați:
  - Invitați Raul
  - Invitați Andreea
  - Invitați comuni / prieteni
- RSVP, adulți, copii, telefon, masă, preferințe meniu și notițe.
- Catalog de săli cu: capacitate, preț închiriere, preț meniu/persoană, avans, contact, adresă, website, parcare, cazare, facilități, notițe.
- Disponibilitate pe zile exacte de sâmbătă/duminică în 2027 și 2028.
- Calendar lunar pentru 2027–2028 care evidențiază doar weekend-urile și arată câte săli sunt disponibile în fiecare zi.
- Sincronizare automată la aproximativ 15 secunde și buton de sincronizare manuală.
- Adăugare, editare și ștergere pentru invitați și săli.
- Export Excel complet cu 3 foi: `Invitati`, `Sali`, `Disponibilitate`.

## Foi live

- Invitați: https://calc.domainepublic.net/286gugy2seqx
- Săli: https://calc.domainepublic.net/xrplrbue3waf

Aplicația citește CSV din EtherCalc și salvează folosind endpoint-ul compatibil `/_/<room>`.

## Structura datelor

### Invitați

`id,name,category,status,adults,children,phone,table,menu,notes,updated_at,deleted`

### Săli

`id,name,city,address,capacity,price,menu_price,deposit,contact,phone,website,parking,accommodation,features,availability_dates,notes,updated_at,deleted`

`availability_dates` conține date ISO separate prin `;`, de exemplu:

`2027-05-15;2027-05-16;2027-06-05`

## Publicare

Pune `index.html`, `styles.css` și `app.js` în același folder pe GitHub Pages sau pe orice hosting static HTTPS.

> Notă: sincronizarea direct din browser depinde de politica CORS a serverului EtherCalc. Implementarea urmează aceeași metodă ca aplicația sursă: citire CSV și scriere PUT pe endpoint-ul foii.
