# Textverktyget

Textverktyget är ett webbverktyg för att bearbeta texter med fördefinerade
promptar. I grunden finns det alltid en klarspråksprompt och avsändarprompt som
kombineras med uppgifter. Det ingår även ett användargränssnitt för att göra
ändringar i verktyget.

## Features

- Ett Google Translate men för klarspråk (och andra textuppgifter).
- Slipp prompta själv och ha din avsändare och ditt sätt att uttrycka dig i en funktion.
- Möjlighet att bearbeta dokument och stora texter (upp till 200 tusen tecken).
- Enkelt användargränssnitt, både för slutanvändaren och admin.

## Hoppa till sektion

[Hur det funkar](#hur-det-funkar)

[Var vi står i dag](#var-vi-står-i-dag)

[Quick-start](#quick-start)

[Förberedelser](#förberedelser)

[Installera verktyget](#installera-verktyget)

[Starta textverktyget](#starta-textverktyget)

[Installera om allting ifall något går sönder](#installera-om-allting-ifall-något-går-sönder)

[Vad är på gång](vad-är-på-gång)

[Textverktyget wiki](https://github.com/regionstockholm/textverktyget/wiki)

## Hur det funkar

Verktyget använder sig av Google Gemini 2.5 Flash API för att bearbeta texter.
Målet är inte att ersätta klarspråksskrivande, utan hjälpa till att göra
processen snabbare och underlätta att göra andra repetitiva uppgifter.

### Funktioner

- Klarspråksprompt i grunden i alla textbearbetningar.
- Bryter ned texten och lägger det viktigaste i texten först för vald målgrupp.
- Kvalitetsgranskning av texten med self-healing innan texten presenteras.
- Målgruppsanpassning: skapa egna målgrupper och lyft fram vad som är viktigt
  för målgruppen.
- Bygg egna uppgifter anpassade för era behov.
- Inget behov att skriva egna promptar: lägg in en text, få tillbaka en
  bearbetad text.
- Webscraper som kan plocka ut textdelar från webbsida (just nu endast för
  [regionstockholm.se](https://www.regionstockholm.se)).
- Få ut texten anpassad för Word och hur den formaterar text (exempelvis
  korrekta radbrytningar för en text omskriven till lättläst svenska).

### På gång

- Förbättring av klarspråkspromptar för bättre resultat.
- Förbättring av omskriving av text till lättläst.
- Justeringar av användargränsnittet i adminläget.
- Få hjälp av GenAI att skriva promptar (adminläget).

## Var vi står i dag

Just nu kan vi inte garantera hur det fungerar på en dedikerad server, utan
rekommenderar att köra verktyget lokalt på sin egen dator. Vi arbetar löpande
för att skapa en färdig version för att kunna installera på exempelvis Azure
miljö.

### Support och utveckling

Vi kan inte erbjuda någon form av support mer än vad som står i denna
guide. Vi tar dock gärna emot feedback och förslag.

Utveckling sker löpande och vi kommer uppdatera nedan med vad som är på gång
och vad som är nytt. Just nu kan vi inte heller ta emot contributors till denna
repo då det inte finns tid eller möjlighet för personen som utvecklar
textverktyget att sköta det på heltid.

## Quick-start

- Skapa en Google Gemini API-nyckel.
- Installera Docker om det inte är installerat.
- Ladda hem och packa upp textverktyget.
- Byt namn på `dotenv` till `.env` och lägg till in din API-nyckel.
- Bygg och kör verktyget med Docker: `docker compose up -d --build`
- Öppna `localhost:3000` i webbläsaren för verktyget, eller
  `localhost:3000/admin-ui` för admin-läge.

## Förberedelser

### Skapa API-nyckel för Google Gemini

För att kunna använda verktyget behövs en API-nyckel för Google Gemini. Det kan
ta upp till 24 timmar innan en ny API-nyckel börjar fungera, speciellt för
användare som inte skapat en API-nyckel tidigare.

[Instruktioner för att skapa en API-nyckel](https://youtu.be/Uyn-P2nRvDA)

### Installera Docker

Om du inte vet vad Docker är eller har det installerat sedan tidigare
rekommenderas att hämta desktop-versionen från den officiella webbsidan:

[Docker för Windows-datorer](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe)

[Docker för Mac (nyare)](https://desktop.docker.com/mac/main/arm64/Docker.dmg)

[Docker för Mac (äldre)](https://desktop.docker.com/mac/main/amd64/Docker.dmg)

#### Docker i Windows

Du behöver inte skapa något konto utan kan skippa de stegen.
Om du använder Windows behöver du även installera WSL (Windows Subsystem for
Linux) som är en officiell release från Microsoft.

I katalogen `windows-bat` finns en fil som heter `install-wsl.bat`. Kör den som
administratör (högerklicka först) för att installera WSL.

[Mer information om WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

## Installera verktyget

Om du inte är van med Git eller Github, klicka på knappen `Code` och sedan på
`Download ZIP` för att hämta hem en lokal kopia av verktyget.

<details>
<summary>Installera i Windows</summary>

## Installera i Windows

1. Packa upp filen på direkt på lokala disk, exempelvis under `C:\Textverktyg`
   (detta för att det kan bli problem för Docker att köras om det ligger på en
   plats som backupas av en server).
2. Se till att Docker är installerat och igång i bakgrunden.
3. Döp om filen `dotenv` till `.env`.
4. Öppna `.env` med exempelvis Anteckningar (högerklicka och öppna).
5. Ersätt texten `[gemini_api_key]` samt
   `[gemini_api_key-for-quality-evaluation]` med din API-nyckel för Google
   Gemini.
6. Spara filen.
7. Skapa en genväg av filerna `start-docker.bat` samt `stop-docker.bat` i katalogen `windows-bat` och lägg på skrivbordet.

</details>

<details>
<summary>Installera på Mac</summary>

## Installera på Mac

1. Packa upp filen i din hemkatalog.
2. Se till att Docker är installerat och igång i bakgrunden.
3. Döp om filen `dotenv` till `.env`.
4. Öppna `.env` i en textredigerare.
5. Ersätt texten `[gemini_api_key]` samt
   `[gemini_api_key-for-quality-evaluation]` med din API-nyckel för Google
   Gemini.
6. Spara filen.

</details>

## Starta textverktyget

För att starta textverktyget behöver du använda Docker för att köra dem i en
container. Det är inte svårt men annorlunda första gången. Se till att docker
är igång i bakgrunden först (att programmet är startat).

<details>
<summary>Starta i Windows</summary>

### Starta i Windows

1. Rekommenderat är att du använder genvägarna `start-docker.bat` samt
   `stop-docker.bat` för att starta och stänga ned textverkyget.
2. Om inte genvägarna fungerar behöver du starta verktyget med terminalen,
   exempelvis `PowerShell`. Klicka på startmenyn och sök fram `PowerShell` för
   att starta det.
3. Öppna katalogen där du packade upp textverktyget. Om du packade upp det på
   `C:\textverktyget\` så öppnar du katalogen med kommandot:
   `cd c:\textverktyget` och sen Enter.
   I korta drag betyder det `change directory -> c:\textverktyget.`
4. När du är i rätt katalog så startar du verktyget med:
   ```text
   docker compose up -d --build
   ```
5. Efter installationen (om allt gått som det ska) startar du verktyget i
   webbläsaren på adress:
   ```text
   localhost:3000
   ```
6. För administratörsläget öppnar du nedan adress:
   ```text
   localhost:3000/admin-ui
   ```
7. Lösenordet för admin-läget är satt till:
   ```text
   admin
   ```

</details>

<details>
<summary>Starta på Mac</summary>

### Starta på Mac

1. Öppna terminalen (exempelvis genom att söka fram den med <kbd>⌘ + Space</kbd>).
2. Leta fram katalogen där du packade upp textverktyget. Om du packade upp det
   under hemkatalogen och `textverktyget\` så öppnar du katalogen med
   kommandot: `cd textverktyget` och sen Enter.
   I korta drag betyder det `change directory -> textverktyget`.
3. När du är i rätt katalog så startar du verktyget med:
   `docker compose up -d --build` vilket betyder att docker ska bygga och
   starta verktyget.
4. Efter installationen (om allt gått som det ska) startar du verktyget i
   webbläsaren på adress: `localhost:3000`

</details>

<details>
<summary>Efter första körningen</summary>

### Efter första körningen

Om du startar om datorn eller stänger Docker kan du behöva starta om textverktyget. Använd nedan kommando i katalogen där textverktyget finns:

```text
docker compose up -d
```

Detta gör att verktyget startar igen.

För att stänga ned verktyget kan du använda:

```text
docker compose down
```

</details>

### Admin-läget

1. Öppna adminläget via webbläsare:

```text
http://localhost:3000/admin-ui
```

2. I fältet högst upp skriver du in `admin` som lösenord, sedan klickar du på
   `Hämta`.
3. Rekommenderat är att hämta en backup av allting direkt via Backup-fliken.
   Det finns även en standard-config i katalogen `config` i textverktygets
   katalog.

## Installera om allting ifall något går sönder

Om av någon anledning allt går sönder går det att installera om allting med
nedan kommando:

```text
docker compose down -v && docker compose build --no-cache && docker compose up -d
```

Det som händer är att Docker-imagen stängs ned och raderas, sedan byggs den om
från grunden. Det är endast i nödfall man behöver göra detta.

## Förslag och utveckling

Förslag och utvecklingsfrågor kan skickas till <marcus.g.pettersson@regionstockholm.se>

## Vad är på gång

- Förbättra klarspråksgrunden.
- Förbättra bearbetning till lättläst.
- Få hjälp av GenAI att skapa promptar.
- Underlätta att använda webscraper för egen webb.
- Dubbelkolla säkerhet och eventuella läckor.
- Förbättra UI och UX i adminpanelen.
- Mer kontroll över vilka dokument som kan laddas upp samt hur stora.
