# Raport weryfikacji migracji

Data: 2026-09-11T01:38:22.427Z  
Klucz dopasowania: `sku`  
Porównywane pola: `nazwa`, `cena`, `stan`, `kategoria`

## Wynik: ROZBIEŻNOŚCI DO WYJAŚNIENIA

| Miara | Wartość |
|---|---|
| Rekordów w źródle | 6 |
| Rekordów w celu | 6 |
| Zgodne w pełni | 3 |
| Różnice w polach | 2 |
| Brakuje w celu | 1 |
| Nadmiarowe w celu | 1 |
| Duplikaty kluczy (źródło / cel) | 0 / 0 |
| Hash zbioru (źródło / cel) | `804f6cc12a7d` / `d05daddb6a0c` |

## Brakuje w celu (1)

| Klucz | Nazwa |
|---|---|
| FL-003 | Wiązanka pogrzebowa |

## Różnice w polach (2)

| Klucz | Pole | Źródło | Cel |
|---|---|---|---|
| FL-002 | cena | 249,00 | 269,00 |
| FL-004 | kategoria | Rośliny | Rosliny |

## Nadmiarowe w celu (1)

- FL-099

---

Raport wygenerowany przez migracja-raport.js (bartekdev_pl). Zasada: migrację uznajemy za odebraną dopiero wtedy, gdy ten raport pokazuje zera w trzech ostatnich wierszach tabeli.
