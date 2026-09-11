/**
 * Losowanie nazwy użytkownika dla formularza rejestracji.
 *
 * Człony są bezpolskoznakowe celowo: nazwa trafia do adresu profilu
 * (/u/[username]), a "Szczupak_Łowca" po zakodowaniu wygląda w pasku jak
 * "Szczupak_%C5%81owca". Sam wędkarski słownik zamiast losowych znaków, bo
 * podpowiedź ma zachęcać do zostawienia jej, a nie do poprawiania.
 */

const ADJECTIVES = [
  "Cichy", "Nocny", "Szybki", "Stary", "Dziki", "Zimny", "Sprytny",
  "Cierpliwy", "Poranny", "Mglisty", "Srebrny", "Zloty", "Wytrwaly",
];

const NOUNS = [
  "Szczupak", "Sum", "Karp", "Okon", "Sandacz", "Lin", "Klen", "Bolen",
  "Pstrag", "Wegorz", "Leszcz", "Amur", "Jaz", "Brzana",
];

const GEAR = [
  "Spinning", "Splawik", "Wobler", "Zaneta", "Kolowrotek", "Podbierak",
  "Blystka", "Feeder", "Muchowka", "Zylka",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Trzy wzory zamiast jednego, żeby kolejne kliknięcia w kostkę nie wyglądały
 * na wariacje tej samej nazwy.
 */
export function randomUsername(): string {
  const number = Math.floor(Math.random() * 900) + 100;

  switch (Math.floor(Math.random() * 3)) {
    case 0:
      return `${pick(ADJECTIVES)}${pick(NOUNS)}${number}`;
    case 1:
      return `${pick(NOUNS)}_${pick(GEAR)}`;
    default:
      return `${pick(NOUNS)}${number}`;
  }
}

/** Ten sam zestaw znaków, którego pilnuje walidacja przy rejestracji. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export const USERNAME_HINT =
  "3-20 znaków: litery, cyfry i podkreślnik (bez polskich znaków i spacji)";
