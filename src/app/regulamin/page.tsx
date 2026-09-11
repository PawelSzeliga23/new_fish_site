import type { Metadata } from "next";
import { page, heading, meta } from "@/lib/ui";
import LegalDocument, { Section } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Regulamin — Wędkarski Portal",
  description: "Zasady korzystania z serwisu Wędkarski Portal.",
};

export default function TermsPage() {
  return (
    <div className={page}>
      <h1 className={heading}>Regulamin serwisu</h1>
      <p className={`${meta} mt-1`}>Obowiązuje od 11 września 2026 r.</p>

      <LegalDocument>
        <Section title="1. Czym jest serwis">
          <p>
            Wędkarski Portal to serwis społecznościowy dla wędkarzy. Pozwala
            oznaczać miejscówki na mapie, rejestrować połowy, sprawdzać warunki
            pogodowe i hydrologiczne oraz dzielić się tym ze znajomymi i grupami.
          </p>
          <p>
            Korzystanie z serwisu jest bezpłatne. Do założenia konta potrzebny
            jest adres email, który należy potwierdzić.
          </p>
        </Section>

        <Section title="2. Kto może założyć konto">
          <p>
            Konto może założyć osoba, która ukończyła 13 lat. Dane podane przy
            rejestracji muszą być prawdziwe. Jedna osoba zakłada jedno konto.
          </p>
        </Section>

        <Section title="3. Treści publikowane przez użytkowników">
          <p>
            Odpowiadasz za to, co publikujesz: wpisy, zdjęcia, nazwy miejscówek
            i komentarze. Publikując zdjęcie oświadczasz, że masz do niego prawa.
          </p>
          <p>Zabronione jest publikowanie treści, które:</p>
          <ul>
            <li>naruszają prawo lub prawa innych osób,</li>
            <li>są obraźliwe, wulgarne albo nawołują do nienawiści,</li>
            <li>są spamem lub niezamówioną reklamą,</li>
            <li>ujawniają cudze dane osobowe bez zgody tych osób.</li>
          </ul>
          <p>
            Zachowujesz prawa do swoich treści. Publikując je w serwisie
            udzielasz nam nieodpłatnej licencji na ich wyświetlanie w serwisie
            w zakresie niezbędnym do jego działania.
          </p>
        </Section>

        <Section title="4. Miejscówki i widoczność">
          <p>
            Każda miejscówka ma ustawienie widoczności: prywatna, dla znajomych
            albo publiczna. Domyślnie miejscówka jest prywatna. Zanim ustawisz
            miejscówkę jako publiczną, rozważ, czy chcesz ujawnić jej dokładne
            położenie.
          </p>
          <p>
            Miejscówkę można dodać wyłącznie w promieniu 50 metrów od zbiornika
            wodnego. Ograniczenie wynika z charakteru serwisu i jest sprawdzane
            automatycznie.
          </p>
        </Section>

        <Section title="5. Przepisy wędkarskie">
          <p>
            Serwis jest narzędziem informacyjnym i <strong>nie zastępuje
            znajomości przepisów</strong>. To Ty odpowiadasz za posiadanie karty
            wędkarskiej i zezwolenia na połów, za przestrzeganie okresów i
            wymiarów ochronnych, limitów połowowych oraz regulaminów łowisk
            i zasad obowiązujących na wodach chronionych.
          </p>
          <p>
            Dane o zbiornikach pochodzą z OpenStreetMap i mogą być niedokładne
            lub nieaktualne. Obecność zbiornika w serwisie nie oznacza, że wolno
            na nim łowić ani że dostęp do niego jest legalny.
          </p>
        </Section>

        <Section title="6. Prognoza brań i dane pogodowe">
          <p>
            Ocena brań to heurystyka oparta na wiedzy wędkarskiej, a nie
            prognoza oparta na pomiarach skuteczności. Dane pogodowe pochodzą
            z Open-Meteo, a hydrologiczne z IMGW. Nie gwarantujemy ich
            dokładności ani dostępności i nie odpowiadamy za decyzje podjęte na
            ich podstawie.
          </p>
          <p>
            Nigdy nie podejmuj decyzji dotyczących bezpieczeństwa — wejścia na
            lód, wypłynięcia na wodę, połowu przy wysokim stanie wody — wyłącznie
            na podstawie danych z serwisu.
          </p>
        </Section>

        <Section title="7. Blokada i usunięcie konta">
          <p>
            Konto możesz usunąć w każdej chwili, kontaktując się z nami. Razem
            z kontem usuwane są Twoje miejscówki, połowy i wpisy.
          </p>
          <p>
            Możemy zablokować konto, które łamie regulamin. O blokadzie
            informujemy mailem wraz z powodem. Od decyzji można się odwołać,
            odpisując na tę wiadomość.
          </p>
        </Section>

        <Section title="8. Dostępność serwisu">
          <p>
            Serwis jest udostępniany w takiej postaci, w jakiej jest. Staramy
            się, żeby działał bez przerw, ale nie gwarantujemy ciągłości
            działania ani tego, że dane nie zostaną utracone. Rób kopie zdjęć,
            na których Ci zależy.
          </p>
        </Section>

        <Section title="9. Zmiany regulaminu">
          <p>
            O zmianach regulaminu poinformujemy z co najmniej 14-dniowym
            wyprzedzeniem, mailem albo komunikatem w serwisie. Dalsze
            korzystanie z serwisu po wejściu zmian w życie oznacza ich
            akceptację. Jeśli się z nimi nie zgadzasz, możesz usunąć konto.
          </p>
        </Section>

        <Section title="10. Kontakt">
          <p>
            W sprawach dotyczących serwisu, konta albo tego regulaminu napisz na
            adres podany w polityce prywatności.
          </p>
        </Section>
      </LegalDocument>
    </div>
  );
}
