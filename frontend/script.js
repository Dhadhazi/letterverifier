document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("letterForm");
  const userId = document.getElementById("userId");
  const letterInput = document.getElementById("letterInput");
  const wordCount = document.getElementById("wordCount");
  const wordWarning = document.getElementById("wordWarning");
  const submitBtn = document.getElementById("submitBtn");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const apiResponse = document.getElementById("apiResponse");

  // Word count and warnings
  letterInput.addEventListener("input", () => {
    const words = letterInput.value
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const wordCountValue = words.length;
    wordCount.textContent = `Words: ${wordCountValue}`;

    if (wordCountValue < 100) {
      wordWarning.textContent = `You need to write ${
        100 - wordCountValue
      } more words for the minimum length of the letter`;
      submitBtn.disabled = true;
    } else if (wordCountValue > 300 && wordCountValue <= 350) {
      wordWarning.textContent =
        "Your letter is over 300 words, make it a bit more concise!";
      submitBtn.disabled = false;
    } else if (wordCountValue > 350) {
      wordWarning.textContent =
        "Your letter is too long, it should be under 350 words!";
      letterInput.value = words.slice(0, 350).join(" ");
      submitBtn.disabled = false;
    } else {
      wordWarning.textContent = "";
      submitBtn.disabled = false;
    }
  });

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const words = letterInput.value
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    if (words.length < 100 || words.length > 350) {
      alert("Your letter should be between 100 and 350 words");
      return;
    }

    // Disable form elements
    userId.disabled = true;
    letterInput.disabled = true;
    submitBtn.disabled = true;
    submitBtn.style.backgroundColor = "#6c757d";

    // Show loading indicator
    loadingIndicator.classList.remove("hidden");
    apiResponse.classList.add("hidden");

    const data = {
      userId: userId.value,
      text: letterInput.value,
    };

    try {
      const response = await fetch("http://localhost:3000/process-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.message) {
        displayMessage(result.message);
      } else if (result.response) {
        displayResponse(result.response);
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      console.error("Error:", error);
      displayMessage("An error occurred. Please try again.");
    } finally {
      // Hide loading indicator
      loadingIndicator.classList.add("hidden");

      // Re-enable form elements only if no message is displayed
      if (!document.getElementById("messageDisplay")) {
        userId.disabled = false;
        letterInput.disabled = false;
        submitBtn.disabled = false;
        submitBtn.style.backgroundColor = "";
      }
    }
  });

  function displayMessage(message) {
    // Remove any existing message
    const existingMessage = document.getElementById("messageDisplay");
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageElement = document.createElement("div");
    messageElement.id = "messageDisplay";
    messageElement.textContent = message;
    messageElement.className = "message-display";

    const container = document.querySelector(".container");
    container.insertBefore(messageElement, container.firstChild);

    // Disable form elements
    userId.disabled = true;
    letterInput.disabled = true;
    submitBtn.disabled = true;
    submitBtn.style.backgroundColor = "#6c757d";
  }

  function displayResponse(response) {
    console.log(response);
    const sections = response.split("%%%");
    if (sections.length !== 4) {
      console.error("Unexpected response format");
      return;
    }

    document.querySelector("#professionalTone p").textContent =
      sections[0].trim();
    document.querySelector("#clientNeedsSolution p").textContent =
      sections[1].trim();
    document.querySelector("#businessImpact p").textContent =
      sections[2].trim();
    document.querySelector("#updatedLetter div").innerHTML = sections[3].trim();

    apiResponse.classList.remove("hidden");
  }
});
