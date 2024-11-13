const BACKEND_URL = "http://localhost:3000";
// const BACKEND_URL = "http://51.20.183.119";

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    form: document.getElementById("letterForm"),
    userId: document.getElementById("userId"),
    apiKey: document.getElementById("apiKey"),
    letterInput: document.getElementById("letterInput"),
    wordCount: document.getElementById("wordCount"),
    wordWarning: document.getElementById("wordWarning"),
    submitBtn: document.getElementById("submitBtn"),
    loadingIndicator: document.getElementById("loadingIndicator"),
    apiResponse: document.getElementById("apiResponse"),
    remainingRequests: document.getElementById("remainingRequests"),
  };

  const DEBOUNCE_DELAY = 300;

  const WORD_LIMITS = {
    MIN: 100,
    MAX: 300,
    ABSOLUTE_MAX: 350,
  };

  initializeForm();
  setupEventListeners();

  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function initializeForm() {
    elements.userId.value = localStorage.getItem("userId") || "";
    elements.apiKey.value = localStorage.getItem("apiKey") || "";
  }

  function setupEventListeners() {
    elements.letterInput.addEventListener(
      "input",
      debounce(handleWordCount, DEBOUNCE_DELAY)
    );
    elements.form.addEventListener("submit", handleSubmit);
  }

  function handleWordCount() {
    const words = getWords(elements.letterInput.value);
    const wordCountValue = words.length;
    elements.wordCount.textContent = `Words: ${wordCountValue}`;

    updateWordWarning(wordCountValue);
    updateSubmitButton(wordCountValue);
  }

  function getWords(text) {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  function updateWordWarning(wordCount) {
    if (wordCount < WORD_LIMITS.MIN) {
      elements.wordWarning.textContent = `You need to write ${
        WORD_LIMITS.MIN - wordCount
      } more words for the minimum length of the letter`;
    } else if (
      wordCount > WORD_LIMITS.MAX &&
      wordCount <= WORD_LIMITS.ABSOLUTE_MAX
    ) {
      elements.wordWarning.textContent =
        "Your letter is over 300 words, make it a bit more concise!";
    } else if (wordCount > WORD_LIMITS.ABSOLUTE_MAX) {
      elements.wordWarning.textContent =
        "Your letter is too long, it should be under 350 words!";
      truncateText();
    } else {
      elements.wordWarning.textContent = "";
    }
  }

  function updateSubmitButton(wordCount) {
    elements.submitBtn.disabled =
      wordCount < WORD_LIMITS.MIN || wordCount > WORD_LIMITS.ABSOLUTE_MAX;
  }

  function truncateText() {
    const words = getWords(elements.letterInput.value);
    elements.letterInput.value = words
      .slice(0, WORD_LIMITS.ABSOLUTE_MAX)
      .join(" ");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const words = getWords(elements.letterInput.value);
    if (
      words.length < WORD_LIMITS.MIN ||
      words.length > WORD_LIMITS.ABSOLUTE_MAX
    ) {
      alert(
        `Your letter should be between ${WORD_LIMITS.MIN} and ${WORD_LIMITS.ABSOLUTE_MAX} words`
      );
      return;
    }

    saveUserData();
    setFormState(true);

    try {
      const result = await sendRequest();
      handleResponse(result);
    } catch (error) {
      console.error("Error:", error);
      displayMessage("An error occurred. Please try again.");
    } finally {
      elements.loadingIndicator.classList.add("hidden");
      setFormState(false);
    }
  }

  function saveUserData() {
    localStorage.setItem("userId", elements.userId.value);
    localStorage.setItem("apiKey", elements.apiKey.value);
  }

  function setFormState(disabled) {
    elements.userId.disabled = disabled;
    elements.apiKey.disabled = disabled;
    elements.letterInput.disabled = disabled;
    elements.submitBtn.disabled = disabled;
    elements.submitBtn.style.backgroundColor = disabled ? "#6c757d" : "";
    elements.loadingIndicator.classList.toggle("hidden", !disabled);
    if (!disabled) {
      elements.apiResponse.classList.remove("hidden");
    }
  }

  async function sendRequest() {
    const response = await fetch(`${BACKEND_URL}/api/process-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: elements.userId.value,
        text: elements.letterInput.value,
        apiKey: elements.apiKey.value,
      }),
    });
    return response.json();
  }

  function handleResponse(result) {
    if (result.error) {
      displayMessage(result.error);
      return;
    }

    if (result.response) {
      try {
        console.log("got response!", result.response);
        const parsedResponse = JSON.parse(result.response);
        console.log("parsed response!", parsedResponse);
        displayJsonResponse(parsedResponse);
      } catch (error) {
        console.error("Error parsing JSON response:", error);
        displayMessage("Error processing the response");
      }
    }

    if (result.requests !== undefined) {
      elements.remainingRequests.textContent = `${result.requests} requests left for today.`;
      elements.remainingRequests.classList.remove("hidden");
    }
  }

  function displayJsonResponse(response) {
    document.querySelector("#professionalTone p").textContent =
      response.feedback.professional_tone;
    document.querySelector("#clientNeedsSolution p").textContent =
      response.feedback.client_needs_and_proposed_solution;
    document.querySelector("#businessImpact p").textContent =
      response.feedback.understanding_of_business_impact;

    document.querySelector("#updatedLetter div").innerHTML =
      response.updated_letter;

    elements.apiResponse.classList.remove("hidden");
  }

  function displayMessage(message) {
    const existingMessage = document.getElementById("messageDisplay");
    if (existingMessage) existingMessage.remove();

    const messageElement = document.createElement("div");
    messageElement.id = "messageDisplay";
    messageElement.textContent = message;
    messageElement.className = "message-display";

    const container = document.querySelector(".container");
    container.insertBefore(messageElement, container.firstChild);
  }
});
