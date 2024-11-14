// const BACKEND_URL = "http://localhost:3000";
const BACKEND_URL =
  "https://mh6papii0e.execute-api.eu-north-1.amazonaws.com/test";

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
    setFormLoading(true);

    try {
      const result = await sendRequest();
      handleResponse(result);
    } catch (error) {
      console.error("Error:", error);
      displayMessage(error);
    } finally {
      elements.loadingIndicator.classList.add("hidden");
      setFormLoading(false);
    }
  }

  function saveUserData() {
    localStorage.setItem("userId", elements.userId.value);
    localStorage.setItem("apiKey", elements.apiKey.value);
  }

  function setFormLoading(isLoading) {
    elements.userId.disabled = isLoading;
    elements.apiKey.disabled = isLoading;
    elements.letterInput.disabled = isLoading;
    elements.submitBtn.disabled = isLoading;
    elements.submitBtn.style.backgroundColor = isLoading ? "#6c757d" : "";
    elements.loadingIndicator.classList.toggle("hidden", !isLoading);
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
    try {
      const response = await fetch(`${BACKEND_URL}/api/process-letter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          userId: elements.userId.value,
          text: elements.letterInput.value,
          apiKey: elements.apiKey.value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data;
    } catch (error) {
      console.error("Request error:", error);
      throw error;
    }
  }

  function handleResponse(result) {
    if (result.error) {
      displayMessage(result.error);
      return;
    }

    if (result.response) {
      try {
        const parsedResponse = JSON.parse(result.response);
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
    const hasAllFields =
      response.feedback?.professional_tone &&
      response.feedback?.client_needs_and_proposed_solution &&
      response.feedback?.understanding_of_business_impact &&
      response.updated_letter;

    if (!hasAllFields) {
      displayMessage("Incomplete response received. Please try again.");
      return;
    }
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

    setTimeout(() => {
      const message = document.getElementById("messageDisplay");
      if (message) {
        message.remove();
      }
    }, 5000);
  }
});
