/**
 * PostContentFunctions.js
 *
 * Renders post "content" (custom lightweight markup, NOT raw HTML) into
 * real DOM nodes. No innerHTML is ever used on user content, so XSS is
 * structurally impossible regardless of what a post contains.
 *
 * Supported markup:
 *   [b]bold[/b]
 *   [i]italic[/i]
 *   [u]underline[/u]
 *   [ol] [li]item[/li] [li]item[/li] [/ol]
 *   [ul] [li]item[/li] [li]item[/li] [/ul]
 *   [url=https://example.com]link text[/url]
 *
 * Anything else (unknown tags, malformed nesting, stray brackets) is
 * rendered back out as plain text rather than interpreted.
 */

const INLINE_TAGS = { b: 'b', i: 'i', u: 'u' };
const LIST_TAGS = { ol: 'ol', ul: 'ul' };

// ---- DOM helpers (kept in line with existing createDIV/createLabel/createButton style) ----

function createElementOfType(type)
{
    return document.createElement(type);
}

function createTextNodeSafe(text)
{
    return document.createTextNode(text);
}

function createAnchorSafe(href, label)
{
    const anchor = createElementOfType('a');
    const safeHref = sanitizeHref(href);

    if (safeHref === null) {
        // Invalid/unsafe href: fall back to plain text so nothing is dropped silently.
        return createTextNodeSafe(label);
    }

    anchor.href = safeHref;
    anchor.rel = 'noopener noreferrer';
    anchor.target = '_blank';
    anchor.appendChild(createTextNodeSafe(label));
    return anchor;
}

function sanitizeHref(url)
{
    if (typeof url !== 'string') {
        return null;
    }

    const trimmed = url.trim();
    if (trimmed === '' || /[\x00-\x1F\x7F]/.test(trimmed)) {
        return null;
    }

    if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
        return null;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
        return null;
    }

    try {
        // Throws on malformed URLs.
        new URL(trimmed);
    } catch (e) {
        return null;
    }

    return trimmed;
}

// ---- Tokenizer ----
// Splits raw markup into a flat token stream: {type:'open'|'close'|'text', tag, attr, value}

function tokenizePostContent(raw)
{
    const tokens = [];
    const tagPattern = /\[(\/?)(b|i|u|ol|ul|li|url)(=[^\]]*)?\]/gi;
    let lastIndex = 0;
    let match;

    while ((match = tagPattern.exec(raw)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: raw.slice(lastIndex, match.index) });
        }

        const isClosing = match[1] === '/';
        const tag = match[2].toLowerCase();
        const attr = match[3] ? match[3].slice(1) : '';

        tokens.push({
            type: isClosing ? 'close' : 'open',
            tag,
            attr,
        });

        lastIndex = tagPattern.lastIndex;
    }

    if (lastIndex < raw.length) {
        tokens.push({ type: 'text', value: raw.slice(lastIndex) });
    }

    return tokens;
}

// ---- Parser: token stream -> node tree ----
// Node shapes: {kind:'text', value} | {kind:'tag', tag, attr, children:[...]}

function parseTokensToTree(tokens)
{
    const root = { kind: 'tag', tag: 'root', attr: '', children: [] };
    const stack = [root];

    for (const token of tokens) {
        const current = stack[stack.length - 1];

        if (token.type === 'text') {
            if (token.value !== '') {
                current.children.push({ kind: 'text', value: token.value });
            }
            continue;
        }

        if (token.type === 'open') {
            const node = { kind: 'tag', tag: token.tag, attr: token.attr, children: [] };
            current.children.push(node);
            stack.push(node);
            continue;
        }

        // Closing tag: unwind stack to matching open tag if present, ignore stray closes.
        if (token.type === 'close') {
            for (let i = stack.length - 1; i > 0; i--) {
                if (stack[i].tag === token.tag) {
                    stack.length = i; // pop everything down to (and including) the match
                    break;
                }
            }
        }
    }

    return root;
}

// ---- Tree -> DOM ----

function buildDomFromNode(node)
{
    if (node.kind === 'text') {
        return node.value === '' ? null : createTextNodeSafe(node.value);
    }

    if (node.tag === 'root') {
        const fragment = document.createDocumentFragment();
        appendChildren(fragment, node.children);
        return fragment;
    }

    if (INLINE_TAGS[node.tag]) {
        const el = createElementOfType(INLINE_TAGS[node.tag]);
        appendChildren(el, node.children);
        return el;
    }

    if (LIST_TAGS[node.tag]) {
        const el = createElementOfType(LIST_TAGS[node.tag]);
        for (const child of node.children) {
            if (child.kind === 'tag' && child.tag === 'li') {
                const li = createElementOfType('li');
                appendChildren(li, child.children);
                el.appendChild(li);
            }
            // Anything inside a list that isn't <li> is dropped: lists may
            // only contain list items per the allowed grammar.
        }
        return el;
    }

    if (node.tag === 'li') {
        // Stray <li> outside a list: render as its own list item wrapper.
        const li = createElementOfType('li');
        appendChildren(li, node.children);
        return li;
    }

    if (node.tag === 'url') {
        const label = flattenToText(node.children);
        return createAnchorSafe(node.attr, label !== '' ? label : node.attr);
    }

    // Unknown tag: shouldn't happen given the tokenizer whitelist, but
    // fall back to rendering children as plain content.
    const fallback = document.createDocumentFragment();
    appendChildren(fallback, node.children);
    return fallback;
}

function appendChildren(parent, children)
{
    for (const child of children) {
        const domNode = buildDomFromNode(child);
        if (domNode !== null) {
            parent.appendChild(domNode);
        }
    }
}

function flattenToText(children)
{
    let text = '';
    for (const child of children) {
        if (child.kind === 'text') {
            text += child.value;
        } else if (child.children) {
            text += flattenToText(child.children);
        }
    }
    return text;
}

// ---- Public API ----

/**
 * Parses raw post markup and returns a DocumentFragment ready to append.
 * @param {string} rawContent
 * @returns {DocumentFragment}
 */
export function parsePostContent(rawContent)
{
    const safeInput = typeof rawContent === 'string' ? rawContent : '';
    const tokens = tokenizePostContent(safeInput);
    const tree = parseTokensToTree(tokens);
    return buildDomFromNode(tree);
}

/**
 * Parses and appends rendered post content directly into a container element.
 * @param {HTMLElement} container
 * @param {string} rawContent
 */
export function renderPostContent(container, rawContent)
{
    if (!(container instanceof HTMLElement)) {
        return;
    }
    container.appendChild(parsePostContent(rawContent));
}
