
const LLM_ENDPOINTS = {
    claude:     'https://claude.ai/new?q=',
    chatgpt:    'https://chatgpt.com/?q=',
    perplexity: 'https://www.perplexity.ai/?q=',
    gemini:     'https://gemini.google.com/app?q=',
    meta:       'https://chat.meta.com/chat?q='
};

const DEFAULT_LLM = 'claude';

const QUESTION_INDICATORS = {

    // Traditional question words
    questionWords: [
        'what', 'when', 'where', 'why', 'who', 'how', 
        'which', 'whose', 'whom'
        // 'whatever', 'whenever', 'wherever', 'whoever'
    ],

    // Phrases that indicate seeking explanation/understanding
    explanationPhrases: [
        'explain', 'describe', 'tell me about', 'help me understand',
        'definition of', 'meaning of', 'difference between',
        'compare', 'vs', 'versus', 'or', 'define',
        'steps to', 'guide', 'tutorial', 'how-to',
        'example of', 'examples', 'best way to'
    ],

    // Problem-solving indicators
    problemSolving: [
        'solve', 'calculate', 'compute', 'fix', 'debug',
        'troubleshoot', 'help', 'issue with', 'problem with',
        'not working', "can't", 'unable to'
        // 'error'
    ],

    // Opinion/recommendation seeking
    opinionSeeking: [
        'should i', 'recommend',
        'review', 'opinion', 'thoughts on', 'pros and cons',
        'advantages', 'disadvantages', 'worth it'
        // 'better', 'best', 'worst'
    ]

};

let currentLLM = DEFAULT_LLM;
let isEnabled = true;

chrome.storage.local.get(['preferredLLM', 'isEnabled'], (result) => {
    if (result.preferredLLM) {
        currentLLM = result.preferredLLM;
    }
    if (result.isEnabled !== undefined) {
        isEnabled = result.isEnabled;
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateLLM') {
        currentLLM = message.llm;
        sendResponse({ status: 'success' });
    } else if (message.type === 'toggleRouting') {
        isEnabled = message.enabled;
        sendResponse({ status: 'success' });
    }
});

function isQuestionLikeQuery(query) {
    // Normalize query to lowercase and trim
    query = query.toLowerCase().trim();

    // Check if ends with question mark
    if (query.endsWith('?')) return true;

    // Check against all question indicators
    for (const category in QUESTION_INDICATORS) {
        for (const indicator of QUESTION_INDICATORS[category]) {
            // For exact matches or matches at word boundaries
            const pattern = new RegExp(`\\b${indicator}\\b`);
            if (pattern.test(query)) return true;
        }
    }

    // Additional heuristics

    // Check for "is/are/was/were" at the start (likely a yes/no question)
    if (/^(is|are|was|were)\b/.test(query)) return true;

    // Check for "can/could/would/should" at the start
    if (/^(can|could|would|should)\b/.test(query)) return true;

    // Check for numbers with units (likely seeking conversion or calculation)
    if (/\d+\s*(kg|km|mi|ft|m|cm|lb|g|mph|kb|mb|gb)/.test(query)) return true;

    return false;
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (!isEnabled || details.frameId !== 0) return;

    const url = new URL(details.url);

    if (!url.hostname.includes('google.com') || !url.pathname.includes('/search')) return;

    const searchParams = new URLSearchParams(url.search);
    const query = searchParams.get('q');

    if (!query) return;

    if (isQuestionLikeQuery(query)) {
        const llmURL = LLM_ENDPOINTS[currentLLM] + encodeURIComponent(query);
        chrome.tabs.update(details.tabId, { url: llmURL });

        chrome.storage.local.get(['llmStats'], (result) => {
            const stats = result.llmStats || {};
            stats[currentLLM] = (stats[currentLLM] || 0) + 1;
            chrome.storage.local.set({ llmStats: stats });
        });
    } else {
        chrome.storage.local.get(['llmStats'], (result) => {
            const stats = result.llmStats || {};
            stats.google = (stats.google || 0) + 1;
            chrome.storage.local.set({ llmStats: stats });
        });
    }
});
