// Background service worker - handles API calls (avoids CORS issues in content scripts)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GPI_GRAPHQL") {
    fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${message.token}`
      },
      body: JSON.stringify({ query: message.query, variables: message.variables })
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.errors) {
          console.error("[GPI] GraphQL errors:", JSON.stringify(data.errors, null, 2));
          sendResponse(data?.data || null);
        } else {
          sendResponse(data?.data || null);
        }
      })
      .catch(err => {
        console.error("[GPI] Fetch error:", err);
        sendResponse(null);
      });
    return true;
  }

  if (message.type === "GPI_FETCH_USER") {
    fetch("https://api.github.com/user", {
      headers: { "Authorization": `Bearer ${message.token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => sendResponse(data))
      .catch(() => sendResponse(null));
    return true;
  }
});
