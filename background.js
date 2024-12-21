chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'error') {
        console.error(message.message);
    } else if (message.type === 'info') {
        console.log(message.message);
    }
});