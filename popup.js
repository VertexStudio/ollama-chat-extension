let pageContent = '';
let settings = {
  serverUrl: 'http://localhost:11434',
  modelName: 'deepseek-r1:8b',
  context_length: 131072
};
let messageHistory = [];
let autoScroll = true;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize markdown-it
  window.md = window.markdownit({
    html: false,
    breaks: true,
    linkify: true
  });

  // Add this line to focus the input when popup opens
  document.getElementById('user-input').focus();

  // Load settings only
  chrome.storage.local.get(['serverUrl', 'modelName', 'context_length'], (result) => {
    if (result.serverUrl) {
      settings.serverUrl = result.serverUrl;
    }
    if (result.modelName) {
      settings.modelName = result.modelName;
    }
    if (result.context_length) {
      settings.context_length = parseInt(result.context_length);
    }
  });

  document.getElementById('send-button').addEventListener('click', sendMessage);
  setupTextarea();

  // Extract page content
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => ({
          content: document.body.innerText.replace(/\s+/g, ' ').trim(),
          title: document.title
        })
      });
      pageContent = results[0].result.content;
      const pageTitle = results[0].result.title;
      appendMessage('System', `Connected to page: "${pageTitle}". You can now chat about its contents.`);

      // Add page content to message history immediately
      messageHistory.push({
        role: 'system',
        content: `Page content: ${pageContent}`
      });
    } catch (error) {
      console.error('Error accessing page content:', error);
      appendMessage('System', `Unable to access page content (${error.message}). This is normal for certain pages like chrome:// URLs.`);
      pageContent = 'Page content not accessible';
    }
  });

  // Add scroll event listener to chat container
  const chatContainer = document.getElementById('chat-container');
  chatContainer.addEventListener('scroll', () => {
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 1;
    autoScroll = isAtBottom;
  });

  // Add settings button handler
  document.getElementById('settings-button').addEventListener('click', () => {
    window.location.href = 'settings.html';
  });
});

function setupTextarea() {
  const textarea = document.getElementById('user-input');

  const resizeTextarea = () => {
    textarea.style.height = 'auto';
    const maxHeight = 100;
    const scrollHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = scrollHeight + 'px';
  };

  textarea.addEventListener('input', resizeTextarea);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function appendMessage(sender, content) {
  const chatContainer = document.getElementById('chat-container');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender.toLowerCase()}-message`;

  if (sender === 'Assistant') {
    messageDiv.innerHTML = window.md.render(content || '');
  } else {
    messageDiv.textContent = content;
  }

  chatContainer.appendChild(messageDiv);
  if (autoScroll) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  if (sender !== 'System') {
    messageHistory.push({
      role: sender.toLowerCase(),
      content: content
    });
  }

  return messageDiv;
}

async function processStreamingResponse(response, messageDiv) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedContent = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);

          if (data.message && data.message.content) {
            if (messageDiv.textContent === 'Thinking...') {
              messageDiv.textContent = '';
            }

            accumulatedContent += data.message.content;
            messageDiv.innerHTML = window.md.render(accumulatedContent);

            const chatContainer = document.getElementById('chat-container');
            if (autoScroll) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }

          if (data.done) {
            messageHistory.push({
              role: 'assistant',
              content: accumulatedContent
            });
          }
        } catch (e) {
          console.error('JSON Parse Error:', e.message, line);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.message && data.message.content) {
          accumulatedContent += data.message.content;
          messageDiv.innerHTML = window.md.render(accumulatedContent);
        }
      } catch (e) {
        console.error('Final Buffer Parse Error:', e.message);
      }
    }

    return accumulatedContent;
  } catch (error) {
    console.error('Stream Processing Error:', error);
    messageDiv.textContent = `Error: Failed to process response stream - ${error.message}`;
    throw error;
  }
}

async function sendMessage() {
  const input = document.getElementById('user-input');
  const message = input.value.trim();
  if (!message) return;

  input.disabled = true;
  document.getElementById('send-button').disabled = true;

  appendMessage('User', message);

  input.value = '';
  input.style.height = 'auto';

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant-message';
  messageDiv.textContent = 'Thinking...';
  document.getElementById('chat-container').appendChild(messageDiv);

  try {
    // Prepare messages array with system context for this request only
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant that analyzes web page content.'
      },
      ...messageHistory,  // page content will now come from here
      {
        role: 'user',
        content: message
      }
    ];

    const response = await fetch(`${settings.serverUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.modelName,
        messages: messages,
        stream: true,
        options: {
          num_ctx: settings.context_length
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    await processStreamingResponse(response, messageDiv);

  } catch (error) {
    messageDiv.textContent = `Error: ${error.message}`;
  } finally {
    input.disabled = false;
    document.getElementById('send-button').disabled = false;
    input.focus();
  }
}