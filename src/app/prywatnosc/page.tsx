import type { Metadata } from "next";
import { page, heading, meta } from "@/lib/ui";
import LegalDocument, { Section } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Prywatność i cookies — Wędkarski Portal",
  description:
    "Jakie dane zbiera Wędkarski Portal, po co, i jakich plików cookie używa.",
};

export default function PrivacyPage() {
  return (
    <div className={page}>
      <h1 className={heading}>Polityka prywatności i cookies</h1>
      <p className={`${meta} mt-1`}>Obowiązuje od 11 września 2026 r.</p>

      <LegalDocument>
        <Section title="1. Kto jest administratorem danych">
          <p>
            Administratorem danych jest właściciel serwisu Wędkarski Portal.
            W sprawach dotyczących danych osobowych — dostępu, poprawienia,
            usunięcia, sprzeciwu — napisz na adres kontaktowy podany w serwisie.
          </p>
          <p>
            <strong>
              Przed uruchomieniem serwisu publicznie uzupełnij tu nazwę podmiotu
              i adres email kontaktowy — RODO wymaga danych administratora.
            </strong>
          </p>
        </Section>

        <Section title="2. Jakie dane zbieramy">
          <ul>
            <li>
              <strong>Przy rejestracji:</strong> imię, nazwisko, nazwa
              użytkownika, data urodzenia, płeć i adres email.
            </li>
            <li>
              <strong>Z korzystania z serwisu:</strong> miejscówki wraz ze
              współrzędnymi, zgłoszone połowy, zdjęcia, wpisy, komentarze,
              polubienia, znajomości i członkostwo w grupach.
            </li>
            <li>
              <strong>Technicznie:</strong> adres IP i informacje o przeglądarce
              w logach serwera, standardowo dla każdej usługi internetowej.
            </li>
          </ul>
          <p>
            Lokalizację pobieramy z urządzenia wyłącznie wtedy, gdy sam użyjesz
            przycisku lokalizowania na mapie, i tylko po Twojej zgodzie
            w przeglądarce.
          </p>
        </Section>

        <Section title="3. Po co i na jakiej podstawie">
          <ul>
            <li>
              <strong>Prowadzenie konta i świadczenie usługi</strong> — podstawą
              jest umowa, czyli akceptacja regulaminu (art. 6 ust. 1 lit. b RODO).
            </li>
            <li>
              <strong>Bezpieczeństwo serwisu</strong>, w tym przeciwdziałanie
              nadużyciom — nasz prawnie uzasadniony interes (art. 6 ust. 1 lit.
              f RODO).
            </li>
            <li>
              <strong>Płeć i data urodzenia</strong> — dobrowolne; służą
              dopasowaniu treści i weryfikacji minimalnego wieku. Możesz podać
              &bdquo;Wolę nie podawać&rdquo;.
            </li>
          </ul>
        </Section>

        <Section title="4. Co widzą inni użytkownicy">
          <p>
            Publicznie widoczna jest <strong>nazwa użytkownika</strong>, zdjęcie
            profilowe i okładka, a także te treści, które sam opublikujesz.
          </p>
          <p>
            <strong>Imię, nazwisko, data urodzenia, płeć i adres email nie są
            pokazywane innym użytkownikom.</strong>
          </p>
          <p>
            Miejscówki mają własne ustawienie widoczności — prywatna, dla
            znajomych albo publiczna — i domyślnie są prywatne. Połowy bez
            przypisanej miejscówki są prywatne.
          </p>
        </Section>

        <Section title="5. Komu powierzamy dane">
          <ul>
            <li>
              <strong>Supabase</strong> — hosting bazy danych, uwierzytelnianie
              i przechowywanie zdjęć.
            </li>
            <li>
              <strong>Vercel</strong> — hosting aplikacji.
            </li>
            <li>
              <strong>Open-Meteo</strong> i <strong>IMGW</strong> — dane
              pogodowe i hydrologiczne. Wysyłamy im wyłącznie współrzędne, bez
              informacji o tym, kto pyta.
            </li>
            <li>
              <strong>OpenStreetMap</strong> — kafelki mapy. Ich serwery widzą
              adres IP przeglądarki, tak jak przy każdym obrazku z innej domeny.
            </li>
          </ul>
          <p>Nie sprzedajemy danych i nie przekazujemy ich reklamodawcom.</p>
        </Section>

        <Section title="6. Jak długo przechowujemy dane">
          <p>
            Dane konta przechowujemy tak długo, jak istnieje konto. Po jego
            usunięciu kasujemy treści powiązane z kontem. Logi techniczne
            przechowujemy do 12 miesięcy.
          </p>
        </Section>

        <Section title="7. Twoje prawa">
          <p>
            Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia,
            ograniczenia przetwarzania, przenoszenia oraz sprzeciwu wobec
            przetwarzania opartego na prawnie uzasadnionym interesie. Możesz też
            złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych.
          </p>
        </Section>

        <Section title="8. Pliki cookie">
          <p>
            Nie używamy plików cookie do śledzenia, profilowania ani reklam.
            Nie korzystamy z Google Analytics ani podobnych narzędzi.
          </p>
          <p>Serwis zapisuje w przeglądarce wyłącznie:</p>
          <ul>
            <li>
              <strong>Cookie sesji logowania</strong> (Supabase Auth) — trzyma
              informację o tym, że jesteś zalogowany. Bez niego logowanie nie
              działa, dlatego jest niezbędne i nie wymaga zgody.
            </li>
            <li>
              <strong>Ustawienie motywu</strong> (jasny/ciemny) — zapisywane
              w pamięci przeglądarki, nie wysyłane na serwer.
            </li>
            <li>
              <strong>Informacja o zamknięciu komunikatu o cookies</strong> —
              żeby nie pokazywał się przy każdym wejściu.
            </li>
          </ul>
          <p>
            Ponieważ używamy wyłącznie plików niezbędnych do działania serwisu,
            nie pytamy o zgodę na cookies — informujemy o nich. Możesz je usunąć
            w ustawieniach przeglądarki, ale wtedy nastąpi wylogowanie.
          </p>
        </Section>

        <Section title="9. Zmiany polityki">
          <p>
            O istotnych zmianach poinformujemy w serwisie albo mailem. Data
            obowiązywania na górze strony zawsze wskazuje aktualną wersję.
          </p>
        </Section>
      </LegalDocument>
    </div>
  );
}
