/**
 * The standard library's source, written in Ahadu (LANGUAGE.md §8.5).
 *
 * Written in Ahadu and not in TypeScript on purpose. A learner who wonders
 * what `ደምር` does can read it, in Amharic, and find a loop they already
 * understand — which is worth more on a teaching site than the speed a host
 * implementation would buy. Anything that *cannot* be written in Ahadu, or
 * that would leak an IEEE-754 artifact if it were, stays a host built-in in
 * `createBuiltins` instead; §8.5 draws that line.
 *
 * It lives in a `.ts` file holding a template literal rather than in a
 * `.ahadu` file because there is then exactly one way to load it. The CLI runs
 * on Node, the playground and the site run through Vite, and the tests run
 * under vitest; a plain string import behaves identically in all three with no
 * build step and nothing to keep in sync. The cost is that an editor does not
 * syntax-highlight it, which the site makes up for by publishing this source
 * as a page.
 *
 * Two constraints on the text below, both from it being a template literal:
 * no backticks and no `${`. Ahadu uses `"` for strings and has no
 * interpolation, so neither has ever come up — but a future addition to the
 * language could make this file need escaping, and that is worth knowing
 * before it happens.
 *
 * Every name defined here is listed in `LIBRARY_NAMES`, and a test fails if
 * the two drift apart.
 */

export const LIBRARY_SOURCE = `# የአሃዱ መደበኛ ቤተ-መጻሕፍት
#
# ይህ ፋይል በአሃዱ ራሱ ተጽፏል። ማንበብ ትችላለህ — ልክ እንደ ራስህ ፕሮግራም ነው።
# በውስጡ ያለው ሁሉ ቀድሞ ተጭኗል፤ ምንም ማስገባት አያስፈልግም።

# ---------------------------------------------------------------------------
# ስብስብ
# ---------------------------------------------------------------------------

# የስብስቡን ቁጥሮች ሁሉ ደምሮ ይመልሳል።
#   ደምር([1፣ 2፣ 3])  ->  6
ተግባር ደምር(ዝርዝር)፦
    ድምሩ = 0
    ዝርዝር ለእያንዳንዱ ዕቃ፦
        ድምሩ = ድምሩ + ዕቃ
    ተመላሽ ድምሩ

# አንድ ዕቃ በስብስቡ ውስጥ ስንት ጊዜ እንዳለ ይቆጥራል።
#   ቁጠር([1፣ 2፣ 1]፣ 1)  ->  2
ተግባር ቁጠር(ዝርዝር፣ የሚፈለገው)፦
    ስንት = 0
    ዝርዝር ለእያንዳንዱ ዕቃ፦
        ዕቃ == የሚፈለገው ከሆነ፦
            ስንት = ስንት + 1
    ተመላሽ ስንት
`;

/**
 * Every global the prelude defines, in source order.
 *
 * Declared rather than discovered so that the library has a stated surface —
 * and checked against what the prelude actually defines by a test, so the
 * statement cannot go stale.
 */
export const LIBRARY_NAMES: readonly string[] = ['ደምር', 'ቁጠር'];
