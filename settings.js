document.addEventListener('DOMContentLoaded', () => {
    // Load existing settings
    chrome.storage.local.get(['serverUrl', 'modelName'], (result) => {
        if (result.serverUrl) {
            document.getElementById('server-url').value = result.serverUrl;
        }
        if (result.modelName) {
            document.getElementById('model-name').value = result.modelName;
        }
    });

    // Save settings handler
    document.getElementById('save-settings').addEventListener('click', () => {
        const serverUrl = document.getElementById('server-url').value;
        const modelName = document.getElementById('model-name').value;

        chrome.storage.local.set({
            serverUrl: serverUrl,
            modelName: modelName
        }, () => {
            window.location.href = 'popup.html';
        });
    });

    // Back button handler
    document.getElementById('back-button').addEventListener('click', () => {
        window.location.href = 'popup.html';
    });
}); 