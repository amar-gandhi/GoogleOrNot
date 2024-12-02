
document.addEventListener('DOMContentLoaded', () => {
    const routingToggle = document.getElementById('routingToggle');
    const radioButtons = document.querySelectorAll('input[name="llm"]');
    const rulesHeader = document.getElementById('rulesHeader');
    const rulesContent = document.getElementById('rulesContent');
    const expandIcon = rulesHeader.querySelector('.expand-icon');

    const DEFAULT_LLM = 'claude';

    // Load current settings and set initial state
    chrome.storage.local.get(['preferredLLM', 'isEnabled'], (result) => {
        const currentLLM = result.preferredLLM || DEFAULT_LLM;
        const radioButton = document.querySelector(`input[value="${currentLLM}"]`);
        if (radioButton) {
            radioButton.checked = true;
        } else {
            const defaultRadio = document.querySelector(`input[value="${DEFAULT_LLM}"]`);
            if (defaultRadio) defaultRadio.checked = true;
        }

        // Default to true if undefined (matching background.js initialization)
        routingToggle.checked = result.isEnabled !== undefined ? result.isEnabled : true;


        if (!result.preferredLLM) {
            chrome.storage.local.set({ preferredLLM: DEFAULT_LLM });
        }
    });

    // Load stats
    chrome.storage.local.get(['llmStats'], (result) => {
        const stats = result.llmStats || {};
        document.getElementById('claudeCount').textContent = stats.claude || 0;
        document.getElementById('chatgptCount').textContent = stats.chatgpt || 0;
        document.getElementById('perplexityCount').textContent = stats.perplexity || 0;
        // document.getElementById('geminiCount').textContent = stats.gemini || 0;
        // document.getElementById('metaCount').textContent = stats.meta || 0;
        document.getElementById('googleCount').textContent = stats.google || 0;
    });

    // Toggle routing
    routingToggle.addEventListener('change', () => {
        const isEnabled = routingToggle.checked;
        chrome.storage.local.set({ isEnabled });
        chrome.runtime.sendMessage({ type: 'toggleRouting', enabled: isEnabled });
    });

    // LLM selection
    radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                const llm = radio.value;
                chrome.storage.local.set({ preferredLLM: llm });
                chrome.runtime.sendMessage({ type: 'updateLLM', llm });
            }
        });
    });

    // Rules section expansion
    rulesHeader.addEventListener('click', () => {
        rulesContent.classList.toggle('expanded');
        expandIcon.classList.toggle('expanded');

        // Toggle padding for content
        if (rulesContent.classList.contains('expanded')) {
            rulesContent.style.padding = '12px';
        } else {
            rulesContent.style.padding = '0';
        }
    });
});
