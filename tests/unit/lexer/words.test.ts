/** Identifiers, keywords, the የ prefix, the two-word while keyword (§3.1–3.3, §3.8). */

import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { codes, lex, shape, types, values } from '../../helpers/lex.js';

const ZWSP = '​';
const SOFT_HYPHEN = '­';

describe('identifiers', () => {
  it.each([
    ['ሰላም', 'Ethiopic syllables'],
    ['counter', 'ASCII letters'],
    ['ቆጣሪ_2', 'mixed with underscore and digit'],
    ['_private', 'leading underscore'],
    ['ስም_ስብስብ', 'underscore between syllables'],
    ['ሰላምWorld', 'Ethiopic and ASCII together'],
  ])('accepts %s (%s)', (name) => {
    expect(values(name)).toEqual([name]);
    expect(codes(name)).toEqual([]);
  });

  it('spans the whole name', () => {
    expect(shape('ቆጣሪ')).toEqual(['IDENTIFIER:ቆጣሪ@1:1-3']);
  });

  it('is compared by exact code points, with no spelling folding (§3.1)', () => {
    // ሃና and ኃና are two different variables, unlike keyword variants.
    const names = values('ሃና ኃና');
    expect(names[0]).not.toBe(names[1]);
  });

  it('accepts the Ethiopic Extended block', () => {
    expect(types('ⲁⶀ')).toEqual(['IDENTIFIER']);
  });

  it('stops at Ethiopic punctuation (§3.1)', () => {
    expect(types('ሀ፣ለ')).toEqual(['IDENTIFIER', 'COMMA', 'IDENTIFIER']);
  });
});

describe('invisible characters inside names (§2.1)', () => {
  it('drops a zero-width space and keeps the name whole', () => {
    expect(values(`ሰ${ZWSP}ላም`)).toEqual(['ሰላም']);
  });

  it('drops a soft hyphen', () => {
    expect(values(`ሰ${SOFT_HYPHEN}ላም`)).toEqual(['ሰላም']);
  });

  it('does not let one consume a column', () => {
    expect(shape(`ሰ${ZWSP}ላም`)).toEqual(['IDENTIFIER:ሰላም@1:1-3']);
  });

  it('still recognizes a keyword written with one inside it', () => {
    expect(lex(`ከ${ZWSP}ሆነ`)).toEqual([
      { type: 'KEYWORD', value: 'IF', line: 1, startCol: 1, endCol: 3 },
    ]);
  });
});

describe('keywords', () => {
  it.each([
    ['ከሆነ', 'IF'],
    ['ከሖነ', 'IF'],
    ['ከኆነ', 'IF'],
    ['ግን', 'ELIF'],
    ['አለበለዚያ', 'ELSE'],
    ['ዐለበለዚያ', 'ELSE'],
    ['ተመላሽ', 'RETURN'],
    ['ተግባር', 'FUNC'],
    ['ክላስ', 'CLASS'],
    ['ፍጠር', 'INIT'],
    ['እና', 'AND'],
    ['ዕና', 'AND'],
    ['ወይም', 'OR'],
    ['ተቃርኖ', 'NOT'],
    ['እውነት', 'TRUE'],
    ['ዕውነት', 'TRUE'],
    ['ሃሰት', 'FALSE'],
    ['ሐሠት', 'FALSE'],
    ['ምንም', 'NOTHING'],
    ['ቁጥር', 'TYPE_NUM'],
    ['እውነታ', 'TYPE_BOOL'],
    ['ጽሁፍ', 'TYPE_STRING'],
    ['ፅሁፍ', 'TYPE_STRING'],
    ['ስብስብ', 'TYPE_LIST'],
  ])('%s is KEYWORD:%s', (word, sub) => {
    expect(values(word)).toEqual([sub]);
    expect(types(word)).toEqual(['KEYWORD']);
  });

  it('matches whole words only, so ከሆነነገር is one identifier (§3.2)', () => {
    expect(lex('ከሆነነገር')).toEqual([
      { type: 'IDENTIFIER', value: 'ከሆነነገር', line: 1, startCol: 1, endCol: 6 },
    ]);
  });

  it('matches whole words at the start too', () => {
    expect(types('ነገርከሆነ')).toEqual(['IDENTIFIER']);
  });

  it('lexes reserved words as keywords for the parser to reject (§3.2)', () => {
    expect(values('አዲስ ለእያንዳንዱ አቁም ቀጥል ፊደል')).toEqual([
      'RESERVED_NEW',
      'RESERVED_FOR',
      'RESERVED_BREAK',
      'RESERVED_CONTINUE',
      'RESERVED_CHAR',
    ]);
  });

  it('leaves ለ free as an identifier', () => {
    // Reserving a single ubiquitous syllable for a future `for` would cost
    // the most natural short variable name in Amharic.
    expect(types('ለ = 1')).toEqual(['IDENTIFIER', 'ASSIGN', 'NUMBER']);
  });
});

describe('the possessive የ prefix (§3.3, CHANGES C23)', () => {
  it('keeps the prefix attached and records the stem', () => {
    // v1-py emitted OF then አበበ, which made የ-prefixed names unusable.
    expect(lex('የአበበ')).toEqual([
      {
        type: 'IDENTIFIER',
        value: 'የአበበ',
        line: 1,
        startCol: 1,
        endCol: 4,
        hasOfPrefix: true,
        stem: 'አበበ',
      },
    ]);
  });

  it('lets an ordinary name begin with የ', () => {
    const { tokens } = tokenize('የኔስም = 1');
    expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'የኔስም', stem: 'ኔስም' });
  });

  it('leaves the possessive reading to the parser', () => {
    expect(types('የአበበ ዕድሜ = 22')).toEqual(['IDENTIFIER', 'IDENTIFIER', 'ASSIGN', 'NUMBER']);
  });

  it('does not set the flag on a name without the prefix', () => {
    expect(tokenize('አበበ').tokens[0]?.hasOfPrefix).toBeUndefined();
  });

  it('reports a bare የ as an illegal character', () => {
    expect(codes('የ = 1')).toEqual(['AH1001']);
  });

  it('does not match the stem against the keyword table', () => {
    // የከሆነ is a name, not the possessive of a keyword.
    expect(types('የከሆነ')).toEqual(['IDENTIFIER']);
  });
});

describe('the two-word while keyword (§3.8, CHANGES C11)', () => {
  it('is one token spanning both words and the space', () => {
    expect(lex('እስከሆነ ድረስ')).toEqual([
      { type: 'KEYWORD', value: 'WHILE', line: 1, startCol: 1, endCol: 9 },
    ]);
  });

  it.each(['እስከሆነ', 'እስከሖነ', 'እስከኆነ', 'ዕስከሆነ', 'ዕስከሖነ', 'ዕስከኆነ'])(
    'accepts the %s spelling',
    (head) => {
      expect(values(`${head} ድረስ`)).toEqual(['WHILE']);
      expect(codes(`${head} ድረስ`)).toEqual([]);
    },
  );

  it('reports AH1004 when ድረስ is missing, and still emits the keyword', () => {
    const { tokens, diagnostics } = tokenize('ቆጣሪ < 5 እስከሆነ፦');
    expect(diagnostics.map((d) => d.code)).toEqual(['AH1004']);
    expect(tokens.map((t) => t.value)).toContain('WHILE');
  });

  it('is not demoted to an identifier, as v1-ts did', () => {
    expect(types('እስከሆነ')).toEqual(['KEYWORD']);
    expect(values('እስከሆነ')).toEqual(['WHILE']);
  });

  it('permits exactly one space', () => {
    expect(codes('እስከሆነ  ድረስ')).toEqual(['AH1004']);
  });

  it('requires the tail to be a whole word', () => {
    expect(codes('እስከሆነ ድረስነገር')).toEqual(['AH1004']);
  });

  it('leaves ድረስ on its own as an ordinary identifier', () => {
    expect(types('ድረስ')).toEqual(['IDENTIFIER']);
  });

  it('reports the error on the head word only', () => {
    const { diagnostics } = tokenize('እስከሆነ');
    expect(diagnostics[0]).toMatchObject({ line: 1, startCol: 1, endCol: 5 });
  });
});
