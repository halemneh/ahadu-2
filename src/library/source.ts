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

# አንድ ዕቃ በስብስቡ ውስጥ የመጀመሪያ ቦታውን ይመልሳል። ከሌለ ምንም ይመልሳል።
#   ፈልግ(["ሀ"፣ "ለ"]፣ "ለ")  ->  1
#   ፈልግ(["ሀ"]፣ "ዘ")        ->  ምንም
#
# ምንም የሚመልሰው -1 ስለማይሆን ነው፦ በአሃዱ -1 የመጨረሻው ቦታ ነው (§6.5)፤
# "አልተገኘም" ለማለት መጠቀም አደገኛ ነው።
ተግባር ፈልግ(ዝርዝር፣ የሚፈለገው)፦
    ቦታ = 0
    ቦታ < ርዝመት(ዝርዝር) እስከሆነ ድረስ፦
        ዝርዝር[ቦታ] == የሚፈለገው ከሆነ፦
            ተመላሽ ቦታ
        ቦታ = ቦታ + 1
    ተመላሽ ምንም

# ትልቁን ዕቃ ይመልሳል።
#   ከፍተኛው([3፣ 9፣ 4])  ->  9
ተግባር ከፍተኛው(ዝርዝር)፦
    ጫፍ = ዝርዝር[0]
    ዝርዝር ለእያንዳንዱ ዕቃ፦
        ዕቃ > ጫፍ ከሆነ፦
            ጫፍ = ዕቃ
    ተመላሽ ጫፍ

# ትንሹን ዕቃ ይመልሳል።
#   ዝቅተኛው([3፣ 9፣ 4])  ->  3
ተግባር ዝቅተኛው(ዝርዝር)፦
    ጫፍ = ዝርዝር[0]
    ዝርዝር ለእያንዳንዱ ዕቃ፦
        ዕቃ < ጫፍ ከሆነ፦
            ጫፍ = ዕቃ
    ተመላሽ ጫፍ

# ስብስቡን በቦታው ይደረድራል — አዲስ ስብስብ አይሰራም።
# እንደ አዋህድና ሰርዝ ትዕዛዝ ነው፤ ስለዚህ ምንም ይመልሳል (§4.5)።
# ቅጂ_አድርግ ፈልገህ ከሆነ፦ ተደርድሯል = ቅጂ_አድርግ(ዝ)  ከዚያ  ደርድር(ተደርድሯል)
ተግባር ደርድር(ዝርዝር)፦
    ብዛት = ርዝመት(ዝርዝር)
    ዙር = 0
    ዙር < ብዛት እስከሆነ ድረስ፦
        ቦታ = 0
        ቦታ < ብዛት - ዙር - 1 እስከሆነ ድረስ፦
            ዝርዝር[ቦታ] > ዝርዝር[ቦታ + 1] ከሆነ፦
                ጊዜያዊ = ዝርዝር[ቦታ]
                ዝርዝር[ቦታ] = ዝርዝር[ቦታ + 1]
                ዝርዝር[ቦታ + 1] = ጊዜያዊ
            ቦታ = ቦታ + 1
        ዙር = ዙር + 1

# ስብስቡን በቦታው ይገለብጣል። ትዕዛዝ ነው፤ ምንም ይመልሳል።
ተግባር ገልብጥ(ዝርዝር)፦
    ግራ = 0
    ቀኝ = ርዝመት(ዝርዝር) - 1
    ግራ < ቀኝ እስከሆነ ድረስ፦
        ጊዜያዊ = ዝርዝር[ግራ]
        ዝርዝር[ግራ] = ዝርዝር[ቀኝ]
        ዝርዝር[ቀኝ] = ጊዜያዊ
        ግራ = ግራ + 1
        ቀኝ = ቀኝ - 1

# ---------------------------------------------------------------------------
# መዝገብ — ቁልፍና ዋጋ
# ---------------------------------------------------------------------------

# አሃዱ የቁልፍ-ዋጋ አይነት የለውም። መዝገብ ሁለት ስብስብ ይዞ ያንን ይሰራል።
#
#   ዕድሜ = መዝገብ()
#   ዕድሜ.አስገባ("አበበ"፣ 22)
#   ጻፍ(ዕድሜ.አግኝ("አበበ"))      ->  22
#   ጻፍ(ዕድሜ.አለው("ከበደ"))      ->  ሃሰት
#
# የዘዴ ስሞች ስም (noun) ሊሆኑ ይችላሉ — ዘዴ በአለም አቀፍ ስፋት ውስጥ አይደለም፤
# ስለዚህ ተለዋጭ አይሸፍነውም (§8.2)።
ክላስ መዝገብ፦
    ቁልፎች = []
    ዋጋዎች = []

    ተግባር አስገባ(ቁልፍ፣ ዋጋ)፦
        ቦታ = ፈልግ(ቁልፎች፣ ቁልፍ)
        ቦታ == ምንም ከሆነ፦
            ጨምር(ቁልፎች፣ ቁልፍ)
            ጨምር(ዋጋዎች፣ ዋጋ)
        አለበለዚያ፦
            ዋጋዎች[ቦታ] = ዋጋ

    ተግባር አግኝ(ቁልፍ)፦
        ቦታ = ፈልግ(ቁልፎች፣ ቁልፍ)
        ቦታ == ምንም ከሆነ፦
            ተመላሽ ምንም
        ተመላሽ ዋጋዎች[ቦታ]

    ተግባር አለው(ቁልፍ)፦
        ተመላሽ ፈልግ(ቁልፎች፣ ቁልፍ) != ምንም

    ተግባር አውጣ(ቁልፍ)፦
        ቦታ = ፈልግ(ቁልፎች፣ ቁልፍ)
        ቦታ != ምንም ከሆነ፦
            ሰርዝ(ቁልፎች፣ ቦታ)
            ሰርዝ(ዋጋዎች፣ ቦታ)

    ተግባር ብዛት()፦
        ተመላሽ ርዝመት(ቁልፎች)

    ተግባር ቁልፎቹ()፦
        ተመላሽ ቅጂ_አድርግ(ቁልፎች)
`;

/**
 * Every global the prelude defines, in source order.
 *
 * Declared rather than discovered so that the library has a stated surface —
 * and checked against what the prelude actually defines by a test, so the
 * statement cannot go stale.
 */
export const LIBRARY_NAMES: readonly string[] = [
  'ደምር',
  'ቁጠር',
  'ፈልግ',
  'ከፍተኛው',
  'ዝቅተኛው',
  'ደርድር',
  'ገልብጥ',
  'መዝገብ',
];
