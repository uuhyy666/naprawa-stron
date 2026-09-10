#!/usr/bin/env node
/**
 * rejestry-etl.js — szkielet importera danych o polskich firmach z oficjalnych rejestrów.
 * Próbka pod zlecenie Useme 144095 (SaaS z bazami firm: CEIDG / KRS / GUS REGON).
 *
 * Co robi naprawdę (nie mock):
 *   - pobiera odpis aktualny z API KRS Ministerstwa Sprawiedliwości (bez klucza),
 *   - pobiera status VAT i dane adresowe z Wykazu Podatników VAT (biała lista, API MF, bez klucza),
 *   - normalizuje oba źródła do jednego rekordu firmy,
 *   - liczy hash rekordu → wykrywanie zmian między przebiegami (podstawa subskrypcji "nowe/zmienione firmy"),
 *   - respektuje limity: kolejka z opóźnieniem i ponowieniami z backoffem.
 *
 * Użycie:
 *   node rejestry-etl.js krs 0000006865 0000121038
 *   node rejestry-etl.js nip 5260250274
 *   node rejestry-etl.js demo            # zestaw pokazowy, zapisuje rejestry-probka.json
 *
 * Uwaga o źródłach: KRS i biała lista mają otwarte API. CEIDG (API v3) i GUS BIR wymagają
 * darmowego klucza zamawianego na wniosek — w docelowym systemie wchodzą tym samym interfejsem
 * (funkcja zrodlo() zwraca rekord w tym samym kształcie), dlatego są tu opisane, a nie udawane.
 */

'use strict';

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const OPOZNIENIE_MS = 350;   // odstęp między requestami — nie dobijamy rejestru
const PROBY = 3;             // ponowienia przy 5xx / timeout
const TIMEOUT_MS = 20000;

/* ---------------------------------------------------------------- HTTP */

function pobierz(url, proba = 1) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'rejestry-etl/1.0' } }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 500 && proba < PROBY) {
          return setTimeout(
            () => pobierz(url, proba + 1).then(resolve, reject),
            OPOZNIENIE_MS * Math.pow(2, proba)
          );
        }
        try {
          resolve({ status: res.statusCode, json: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: res.statusCode, json: null, surowe: buf.slice(0, 300) });
        }
      });
    });
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      if (proba < PROBY) pobierz(url, proba + 1).then(resolve, reject);
      else reject(new Error('timeout: ' + url));
    });
    req.on('error', e => (proba < PROBY ? pobierz(url, proba + 1).then(resolve, reject) : reject(e)));
  });
}

const spij = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------- ŹRÓDŁA */

async function zKrs(numerKrs, rejestr = 'P') {
  const url = `https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${numerKrs}?rejestr=${rejestr}&format=json`;
  const { status, json } = await pobierz(url);
  if (status !== 200 || !json || !json.odpis) return null;

  const o = json.odpis;
  const d = o.dane || {};
  const dzial1 = d.dzial1 || {};
  const podmiot = dzial1.danePodmiotu || {};
  const siedziba = (dzial1.siedzibaIAdres || {});
  const adres = siedziba.adres || {};
  const pkd = ((d.dzial3 || {}).przedmiotDzialalnosci || {});

  return {
    zrodlo: 'KRS',
    krs: (o.naglowekA || {}).numerKRS || numerKrs,
    nazwa: podmiot.nazwa || null,
    forma_prawna: podmiot.formaPrawna || null,
    nip: (podmiot.identyfikatory || {}).nip || null,
    regon: (podmiot.identyfikatory || {}).regon || null,
    adres: {
      ulica: [adres.ulica, adres.nrDomu].filter(Boolean).join(' ') || null,
      miejscowosc: adres.miejscowosc || null,
      kod: adres.kodPocztowy || null,
      kraj: adres.kraj || 'PL'
    },
    pkd_glowne: (pkd.przedmiotPrzewazajacejDzialalnosci || [])[0] || null,
    data_rejestracji: (o.naglowekA || {}).dataRejestracjiWKRS || null,
    stan_z_dnia: (o.naglowekA || {}).stanZDnia || null
  };
}

async function zBialejListy(nip, data = new Date().toISOString().slice(0, 10)) {
  const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${data}`;
  const { status, json } = await pobierz(url);
  if (status !== 200 || !json || !json.result || !json.result.subject) return null;

  const s = json.result.subject;
  return {
    zrodlo: 'MF-wykaz-VAT',
    nazwa: s.name || null,
    nip: s.nip || nip,
    regon: s.regon || null,
    krs: s.krs || null,
    status_vat: s.statusVat || null,
    adres_dzialalnosci: s.workingAddress || s.residenceAddress || null,
    rachunki: (s.accountNumbers || []).length,
    data_rejestracji_vat: s.registrationLegalDate || null
  };
}

/* --------------------------------------------------------- NORMALIZACJA */

function scal(krs, wl) {
  const rekord = {
    nazwa: (krs && krs.nazwa) || (wl && wl.nazwa) || null,
    nip: (krs && krs.nip) || (wl && wl.nip) || null,
    regon: (krs && krs.regon) || (wl && wl.regon) || null,
    krs: (krs && krs.krs) || (wl && wl.krs) || null,
    forma_prawna: krs ? krs.forma_prawna : null,
    adres: krs ? krs.adres : null,
    adres_tekst: wl ? wl.adres_dzialalnosci : null,
    pkd_glowne: krs ? krs.pkd_glowne : null,
    status_vat: wl ? wl.status_vat : null,
    data_rejestracji: krs ? krs.data_rejestracji : null,
    zrodla: [krs && 'KRS', wl && 'MF-wykaz-VAT'].filter(Boolean),
    pobrano: new Date().toISOString()
  };
  rekord.hash = hashRekordu(rekord);
  return rekord;
}

/** Hash liczony po polach merytorycznych — zmiana hasha = firma do paczki „zmienione”. */
function hashRekordu(r) {
  const istotne = {
    nazwa: r.nazwa, nip: r.nip, regon: r.regon, krs: r.krs,
    forma: r.forma_prawna, adres: r.adres, pkd: r.pkd_glowne, vat: r.status_vat
  };
  return crypto.createHash('sha1').update(JSON.stringify(istotne)).digest('hex').slice(0, 12);
}

/** Porównanie z poprzednim przebiegiem: co nowe, co zmienione, co bez zmian. */
function roznica(poprzednie, biezace) {
  const mapa = new Map(poprzednie.map(r => [r.nip || r.krs, r.hash]));
  const nowe = [], zmienione = [], bezZmian = [];
  for (const r of biezace) {
    const klucz = r.nip || r.krs;
    if (!mapa.has(klucz)) nowe.push(r);
    else if (mapa.get(klucz) !== r.hash) zmienione.push(r);
    else bezZmian.push(r);
  }
  return { nowe, zmienione, bezZmian };
}

/* ------------------------------------------------------------- PRZEBIEG */

async function firmaPoKrs(numerKrs) {
  const krs = await zKrs(numerKrs);
  await spij(OPOZNIENIE_MS);
  const wl = krs && krs.nip ? await zBialejListy(krs.nip) : null;
  return scal(krs, wl);
}

async function firmaPoNip(nip) {
  const wl = await zBialejListy(nip);
  await spij(OPOZNIENIE_MS);
  const krs = wl && wl.krs ? await zKrs(wl.krs) : null;
  return scal(krs, wl);
}

async function main() {
  const [tryb, ...arg] = process.argv.slice(2);

  if (tryb === 'krs') {
    for (const k of arg) console.log(JSON.stringify(await firmaPoKrs(k), null, 2));
    return;
  }
  if (tryb === 'nip') {
    for (const n of arg) console.log(JSON.stringify(await firmaPoNip(n), null, 2));
    return;
  }
  if (tryb === 'demo') {
    const zrodlaDemo = [
      { typ: 'krs', id: '0000006865' },   // wejście po numerze KRS: KRS -> NIP -> biała lista
      { typ: 'nip', id: '5260250274' },   // wejście po NIP: biała lista -> ewentualny KRS
      { typ: 'nip', id: '5261040828' }
    ];
    const wynik = [];
    for (const z of zrodlaDemo) {
      const r = z.typ === 'krs' ? await firmaPoKrs(z.id) : await firmaPoNip(z.id);
      if (r.nazwa) wynik.push(r);
      await spij(OPOZNIENIE_MS);
    }
    const d = roznica([], wynik);
    const raport = {
      wygenerowano: new Date().toISOString(),
      pobranych: wynik.length,
      nowych: d.nowe.length,
      zmienionych: d.zmienione.length,
      rekordy: wynik
    };
    fs.writeFileSync('rejestry-probka.json', JSON.stringify(raport, null, 2));
    console.log(JSON.stringify(raport, null, 2));
    return;
  }

  console.log('użycie: node rejestry-etl.js [krs <nr...> | nip <nr...> | demo]');
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { zKrs, zBialejListy, scal, hashRekordu, roznica, firmaPoKrs, firmaPoNip };
