
const LLM_ENDPOINTS = {
    claude: 'https://claude.ai/new?q=',
    chatgpt: 'https://chatgpt.com/?q=',
    perplexity: 'https://www.perplexity.ai/?q=',
    gemini: 'https://gemini.google.com/app?q=',
    meta: 'https://chat.meta.com/chat?q='
};

const DEFAULT_LLM = 'claude';

// Traditional question words - match at beginning of query 

const QUESTION_STARTING_WORDS = [
    'is', 'are', 'was', 'were',
    'can', 'could', 'would', 'should',
    'what', 'when', 'where', 'why', 'who', 'how', 'which', 'whose', 'whom',
    "who's", "where're", "how's",    // common contractions 
    'hwo', 'whos', 'whoes', "who'is" // common mis-spellings
];

const questionPattern = QUESTION_STARTING_WORDS.join('|');

// Words that demand an "answer" - match anywhere in the query 

const QUESTION_INDICATORS = {

    questionWords: [
        // 'whatever', 'whenever', 'wherever', 'whoever', 'whomever'
    ],

    questionWordsMisspelled: [
    ],

    // Phrases that indicate seeking explanation/understanding
    explanationPhrases: [
        'explain', 'describe', 'tell me about', 'help me understand',
        'definition of', 'meaning of', 'difference between',
        'compare', 'define',
        'steps to', 'step-by-step', 'step by step', 'guide', 'tutorial', 'how-to',
        'example of', 'examples', 'best way to'
        // 'vs', 'versus', 'or'
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

    // Check if ends with question mark --> LLM 
    if (query.endsWith('?')) return true;

    // Check if ends with a period or ' g' --> escape to Google
    if (query.endsWith('.') || query.endsWith(' g')) return false;

    // Check for words that begin a question 
    if (new RegExp(`^(${questionPattern})\\b`).test(query)) return true;

    // Check against all question indicators
    for (const category in QUESTION_INDICATORS) {
        for (const indicator of QUESTION_INDICATORS[category]) {
            // For exact matches or matches at word boundaries
            const pattern = new RegExp(`\\b${indicator}\\b`);
            if (pattern.test(query)) return true;
        }
    }

    // Check for numbers with units (likely seeking conversion or calculation)
    // if (/\d+\s*(kg|km|mi|ft|m|cm|lb|g|mph|kb|mb|gb)/.test(query)) return true;

    return false;
}

// Listen for any navigation before it happens in Chrome
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    // Skip if extension is disabled or if this isn't the main frame (i.e., iframes)
    if (!isEnabled || details.frameId !== 0) return;

    // Create a URL object from the navigation URL for easy parsing
    const url = new URL(details.url);

    // Only proceed if this is a Google search URL
    // e.g., "www.google.com/search?q=something"
    if (!url.hostname.includes('google.com') || !url.pathname.includes('/search')) return;

    // Parse the URL parameters and get the search query
    // e.g., from "?q=how+to+code" get "how to code"
    const searchParams = new URLSearchParams(url.search);
    const query = searchParams.get('q');

    // If no query found, exit
    if (!query) return;

    // Check if the query looks like a question
    if (isQuestionLikeQuery(query)) {
        // Construct LLM URL by adding the encoded query to the base URL
        const llmURL = LLM_ENDPOINTS[currentLLM] + encodeURIComponent(query);
        // Redirect the tab to the LLM URL
        chrome.tabs.update(details.tabId, { url: llmURL });

        // Update statistics for LLM usage
        chrome.storage.local.get(['llmStats'], (result) => {
            const stats = result.llmStats || {};  // Get existing stats or empty object
            stats[currentLLM] = (stats[currentLLM] || 0) + 1;  // Increment count
            chrome.storage.local.set({ llmStats: stats });  // Save updated stats
        });
    } else {
        // If not a question, let it go to Google but update Google usage stats
        chrome.storage.local.get(['llmStats'], (result) => {
            const stats = result.llmStats || {};
            stats.google = (stats.google || 0) + 1;
            chrome.storage.local.set({ llmStats: stats });
        });
    }
});
