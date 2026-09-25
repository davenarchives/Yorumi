import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Structural fingerprint representing the traits of a target DOM element.
 * Inspired by Scrapling's adaptive element fingerprinting algorithm.
 */
export interface ElementFingerprint {
    /** Expected HTML tag of the target element (e.g. 'a', 'div', 'article') */
    tag: string;
    /** Whether the element contains an anchor <a> tag or is itself an anchor */
    hasLink?: boolean;
    /** Whether the element contains an <img> tag */
    hasImage?: boolean;
    /** Expected header tag inside or on the element (e.g. 'h1', 'h2', 'h3') */
    hasHeader?: boolean;
    /** Minimum expected text length */
    minTextLength?: number;
    /** Maximum expected text length */
    maxTextLength?: number;
    /** Keywords commonly present in the text or attributes (e.g. 'chapter', 'author') */
    keywords?: string[];
    /** Regex to test against attribute values such as href or title */
    attributePatterns?: {
        attr: string;
        pattern: RegExp;
    }[];
}

/**
 * Pre-calibrated fingerprints for common media scraper components.
 */
export const FINGERPRINT_PRESETS: Record<string, ElementFingerprint> = {
    // Novel & Media Search Card (an anchor or card div linking to novel details with title and thumbnail)
    mediaSearchCard: {
        tag: 'a',
        hasLink: true,
        hasImage: true,
        minTextLength: 3,
        maxTextLength: 300,
        attributePatterns: [
            { attr: 'href', pattern: /\/(novel|fiction|book|series|read)\b/i },
        ],
    },
    // Chapter List Item (links to chapter reading pages with 'chapter' in title/href)
    chapterItem: {
        tag: 'a',
        hasLink: true,
        minTextLength: 2,
        maxTextLength: 150,
        keywords: ['chapter', 'prologue', 'epilogue', 'vol', 'ch'],
        attributePatterns: [
            { attr: 'href', pattern: /(chapter|read|ch-|\/c\d+)/i },
        ],
    },
    // Novel Details Title
    detailTitle: {
        tag: 'h1',
        minTextLength: 2,
        maxTextLength: 150,
    },
    // Chapter Reading Content Block (contains numerous <p> tags with chapter narrative)
    chapterContentBlock: {
        tag: 'div',
        minTextLength: 500,
        maxTextLength: 2_000_000,
    },
};

export class AdaptiveEngine {
    /**
     * Computes similarity score (0.0 to 1.0) between a candidate Cheerio element and a target fingerprint.
     */
    static computeSimilarity($: CheerioAPI, el: Element, fp: ElementFingerprint): number {
        let score = 0;
        let totalWeights = 0;

        const tagName = (el.tagName || '').toLowerCase();
        const $el = $(el);

        // 1. Tag match (Weight: 25%)
        const tagWeight = 0.25;
        totalWeights += tagWeight;
        if (tagName === fp.tag.toLowerCase()) {
            score += tagWeight;
        } else if (
            (fp.tag === 'div' && ['article', 'section', 'li'].includes(tagName)) ||
            (fp.tag === 'h1' && ['h2', 'h3'].includes(tagName))
        ) {
            score += tagWeight * 0.7; // Partial structural credit
        }

        // 2. Structural traits: Links, Images, Headers (Weight: 30%)
        const structWeight = 0.30;
        totalWeights += structWeight;
        let structScore = 0;
        let structChecks = 0;

        if (fp.hasLink !== undefined) {
            structChecks++;
            const hasHref = Boolean($el.attr('href') || $el.find('a').attr('href'));
            if (hasHref === fp.hasLink) {
                structScore += 1;
            } else {
                structScore -= 0.5; // Disqualify non-links if link required
            }
        }

        if (fp.hasImage !== undefined) {
            structChecks++;
            const hasImg = Boolean($el.find('img').length > 0 || tagName === 'img');
            if (hasImg === fp.hasImage) {
                structScore += 1;
            } else if (fp.hasImage) {
                structScore -= 0.7; // Heavy penalty if image required but missing
            }
        }

        if (fp.hasHeader !== undefined) {
            structChecks++;
            const hasH = Boolean($el.find('h1, h2, h3, h4').length > 0 || /^h[1-6]$/.test(tagName));
            if (hasH === fp.hasHeader) structScore += 1;
        }

        if (structChecks > 0) {
            score += structWeight * Math.max(0, structScore / structChecks);
        } else {
            score += structWeight;
        }

        // 3. Text length & characteristics (Weight: 25%)
        const textWeight = 0.25;
        totalWeights += textWeight;
        const text = $el.text().trim();
        const textLen = text.length;

        const minLen = fp.minTextLength ?? 0;
        const maxLen = fp.maxTextLength ?? Infinity;

        if (textLen >= minLen && textLen <= maxLen) {
            score += textWeight;
        } else if (textLen > 0 && minLen > 0 && textLen >= minLen * 0.5) {
            score += textWeight * 0.5;
        }

        // 4. Keywords & Attribute patterns (Weight: 20%)
        const patternWeight = 0.20;
        totalWeights += patternWeight;
        let patternScore = 0;
        let patternChecks = 0;

        if (fp.keywords && fp.keywords.length > 0) {
            patternChecks++;
            const lowerText = text.toLowerCase();
            const hasKw = fp.keywords.some((kw) => lowerText.includes(kw.toLowerCase()));
            if (hasKw) patternScore += 1;
        }

        if (fp.attributePatterns && fp.attributePatterns.length > 0) {
            for (const ap of fp.attributePatterns) {
                patternChecks++;
                const val = $el.attr(ap.attr) || $el.find(`[${ap.attr}]`).attr(ap.attr) || '';
                if (ap.pattern.test(val)) {
                    patternScore += 1;
                }
            }
        }

        if (patternChecks > 0) {
            score += patternWeight * (patternScore / patternChecks);
        } else {
            score += patternWeight;
        }

        return totalWeights > 0 ? Math.min(1, Math.max(0, score / totalWeights)) : 0;
    }

    /**
     * Executes a CSS query with self-healing fallback.
     * If the primarySelector yields elements, returns immediately (0ms overhead).
     * If broken (0 elements), engages the similarity engine using the specified fingerprint.
     */
    static query(
        $: CheerioAPI,
        primarySelector: string,
        fingerprintKey: string,
        customFingerprint?: ElementFingerprint,
        threshold = 0.60
    ): Cheerio<Element> {
        // Fast path: Try primary selector first
        const primary = $(primarySelector);
        if (primary.length > 0) {
            return primary;
        }

        // Fallback: Locate fingerprint definition
        const fp = customFingerprint || FINGERPRINT_PRESETS[fingerprintKey];
        if (!fp) {
            return primary;
        }

        // Gather candidate elements
        const candidateTags = fp.tag === 'div' ? 'div, article, section, li' : fp.tag;
        const candidateElements = $(candidateTags).get();
        const scored: { el: Element; score: number }[] = [];

        for (const el of candidateElements) {
            const similarity = this.computeSimilarity($, el, fp);
            if (similarity >= threshold) {
                scored.push({ el, score: similarity });
            }
        }

        if (scored.length > 0) {
            scored.sort((a, b) => b.score - a.score);
            console.warn(
                `[AdaptiveEngine] Primary selector "${primarySelector}" failed. ` +
                `Auto-recovered ${scored.length} elements using fingerprint "${fingerprintKey}" ` +
                `(Top similarity: ${Math.round(scored[0].score * 100)}%)`
            );
            return $(scored.map((s) => s.el));
        }

        return $([]);
    }

    /**
     * Queries for a single element (e.g. title, cover, or main content block).
     */
    static queryOne(
        $: CheerioAPI,
        primarySelector: string,
        fingerprintKey: string,
        customFingerprint?: ElementFingerprint
    ): Cheerio<Element> {
        const results = this.query($, primarySelector, fingerprintKey, customFingerprint, 0.55);
        return results.first();
    }
}
