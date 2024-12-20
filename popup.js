let pageContent = '';
let settings = {
  serverUrl: 'http://localhost:11434',
  modelName: 'unknown'
};

// Initialize markdown-it
document.addEventListener('DOMContentLoaded', () => {
  // Initialize markdown-it with configuration
  window.md = window.markdownit({
    html: false,
    xhtmlOut: false,
    breaks: true,
    linkify: true,
    typographer: true
  });

  // Load settings
  chrome.storage.local.get(['serverUrl', 'modelName'], (result) => {
    if (result.serverUrl) {
      settings.serverUrl = result.serverUrl;
      document.getElementById('server-url').value = result.serverUrl;
    }
    if (result.modelName) {
      settings.modelName = result.modelName;
      document.getElementById('model-name').value = result.modelName;
    }
  });

  // Setup event listeners
  document.getElementById('save-settings').addEventListener('click', () => {
    settings.serverUrl = document.getElementById('server-url').value;
    settings.modelName = document.getElementById('model-name').value;
    chrome.storage.local.set({
      serverUrl: settings.serverUrl,
      modelName: settings.modelName
    }, () => {
      alert('Settings saved!');
    });
  });

  document.getElementById('send-button').addEventListener('click', sendMessage);
  document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Extract page content
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const tab = tabs[0];
    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: () => {
        // Remove script tags and unnecessary whitespace
        const cleanContent = document.body.innerText
          .replace(/\s+/g, ' ')
          .trim();
        return cleanContent;
      }
    });
    pageContent = results[0].result;
    appendMessage('System', 'Connected to page. You can now chat about its contents.');
  });
});

async function sendMessage() {
  const input = document.getElementById('user-input');
  const message = input.value.trim();
  if (!message) return;

  appendMessage('User', message);
  input.value = '';

  // Show loading state
  const loadingMessageId = Date.now();
  appendMessage('System', 'Thinking...', loadingMessageId);
  
  try {
    // Verify Ollama server is running by listing models
    const healthCheck = await fetch(`${settings.serverUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }).catch(() => null);
    
    if (!healthCheck || !healthCheck.ok) {
      throw new Error('Cannot connect to Ollama server. Please make sure it\'s running and the URL is correct.');
    }
    const response = await fetch(`${settings.serverUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        model: settings.modelName,
        prompt: `Context: ${pageContent}\n\nUser: ${message}\n\nAssistant:`,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // Remove loading message
    const loadingMessage = document.getElementById(`message-${loadingMessageId}`);
    if (loadingMessage) {
      loadingMessage.remove();
    }
    appendMessage('Assistant', data.response);
  } catch (error) {
    appendMessage('System', `Error: ${error.message}`);
  }
}

function appendMessage(sender, text, messageId = null) {
  const chatContainer = document.getElementById('chat-container');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender.toLowerCase()}-message`;
  if (messageId) {
    messageDiv.id = `message-${messageId}`;
  }
  
  // Only use markdown for Assistant messages and ensure markdown-it is ready
  if (sender === 'Assistant' && window.md) {
    messageDiv.innerHTML = window.md.render(text);
  } else {
    messageDiv.textContent = text;
  }
  
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return messageDiv;
}