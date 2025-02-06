document.addEventListener('DOMContentLoaded', () => {
    // Load existing settings
    chrome.storage.local.get(['serverUrl', 'modelName', 'context_length'], (result) => {
        const serverUrlInput = document.getElementById('server-url');
        const modelNameInput = document.getElementById('model-name');
        const contextLengthInput = document.getElementById('context-length');

        // Check if elements exist before accessing
        if (!serverUrlInput || !modelNameInput || !contextLengthInput) {
            console.error('Missing required form elements:', {
                serverUrl: !!serverUrlInput,
                modelName: !!modelNameInput,
                contextLength: !!contextLengthInput
            });
            return;
        }

        if (result.serverUrl) {
            serverUrlInput.value = result.serverUrl;
        }
        if (result.modelName) {
            modelNameInput.value = result.modelName;
        }
        if (result.context_length) {
            contextLengthInput.value = result.context_length;
        }

        // Add test connection button handler
        const testConnectionButton = document.getElementById('test-connection');
        if (testConnectionButton) {
            testConnectionButton.addEventListener('click', async () => {
                const serverUrl = document.getElementById('server-url').value;
                testConnectionButton.disabled = true;
                testConnectionButton.textContent = 'Testing...';
                
                try {
                    const response = await fetch(`${serverUrl}/api/tags`);
                    if (response.ok) {
                        alert('Connection successful! Ollama is reachable.');
                    } else {
                        alert('Connection failed. Make sure Ollama is running and the URL is correct.');
                    }
                } catch (error) {
                    alert('Connection failed. Error: ' + error.message);
                } finally {
                    testConnectionButton.disabled = false;
                    testConnectionButton.textContent = 'Test Connection';
                }
            });
        }
    });

    // Save settings handler
    const saveButton = document.getElementById('save-settings');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const serverUrlInput = document.getElementById('server-url');
            const modelNameInput = document.getElementById('model-name');
            const contextLengthInput = document.getElementById('context-length');

            if (!serverUrlInput || !modelNameInput || !contextLengthInput) {
                console.error('Missing required form elements for saving');
                return;
            }

            chrome.storage.local.set({
                serverUrl: serverUrlInput.value,
                modelName: modelNameInput.value,
                context_length: contextLengthInput.value
            }, () => {
                window.location.href = 'popup.html';
            });
        });
    }

    // Back button handler
    document.getElementById('back-button').addEventListener('click', () => {
        window.location.href = 'popup.html';
    });
}); 