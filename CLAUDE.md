# Fourthcoming

Gra logiczna w przeglądarce, osadzona w świecie 4D. Plansza wisi w chmurach i jest widoczna
w rzucie izometrycznym. Gracz widzi zawsze tylko trójwymiarowy przekrój świata, a jego główną
zdolnością jest obrót wymiaru: zamiana jednej z osi planszy z czwartą osią (W). Dzięki temu może
obejść przeszkody, które w 3D wydają się nie do pokonania.

> Status: **prototyp / proof of concept**. Cel na teraz to jeden poziom, który pokazuje,
> że mechanika działa, jest czytelna i ładnie wygląda.

---

## 1. Filar gry

- **Jedna zasada, mało przycisków.** Gracz chodzi po kratkach i obraca planszę lub wymiar.
  Nie ma walki, zręcznościówki ani presji czasu.
- **Moment „aha".** Każda zagadka ma wyglądać na niemożliwą w 3D i stawać się oczywista,
  gdy gracz „pomyśli w bok".
- **Przytulna estetyka.** Miękkie światło, nasycone kolory, zaokrąglone klocki, diorama
  zawieszona w niebycie wśród chmur (inspiracja nastrojem: Besiege). Ma być ślicznie, nie surowo.
- **Oryginalność.** Nie kopiujemy poziomów, postaci ani oprawy żadnej istniejącej gry 4D.
  Bierzemy tylko ogólną ideę (przekroje 4D, zamiana osi).

## 2. Model świata

- Świat to **siatka 4D** komórek. Plansza ma trzy osie poziome `x`, `z`, `w`, a oś `y`
  służy tylko do wysokości obiektów (ściany są wysokie, podłoga płaska).
- **Postać porusza się tylko w dwóch wymiarach**, czyli po dwóch poziomych osiach, które
  są aktualnie widoczne. Nie ma skakania ani ruchu w pionie.
- **Ruch po kratkach:** jeden klawisz to jedna komórka, z krótką animacją podskoku.
- Każda komórka ma typ: `empty` (niebyt), `floor`, `wall`, `goal`
  (na później: `key`, `door`, `box`…).
- Nie można wejść na ścianę ani zejść z planszy w niebyt. Próba kończy się animacją „odbicia".

### Widok

- **Plansza jako kwadrat w rzucie izometrycznym**, zawieszony w chmurach. Krawędzie planszy
  są wyraźnie widoczne, żeby było jasne, gdzie świat się kończy.
- Kamera ortograficzna, izometryczna, bez swobodnego obracania myszą.
- Widoczny przekrój to zawsze `y` + dwie osie poziome. Domyślnie `x` i `z` przy stałym `w`
  równym pozycji gracza.
- **Duchy sąsiednich przekrojów są widoczne od początku.** Komórki z przekrojów `w ± 1`
  (lub odpowiednio ukrytej osi) są rysowane jako półprzezroczyste, lekko przesunięte
  „echa" planszy. Gracz od razu widzi, że obok istnieje coś jeszcze.

### Dwa rodzaje obrotu

1. **Obrót planszy (lewo/prawo):** zwykły obrót o 90° wokół osi pionowej. Zmienia tylko
   kąt patrzenia, nie zmienia świata. Pomaga obejrzeć planszę i ustawić, która oś jest
   „z przodu".
2. **Obrót wymiaru:** oś planszy, która aktualnie biegnie w stronę wskazaną przez kamerę
   (np. oś skierowana w prawo-dół ekranu), zamienia się z osią `w`. Ta oś zostaje zamrożona
   na pozycji gracza, a w jej miejscu pojawia się `w`. Animacja (ok. 0,6 s) to płynny obrót
   klocków w płaszczyźnie z udziałem W: komórki, które wypadają z przekroju, rozpuszczają się,
   a nowe się materializują. Duchy płynnie zamieniają się w pełne klocki i odwrotnie.

Połączenie obu obrotów pozwala wybrać, którą z dwóch widocznych osi zamieniamy z `w`,
bez potrzeby osobnych klawiszy dla każdej osi.

Obrót wymiaru nie przesuwa gracza w 4D, więc nigdy nie może go wstawić w ścianę.
Kierunek obrotu (+90° / −90°) jest dobierany tak, żeby widoczna oś była zawsze dodatnia:
przekrój nigdy nie wygląda na lustrzane odbicie, a dwukrotne naciśnięcie wraca do
poprzedniego widoku.

Duchy mają dwa kolory: błękitny dla przekroju „+1” na ukrytej osi i różowy dla „−1”.

### Sterowanie (propozycja)

| Klawisz / przycisk | Akcja |
|---|---|
| `WASD` / strzałki | krok o jedną kratkę (kierunki względem ekranu) |
| `Q` / `E` | obrót planszy o 90° w lewo / w prawo |
| `Spacja` | obrót wymiaru (zamiana osi „z przodu” z `w`) |
| `R` | restart poziomu |
| przyciski na ekranie | te same akcje dla myszy i ekranów dotykowych |

W rogu ekranu wskaźnik pokazuje, które osie są widoczne (np. `X · Z` albo `W · Z`)
oraz wartość osi ukrytej.

## 3. Poziom 1: „Nieskończony mur"

**Pytanie dla gracza:** jak przejść na drugą stronę muru, który nie ma końca?

### Układ (rozmiar planszy: x 7 × z 7 × w 3)

- **Przekrój `w = 0` (start):** kwadratowa plansza 7×7. Przez całą jej szerokość, od krawędzi
  do krawędzi, biegnie mur (`x = 3`, wszystkie `z`), za wysoki, żeby cokolwiek za nim było
  łatwo dostępne. Po obu stronach muru plansza kończy się niebytem, więc nie da się go obejść.
  Gracz stoi po bliższej kamerze stronie (`x = 5`), a cel świeci po drugiej (`x = 1`).
  Wysoki promień światła nad celem widać ponad murem, ale nie da się do niego dojść.
- **Przekrój `w = 1`:** ta sama plansza, **ale bez muru**, za to z drzewami. Duchy drzew
  widać już w `w = 0` i podpowiadają, że „obok” istnieje inny świat.
- **Przekrój `w = 2`:** mur jest, ale niższy i dziurawy. To ozdobnik, który pokazuje,
  że świat ciągnie się dalej.

### Rozwiązanie

1. Gracz naciska `Spacja` (oś `x` jest domyślnie „z przodu”). Oś `x` zamienia się z `w`.
   Muru nie widać w ogóle, bo gracz stoi w przekroju `x = 5`. Plansza ma teraz trzy pasy
   w różnych odcieniach: `w = 0`, `1` i `2`.
2. Krok w bok, do `w = 1`.
3. `Spacja` i powrót do widoku `X · Z`, ale już w przekroju `w = 1`. Muru nie ma.
4. Gracz przechodzi przez linię, w której w `w = 0` stoi mur.
5. `Spacja`, krok z powrotem do `w = 0`, `Spacja`. Jest po drugiej stronie muru, przy celu.

### Czego ten poziom ma dowieść

- Że obrót wymiaru jest zrozumiały bez tekstu (najwyżej jedna podpowiedź przy pierwszym
  uruchomieniu).
- Że duchy sąsiednich przekrojów same naprowadzają na rozwiązanie.
- Że animacja obrotu nie dezorientuje.
- Że scena wygląda ładnie już w prototypie.

## 4. Oprawa wizualna

- **Plansza:** gruby kwadratowy blok ziemi zawieszony w niebycie. Na górze trawa lub
  kremowe płytki, po bokach widać warstwy gruntu, czyli jak wyspa wyjęta z ziemi.
- **Tło:** niebo w gradiencie, puszyste chmury poniżej i wokół planszy, powoli dryfujące.
- **Klocki:** zaokrąglone sześciany (`RoundedBoxGeometry`) rysowane jako `InstancedMesh`.
- **Paleta:** ciepła, pastelowo-nasycona. Podłoga trawiasta lub kremowa, mur terakota,
  cel turkusowy ze świeceniem. Każdy przekrój `w` ma subtelnie inny odcień, żeby było
  wiadomo, „gdzie w W” się jest.
- **Duchy:** półprzezroczyste, chłodniejsze w tonie, bez cieni.
- **Światło:** ciepłe słońce z miękkimi cieniami + `HemisphereLight` + mapa otoczenia HDRI
  (Poly Haven, CC0).
- **Postprocessing:** N8AO (ambient occlusion), delikatny bloom, SMAA, tone mapping AgX.
- **Gracz:** prosta, sympatyczna postać (np. kulka z oczkami), która podskakuje przy ruchu.

## 5. Technologia

- **Three.js** (renderer WebGL, nie WebGPU) + **TypeScript** + **Vite**.
- Postprocessing: biblioteka `postprocessing` (pmndrs) + `n8ao`.
- Testy logiki 4D (ruch, kolizje, obroty, przekroje): **Vitest**.
- Hosting: **GitHub Pages**, deploy przez GitHub Actions (`vite build` → `dist/`).
  `base` w `vite.config.ts` musi pasować do nazwy repozytorium.

### Proponowana struktura

```
src/
  world/      # siatka 4D, typy komórek, przekroje (czysta logika, bez Three.js)
  game/       # stan gracza, ruch, obroty, warunek wygranej
  render/     # scena Three.js, instancje klocków, duchy, animacje, chmury, postprocessing
  ui/         # wskaźnik osi, przyciski, podpowiedzi, ekran wygranej
  levels/     # poziomy jako dane (TS/JSON)
tests/        # Vitest dla world/ i game/
```

Zasada: **logika gry nie importuje Three.js**. Renderer tylko czyta stan i go rysuje.
Dzięki temu logikę 4D da się testować bez przeglądarki.

### Uwaga o kamerze izometrycznej

Wysoki obiekt zasłania wszystko, co jest za nim (dalej od kamery). Start gracza musi być
po bliższej stronie przeszkód, a ważne rzeczy za nimi muszą mieć coś wysokiego (np. promień
światła nad celem).

## 6. Jak pracujemy (dla Claude)

- Po każdej zmianie wizualnej: uruchomić dev server (`npm run dev`, port 5173), otworzyć
  grę w panelu przeglądarki, zrobić zrzut ekranu i sprawdzić konsolę pod kątem błędów.
  W konsoli przeglądarki dostępne są `game`, `view` i `stage` do debugowania.
- Po każdej zmianie w `world/` lub `game/`: `npm test`.
- Nie dodawać dużych zależności bez pytania.
- Komentarze i nazwy w kodzie po angielsku, rozmowa po polsku.

## 7. Otwarte pytania (do decyzji)

- Teraz „z przodu” jest oś biegnąca w prawo-dół ekranu (↘). Czy to jest czytelne,
  czy lepsze byłyby dwa osobne klawisze?
- Postać gracza i motyw świata: abstrakcyjny, bajkowy, mechaniczny?
- Czy Ana i Kata mają być bohaterami (np. dwie postacie w różnych przekrojach `w`)?
