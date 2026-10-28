# Textverktyget

Textverktyget hjälper dig att bearbeta texter utan att behöva prompta själv. Du
lägger in en text, väljer en uppgift och får en bearbetad text från en
AI-modell. I grunden finns promptar som vem som är avsändare, hur klarspråk ska
skrivas samt processer som kvalitetsgranskning.

I adminpanelen kan du anpassa skrivregler, avsändare, uppgifter, målgrupper och
ordlista. Grundinställningarna utgår från Region Stockholm som avsändare. Det
är enkelt att anpassa verktyget för sin verksamhets behov.

## Innehåll

- [Promptar](#promptar)
- [Så fungerar verktyget](#så-fungerar-verktyget)
- [Innan du börjar](#innan-du-börjar)
- [Kom igång på din dator](#kom-igång-på-din-dator)
- [Bearbeta din första text](#bearbeta-din-första-text)
- [Starta och stoppa](#starta-och-stoppa)
- [Kör på en server](#kör-på-en-server)
- [Gör verktyget tillgängligt för andra](#gör-verktyget-tillgängligt-för-andra)
- [Uppdatera och säkerhetskopiera](#uppdatera-och-säkerhetskopiera)
- [Om något inte fungerar](#om-något-inte-fungerar)
- [Mer information och kontakt](#mer-information-och-kontakt)

## Promptar

Promptarna går att läsa i sin helhet i [documentation/textverktyget-readable-prompts.md](https://github.com/regionstockholm/textverktyget/blob/main/documentation/textverktyget-readable-prompts.md).

## Så fungerar verktyget

1. Du lägger in din text eller bifogar ett dokument.
2. Välj en uppgift och, om uppgiften har det valet, en målgrupp.
3. AI-modellen bearbetar texten och kontrollerar sedan om den bearbetade texten
   är tillräckligt bra utifrån givna instruktioner.
4. Du granskar texten och kan bearbeta den vidare, eller skicka iväg igen till
   en AI-modell för bearbetning.

Du kan själv välja vilken AI-modell du vill använda, även lokala modeller. Grundkonfigurationen
använder Google Gemini 2.5 Flash. Vald modell kan ändras i adminpanelen.

## Innan du börjar

- **Text kan skickas till en extern AI-tjänst.** Lokal installation betyder
  inte att AI-bearbetningen sker på din dator. Använd inte känsliga texter innan
  du har bedömt AI-tjänsten, lagringen och verksamhetens krav på
  informationssäkerhet.
- **Textloggning är alltid aktiv.** Text som skickas för bearbetning sparas i
  databasen och i dagliga loggfiler. Lagringstiden är minst 30 dagar, även
  lokalt. Läs [om lagring i
  wikin](https://github.com/regionstockholm/textverktyget/wiki/Datamodell-och-lagring).
- **API-användning kan kosta pengar.** Ett abonnemang på en chattjänst omfattar
  inte nödvändigtvis dess API. Kontrollera leverantörens priser och kvoter.

## Kom igång på din dator

För att köra textverktyget lokalt på din dator behöver du programmet **Docker**
och tillgång till en AI-tjänst (API-nyckel). Docker bygger en _image_ av
textverktyget, vilket enkelt uttryckt är att allt sparas i en fil som körs. Tar
man bort paketet försvinner hela textverktyget.

### 1. Installera Docker

Hämta [Docker Desktop](https://docs.docker.com/desktop/) för ditt
operativsystem. Följ installationsguiden och starta programmet. Du behöver inte
registrera eller skapa ett konto för att använda Docker.

I Windows kan Docker behöva WSL 2 (Windows Subsystem for Linux). Följ i så fall
[Microsofts
installationsguide](https://learn.microsoft.com/sv-se/windows/wsl/install) och
starta om datorn när installationen begär det.

### 2. Hämta Textverktyget

1. På denna Github-sida, klicka på **Code** uppe till höger och sedan
   **Download ZIP**. Du behöver inte ha ett Github-konto för att ladda ned
   verktyget.
2. Packa upp ZIP-filen i en vanlig lokal mapp (om Windows, högerklicka och välj
   "Extrahera").
3. Öppna den uppackade mappen som innehåller `docker-compose.yml` och `dotenv`.
   Det är projektmappen som resten av guiden hänvisar till.

### 3. Skaffa en API-nyckel

Olika AI-tjänster har olika processer för att skapa eller använda en
API-nyckel. Grundinställningen i textverktyget använder Google Gemini, och du
kan skapa en API-nyckel via [Google AI
Studio](https://aistudio.google.com/apikey). En API-nyckel är en hemlig kod som
låter verktyget använda tjänsten för ditt konto eller projekt. **Dela aldrig ut
en API-nyckel till andra**.

Du kan även använda lokala AI-modeller om du har tillgång till en sådan. Läs
mer på [AI-konfiguration i
wikin](https://github.com/regionstockholm/textverktyget/wiki/Konfiguration,-miljö-och-runtime).

### 4. Öppna en terminal i projektmappen

En terminal är ett program där du skriver kommandon. Kör kommandona ett i taget
och tryck Enter efter varje kommando.

- **Windows:** öppna projektmappen i Utforskaren, skriv `powershell` i
  adressfältet längst upp och tryck Enter.
- **macOS:** öppna Terminal. Skriv `cd ` (inklusive mellanslag), dra
  projektmappen från Finder till terminalfönstret och tryck Enter.
- **Linux:** om du använder Linux vet du nog hur man gör.

Kontrollera att Docker och Compose fungerar:

```sh
docker compose version
docker info
```

Det första kommandot visar Docker Compose-versionen. Det andra ska visa
information om Docker-servern utan anslutningsfel.

### 5. Skapa inställningsfilen

Skapa en kopia av filen `dotenv` och döp kopian till `.env`. Har du redan en `.env`. Filen ska heta exakt `.env`,
inte `.env.txt` eller liknande. Filen kan vara dold i filhanteraren.

Enklast är att i terminalen skriva nedan kommando för att göra en kopia:

```sh
cp dotenv .env
```

`cp` står för copy, och kommandot gör en kopia av filen `dotenv` till en ny fil
som heter `.env`.

Öppna filen `.env` i en vanlig textredigerare. I Windows kan du skriva `notepad
.env` i adressfältet i Utforskaren. På macOS ska redigeraren spara ren text,
inte formaterad text.

#### 5.1 Lägg in API-nycklar

I din `.env` finns en sektion där det står `GEMINI_API_KEY`, `OPENAI_API_KEY`
etcetera. Här lägger du in din API-nyckel för den AI-tjänst som du vill
använda. Du kan lägga in flera API-nycklar om du har det, för att välja mellan
olika modeller i administratörsläget.

#### 5.2 Lägg in hemliga användarnycklar

För att hålla din session med textverktyget säker behöver du lägga in
slumpmässiga hemliga nycklar. Ersätt beskrivningarna nedan efter likhetstecknet
med egna värden:

```dotenv
ADMIN_API_KEY=en_egen_slumpmässig_hemlighet
CONFIG_MASTER_KEY=en_annan_slumpmässig_hemlighet
POSTGRES_PASSWORD=ett_slumpmässigt_databaslösenord
SESSION_SECRET=en_separat_slumpmässig_hemlighet_minst_32_tecken
```

`ADMIN_API_KEY` är lösenordet för att komma åt administratörsläget. Du kan
välja ett eget lösenord om du vill det, så länge du endast kör textverktyget
lokalt på din dator med `LOCAL_DEV=true`. Med `LOCAL_DEV=false` krävs minst
32 tecken. Använd en slumpmässigt skapad nyckel för en delad installation.

För att skapa slumpmässiga nycklar kan du exempelvis använda [Online Random
string generator](https://pinetools.com/random-string-generator) för att skapa
slumpmässiga strängar med text. Kryssa ur "Use symbols" och sätt "Length of
each string" till 64.

#### 5.3 Övriga inställningar

Ändra inte dessa värden för lokal använding:

```dotenv
LOCAL_DEV=true
APP_PORT=3000
USER_LOGIN_ENABLED=false
CLOUDFLARE_ENABLED=false
```

`LOCAL_DEV` styr lösenordskraven, inte hur appen startas. Appen körs alltid i Docker.

Låt `DATABASE_URL` vara tom när du använder medföljande Compose-fil. Compose
skapar rätt anslutning till databasen. Spara filen och förvara adminnyckeln
säkert. Dela aldrig filen `.env` med någon annan.

### 6. Bygg och starta

Se först till att programmet Docker är igång på din dator. I terminalen, när du
är inne i projektmappen, skriv nedan kommando:

```sh
docker compose up -d --build
```

Docker bygger appens image och startar appen. Första starten kan ta flera
minuter.

När allt är klart, kontrollera appens status:

```sh
docker compose ps
```

Vänta tills appen visar `healthy`. Visas `starting`, vänta en stund och kör
statuskommandot igen. Vid `unhealthy` eller upprepade omstarter, se loggarna
enligt felsökningen nedan.

Öppna sedan en webbläsare och skriv in nedan adress i adressfältet:

- Textverktyget: [http://localhost:3000](http://localhost:3000)
- Adminpanelen: [http://localhost:3000/admin-ui](http://localhost:3000/admin-ui)

`localhost` betyder din egen dator. Logga in i adminpanelen med det värde du
skrev in för `ADMIN_API_KEY`.

## Innan du använder textverktyget

Logga in i adminpanelen via
[http://localhost:3000/admin-ui](http://localhost:3000/admin-ui). Till vänster
under rubriken "AI-system", klicka på "AI-konfiguration".

I rullistan "AI-provider" väljer du vilken leverantör av AI-tjänst du vill
använda, beroende på vilken API-nyckel du har lagt in i `.env`-filen.

När du valt provider, välj vilken AI-modell du vill använda i listan under
rubriken "AI-provider och modell". Notera att olika modeller har olika
kostnader.

## Bearbeta din första text

1. Öppna verktyget genom adressen: [http://localhost:3000](http://localhost:3000)
2. Välj en uppgift, exempelvis att sammanfatta en text till tre punkter.
3. Klistra in en kort testtext utan känsliga uppgifter.
4. Klicka på bearbeta och invänta att bearbetningen slutförts.

Du kan också bifoga filer, exempelvis PDF och Docx. Notera att textverktyget
inte kan läsa text som är i bild, exempelvis inscannade dokument.

För att justera avsändare, målgrupper, uppgifter med mera, läs [admin-guiden](https://github.com/regionstockholm/textverktyget/wiki/Admin-guide).

## Starta och stoppa

Du kan låta textverktyget låta stå i bakgrunden på din dator även om du inte
använder verktyget. Om du startar om datorn eller stänger ned den behöver du
starta om textverktyget med Docker. Du kan använda nedan kommandon i
projektmappen:

| Det du vill göra                   | Kommando                                    |
| ---------------------------------- | ------------------------------------------- |
| Starta igen                        | `docker compose up -d`                   |
| Stoppa                             | `docker compose down`                       |
| Se status                          | `docker compose ps`                         |
| Visa appens senaste loggar         | `docker compose logs --tail=100 app`        |
| Läs in ändringar i appens `.env`   | `docker compose up -d --force-recreate app` |
| Stäng ned och radera textverktyget | `docker compose down -v`                    |

Vanligt stopp och ombyggnad behåller alla sparade inställningar och användare.
**Använd inte `docker compose down -v` för felsökning. Det raderar bland annat
databas, konton, inställningar och textloggfiler.**

### Textloggar och valfri kopia i projektmappen

Inskickade texter sparas både i databasen (för CSV-export i adminpanelen) och
som dagliga `ÅÅÅÅ-MM-DD.jsonl` i Docker-volymen `textverktyg_logs`, monterad på
`/app/logs`. Varje rad innehåller `username`, `time_utc` och `text`.
Drift- och felloggar visas separat med `docker compose logs app`.

Starta med `sh scripts/docker-up.sh` för att även använda en **befintlig**
`./logs` som extra fillogg. Skriptet bygger imagen och kontrollerar sedan med
containerns användare att mappen går att läsa, skriva och söka i. Om kontrollen
lyckas används `docker-compose.host-logs.yml` för att montera den på
`/app/host-logs`. Annars startar appen med enbart ordinarie lagring och skriver
ut varför extrakopian inte aktiverades. Skriptet skapar inte värdmappen och
ändrar inte dess behörigheter.

Startskriptet kräver `sh` (Linux/macOS eller WSL). De befintliga Windows-bat-
skripten använder fortsatt enbart ordinarie lagring.

På en Linux-server med vanlig Docker (utan rootless-läge eller UID-remappning)
kan du ge din vanliga användare läsåtkomst via en separat grupp. Kör från
projektmappen som din vanliga VPS-användare, inte från ett root-skal:

```sh
sudo groupadd --system textlogs
sudo usermod -aG textlogs "$(id -un)"
sudo mkdir -p logs
sudo chown 1001:textlogs logs
sudo chmod 2750 logs
```

Skapa inte gruppen igen om den redan finns. Logga ut och in så att
gruppmedlemskapet aktiveras, och kör sedan `sh scripts/docker-up.sh`.

Appen kör som UID/GID `1001:1001` och äger mappen. `2750` låter appen skriva
och gallra filer, medan gruppen kan lista och läsa dem. Setgid-biten (`2`)
gör att nya filer ärver gruppen `textlogs`. Nya värdkopior skapas med `640`
(gruppläsning), medan primärloggarna i Docker-volymen behåller `600`.
En restriktiv process-umask kan begränsa behörigheterna ytterligare.

Befintliga filer ändras inte automatiskt. För att även kunna läsa gamla
JSONL-värdkopior, kör:

```sh
sudo find logs -maxdepth 1 -type f -name '*.jsonl' \
  -exec chown 1001:textlogs {} + \
  -exec chmod 640 {} +
```

Du kan därefter följa dagens logg utan sudo med
`tail -f "logs/$(date -u +%F).jsonl"` efter första inskickade texten.
Gruppen får inte ändra loggarna. Använd inte `chmod 777`.
För rootless Docker eller UID-remappning måste värdens mappade UID kontrolleras
först; använd inte `chown 1001` utan den kontrollen. Docker Desktop hanterar
bind-mount-behörigheter annorlunda; startskriptets kontroll avgör åtkomsten.

Extrakopian får endast **nya** loggrader, inte historik från Docker-volymen.
Båda filloggarna gallras vid start och varje timme enligt samma lagringstid:
30 dagar som standard, med möjlighet att ändra i adminpanelen eller via
`SUBMISSION_LOG_RETENTION_DAYS`. Fel i extrakopian varnas om i driftloggen men
stoppar inte inskickningar eller ordinarie loggning. Behandla filerna som
känsliga uppgifter: de innehåller inskickade texter och användarnamn.

Kör startskriptet igen för att kontrollera en tillagd mapp eller ändrade
behörigheter. En automatisk containeromstart gör ingen ny kontroll på
värddatorn. Vanlig `docker compose up -d` aktiverar inte extrakopian.

## Kör på en server

1. Installera [Docker Engine med Compose](https://docs.docker.com/engine/install/)
   på servern.
2. Hämta projektet och skapa `.env` enligt stegen ovan.
3. Sätt `LOCAL_DEV=false`. Adminnyckeln måste vara minst 32 tecken. Behåll eller
   skapa starka, separata hemligheter.
4. Välj en ledig port på servern, exempelvis:

   ```dotenv
   APP_PORT=8080
   ```

5. Kör `sh scripts/docker-up.sh` och kontrollera `docker compose ps`.

Appen nås nu på `http://127.0.0.1:8080` **från servern själv**.
Kontrolladressen är `http://127.0.0.1:8080/health`.

Compose kopplar serverns valda port till port `3000` i app-containern.
Ändra därför `APP_PORT`, inte `PORT`. Databasen nås bara inom Docker-nätverket.
Du behöver inte installera PostgreSQL separat eller öppna dess port.

Medföljande Compose-fil bygger imagen lokalt. Guiden förutsätter inte att det
finns en färdig Textverktyget-image att hämta från ett publikt register.

### Gör verktyget tillgängligt för andra

Porten är som standard bunden till `127.0.0.1`. Ett portbyte gör alltså inte
verktyget tillgängligt från andra datorer. Exponera inte appens HTTP-port direkt
mot internet som en genväg.

- **Cloudflare Tunnel:** en separat anslutning på servern kan publicera appen
  på en HTTPS-adress utan en inkommande öppen app-port. Sätt också
  `CLOUDFLARE_ENABLED=true` i appens `.env` och återskapa app-containern.
  Medföljande Compose-fil startar ingen tunnelanslutning.
- **Annan HTTPS-proxy eller driftplattform:** kan användas efter anpassning
  och granskning av proxyförtroende, cookies, klient-IP och åtkomstskydd.
  Det finns ingen färdig konfiguration för alla sådana miljöer.
- **Adminsessioner:** sätt alltid `SESSION_SECRET` till en separat slumpmässig
  hemlighet på minst 32 tecken, även utan användarkonton. Adminnyckeln anges
  endast i `.env` som `ADMIN_API_KEY`; användarkonton ger aldrig adminbehörighet.
  Adminsessioner lagras i PostgreSQL, gäller högst en timme och förstörs vid
  utloggning. Byte av adminnyckel ogiltigförklarar befintlig adminbehörighet.
  Admin och användare delar sessionscookie: inloggning eller utloggning i det
  ena flödet avslutar också sessionen i det andra. Efter denna uppdatering
  måste administratörer logga in igen. Återskapa app-containern efter ändringar.
- **Med eller utan användarkonton:** `USER_LOGIN_ENABLED=true` kräver inloggning.
  Med `USER_LOGIN_ENABLED=false` kan alla som når tjänsten använda den och
  förbruka AI-kvot.
  Ett användarkonto ger inte tillgång till adminpanelen.

Se [serverguiden i wikin](https://github.com/regionstockholm/textverktyget/wiki/Drift-och-driftsättning)
för inställningar, tunnel, säkerhetskopiering och krav inför publik drift.
Kör tills vidare en appinstans per installation.

## Uppdatera och säkerhetskopiera

Ta en säkerhetskopia före uppdatering. **Backup** i adminpanelen sparar
konfigurationen, inte hela installationen. Konton har en separat backup.
För full återställning behöver du även databasen, loggfilerna, `.env` och
eventuella egna modellprofiler.

Hämta den nya koden. Bevara `.env`, egna filer och samma Compose-projektnamn så
att rätt datavolymer används. Bygg och starta sedan:

```sh
docker compose up -d --build
```

Databasmigrationer körs automatiskt. En omstart med `docker compose restart`
läser inte in ändrade miljövariabler. Byt inte databaslösenord eller
krypteringsnyckel genom att bara skriva över dem i `.env`.

Vid stopp väntar appen upp till två minuter på pågående förfrågningar. Därefter
avbryts de. Saknas delar av en befintlig konfiguration stoppas starten i stället
för att ersätta sparade inställningar med standardvärden; återställ från backup.

Se [säkerhetskopiering och återställning](https://github.com/regionstockholm/textverktyget/wiki/Drift-och-driftsättning)
innan du flyttar eller uppgraderar en installation med viktiga data.

## Om något inte fungerar

- **Docker hittas inte:** installera Docker och öppna terminalen på nytt.
- **Docker kan inte ansluta:** kontrollera att Docker Desktop eller serverns
  Docker-tjänst är igång.
- **Inställningsfil saknas:** kontrollera att `.env` finns bredvid
  `docker-compose.yml` och inte heter `.env.txt`.
- **Porten används redan:** välj en annan `APP_PORT`, kör
  `docker compose up -d` och öppna den nya adressen.
- **Sidan öppnas inte:** kör `docker compose ps` och
  `docker compose logs --tail=100 app`.
- **AI-anrop misslyckas:** kontrollera nyckel, betalning, kvot och modellåtkomst.
  Använd **Testa anslutning och modell** i adminpanelen.

Fler säkra kontroller finns i [Felsökning](https://github.com/regionstockholm/textverktyget/wiki/Felsökning).
Ta bort hemligheter och känslig text innan du delar loggar.

## Bygga och testa ändringar

Node, pnpm och byggverktyg körs inne i Docker. Installera dem inte på värddatorn.
Bygg och kör hela testsviten, inklusive databas- och återställningstester, med:

```sh
docker compose -p textverktyget-tests -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p textverktyget-tests -f docker-compose.test.yml down
```

Testdatabasen är separat, saknar publicerad port och ligger i tillfälligt minne.
Testerna läser inte installationens `.env` eller använder dess datavolymer.
Använd inte teststacken mot en databas med riktiga data.

## Mer information och kontakt

- [Wikins startsida](https://github.com/regionstockholm/textverktyget/wiki)
- [Admin-guide](https://github.com/regionstockholm/textverktyget/wiki/Admin-guide)
- [Konfiguration och lokala AI-modeller](https://github.com/regionstockholm/textverktyget/wiki/Konfiguration,-miljö-och-runtime)
- [Säkerhet](https://github.com/regionstockholm/textverktyget/wiki/Säkerhet)
- [API-referens](https://github.com/regionstockholm/textverktyget/wiki/API-referens)
- [Begränsningar och utvecklingsområden](https://github.com/regionstockholm/textverktyget/wiki/Kända-begränsningar-och-roadmap)

Förslag och utvecklingsfrågor: <marcus.g.pettersson@regionstockholm.se>.
Projektet utvecklas löpande. Support och granskning av bidrag kan inte garanteras.
