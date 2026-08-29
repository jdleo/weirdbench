import {
  evaluateRegexWithPython,
  getRegexGolfPuzzles,
} from "@/lib/regex-golf";

const REFERENCE_REGEXES: Record<string, string> = {
  "Doubled Letters": "(.)\\1",
  "Double O": "oo",
  "Vowel Start": "^[aeiou]",
  "Gerund Tail": "ing$",
  "Even Length": "^(..)*$",
  "Contains Ball": "ball",
  Bookends: "^(.).*\\1$",
  "Q Without U": "q(?!u)",
  Palindrome: "^(.?)(.?)(.)(.?)(.?)\\4\\3\\2\\1$",
  "Digraph TH": "th",
  "Doubled Tail": "(.)\\1$",
  "Double Vowel": "[aeiou]{2}",
  "A Before B Before C": "a.*b.*c",
  "Contains Cat": "cat",
  "tion Tail": "tion$",
  "Digraph PH": "ph",
  "Digraph MP": "mp",
  "Lone Vowel": "^[^aeiou]*[aeiou][^aeiou]*$",
  "Double Z": "zz",
  "Twin E": "^[^e]*e[^e]*e[^e]*$",
  "Multiples of Five": "^\\d*[05]$",
  "Binary Strings": "^[01]+$",
  "IPv4 Octets": "^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)$",
  "Hex Colors": "^#([0-9a-f]{3}|[0-9a-f]{6})$",
  "Roman Numerals": "^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$",
};

async function main() {
  const puzzles = getRegexGolfPuzzles();
  const failures: string[] = [];
  const summary: Array<Record<string, unknown>> = [];

  for (const puzzle of puzzles) {
    const reference = REFERENCE_REGEXES[puzzle.name];

    if (!reference) {
      failures.push(`${puzzle.name}: no reference regex`);
      continue;
    }

    if (
      puzzle.match.length !== 10 ||
      puzzle.reject.length !== 10 ||
      new Set([...puzzle.match, ...puzzle.reject]).size !== 20 ||
      puzzle.match.some((value) => puzzle.reject.includes(value))
    ) {
      failures.push(
        `${puzzle.name}: expected 10+10 distinct disjoint strings, got ${puzzle.match.length}+${puzzle.reject.length}`,
      );
    }

    const outcome = await evaluateRegexWithPython(reference, puzzle);

    if (!outcome.valid || !outcome.matchHits || !outcome.rejectHits) {
      failures.push(
        `${puzzle.name}: reference regex failed to evaluate: ${outcome.error ?? "unknown"}`,
      );
      summary.push({ name: puzzle.name, ok: false });
      continue;
    }

    const missedMatches = outcome.matchHits.filter((hit) => !hit).length;
    const falseRejects = outcome.rejectHits.filter((hit) => hit).length;

    if (missedMatches > 0 || falseRejects > 0) {
      failures.push(
        `${puzzle.name}: reference regex missed ${missedMatches} matches and falsely matched ${falseRejects} rejects`,
      );
    }

    summary.push({
      name: puzzle.name,
      ok: missedMatches === 0 && falseRejects === 0,
      refRegex: reference,
      refScore: reference.length,
      match: puzzle.match,
      reject: puzzle.reject,
    });
  }

  if (puzzles.length !== 25) {
    failures.push(`expected 25 puzzles, found ${puzzles.length}`);
  }

  if (failures.length > 0) {
    console.log(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, puzzles: summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
