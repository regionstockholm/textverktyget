-- Rename the task and update its prompt, only if the prompt still has the old placeholder text.
CREATE TEMP TABLE kb_prompt AS
SELECT p.id, p.name, p.version
FROM prompt_templates p
JOIN task_definitions t ON p.name = 'task:' || t.task_key
WHERE t.label = 'Skriv bilaga' AND p.is_active AND p.content LIKE '%(tidsangivelse)%';

UPDATE prompt_templates SET is_active = false WHERE id IN (SELECT id FROM kb_prompt);

INSERT INTO prompt_templates (name, content, version, is_active, updated_by)
SELECT k.name,
  $kb$Input:
Din uppgift är att skriva om texten till en bilaga till en kallelse för patienter. Texten är skriven av vårdverksamheten och ska bli kort, tydlig och lätt att följa för en patient utan medicinska förkunskaper.

Krav:
- Använd omskrivningsutkastet för att bestämma rubriker och ordning.
- Följ de satta klarspråksreglerna. Skriv med du-tilltal i aktiv form.
- Gör texten ungefär hälften så lång som originalet, men ta aldrig bort något patienten måste göra, undvika eller känna till.
- Börja med en rubrik och 1-2 meningar om vad undersökningen eller behandlingen är och vad som händer. Nämn det medicinska namnet en gång. Använd sedan ett enklare ord.
- Sortera i rubriker utifrån patientens behov, när det finns underlag i texten: Förberedelser, Tillstånd som påverkar undersökningen, Så går det till, Efter undersökningen.
- Sortera alla förberedelser efter tidpunkt innan du skriver. Den som ligger längst före undersökningen kommer först och den som ligger närmast kommer sist, oavsett i vilken ordning originalet nämner dem. Skriv tidpunkten först i varje punkt, till exempel "Klockan 16-18 dagen före undersökningen: ...".
- Använd punktlistor för sådant patienten ska göra, undvika eller kontakta vården om. Låt varje punkt innehålla ett budskap.
- Skriv tillstånd och villkor som gör att patienten ska kontakta vården som en punktlista med en punkt per tillstånd, efter en kort inledande mening. Räkna aldrig upp flera tillstånd i en och samma mening.
- Allt som patienten gör eller som händer på själva undersökningsdagen hör till avsnittet om hur det går till, även att komma tillbaka för att lämna utrustning. Avsnittet om tiden efter undersökningen gäller bara det som händer när patienten har gått hem.
- Börja avsnittet om hur det går till med 1-2 meningar löptext om vad som händer, och använd därefter punktlista för det som gäller under tiden.
- Samla all information om samma ämne på ett ställe, även om den är utspridd i originalet.
- Bevara alla tider, mängder, förbud, namn på läkemedel och villkor exakt. Ändra inga siffror.
- Ta bort bakgrund och detaljer som inte påverkar vad patienten ska göra, till exempel teknikbeskrivningar, material, vad personalen gör efter undersökningen, upprepningar och artighetsfraser.
- Förklara facktermer och läkemedel kort med enkla ord, till exempel "ett laxerande medel som heter Laxabon". Byt ut formella ord mot vardagliga.
- Ge konkreta exempel i stället för allmänna begrepp, när originalet ger underlag, till exempel vilka drycker som räknas som klara drycker.
- Använd samma ord för samma sak genom hela texten.
- Ta inte med telefonnummer, adresser eller webbadresser. Det finns i kallelsen.
- Texten är ett slutgiltigt resultat som ska kunna skickas till patienten som den är. Skriv aldrig platshållare, mallfält eller ord inom parentes som "(tidsangivelse)" och lämna inget att fylla i senare. Skriv ingen rad om hur länge besöket tar, eftersom det inte framgår av originalet. Behåll platshållare som (text) eller [text] bara om de finns i originaltexten. Tider som beskriver hur länge en utrustning, ett prov eller en behandling pågår skriver du i de punkter där de hör hemma.
- Upprepa aldrig samma information. Skriv varje tillstånd eller villkor bara en gång, i avsnittet om tillstånd som påverkar undersökningen, och inte också bland förberedelserna.
- Håll punktlistorna korta. Gör inte punkter av sådant som fungerar som en vanlig mening, och skriv inte punkter som bara byter ut ett ord mot ett annat. Skriv i punktlistor inga extra mellanslag i slutet av raderna.
- Lägg inte till nya sakuppgifter, råd eller tider.
- Om originaltexten är längre än 35000 tecken, korta till högst 35000 tecken.

Response format:
- Rubriker på egen rad.
- Punktlistor där varje punkt börjar med "- " och har en tom rad före nästa punkt.
- Löptext i korta stycken.
- Ingen annan markdown eller specialformatering.$kb$,
  (SELECT max(version) + 1 FROM prompt_templates WHERE name = k.name),
  true,
  'migration'
FROM kb_prompt k;

UPDATE task_definitions SET label = 'Kallelsebilaga' WHERE label = 'Skriv bilaga';

DROP TABLE kb_prompt;
