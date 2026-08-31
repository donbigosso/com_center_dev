import { POSTJSONRequest, getSetting } from "./CoreFunctions.js";
import { getSessionToken, showFeedback } from "./CustomFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";
import { newHideModal, createDIV, createLabel, createBootstrapTextInput, createBootstrapTextArea, createButton } from "./PageAppearance.js";
import { verifySession } from "./RequestFunctions.js";
import { renderPostContent } from "./PostContentFunctions.js";

/*
 * Post formatting reference
 * -------------------------
 * Post content is stored and transmitted as a small custom markup, NOT raw
 * HTML — this matches what the backend sanitizer accepts
 * (api_source/classes/post_and_message_model.php -> sanitize_post_content).
 *
 *   [b]bold text[/b]
 *   [i]italic text[/i]
 *   [u]underlined text[/u]
 *   [ol][li]first[/li][li]second[/li][/ol]    ordered list
 *   [ul][li]first[/li][li]second[/li][/ul]    bullet list
 *   [url=https://example.com]link text[/url]  link (http/https only)
 *
 * The toolbar buttons below just insert these tags around the current
 * textarea selection — nothing fancy, no WYSIWYG state. The preview pane
 * calls renderPostContent() (frontend/functions/PostContentFunctions.js),
 * which builds real DOM nodes for the tags above and treats everything
 * else as plain text — it never uses innerHTML, so the preview can't be
 * used to inject anything even before the content reaches the server.
 */

const POST_TEXTAREA_ID = "post-content-textarea";
const POST_TOPIC_ID = "post-topic-input";
const POST_PREVIEW_ID = "post-preview-pane";

// Wraps the current textarea selection in [tag]...[/tag]. With nothing
// selected, it inserts an empty pair and places the caret between them.
function wrapSelectionWithTag(textarea, openTag, closeTag) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  const newValue = value.slice(0, start) + openTag + selected + closeTag + value.slice(end);
  textarea.value = newValue;

  const caretStart = start + openTag.length;
  const caretEnd = caretStart + selected.length;
  textarea.focus();
  textarea.setSelectionRange(caretStart, caretEnd);

  // Keep the preview pane in sync with toolbar-driven edits too.
  textarea.dispatchEvent(new Event("input"));
}

// Wraps the selection as a link. Prompts for the URL since [url=] needs
// an attribute rather than just an open/close pair.
function wrapSelectionAsLink(textarea) {
  const url = window.prompt("Link URL (https://...)");
  if (!url) return;
  wrapSelectionWithTag(textarea, `[url=${url}]`, "[/url]");
}

function createToolbarButton(label, title, onClick) {
  const button = createButton("button", label, "btn btn-sm btn-outline-secondary me-1 mb-1");
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function buildPostFormBody() {
  const wrapper = createDIV("post-form");

  const topicLabel = createLabel("Topic (optional)", POST_TOPIC_ID, "form-label mt-2");
  const topicInput = createBootstrapTextInput(POST_TOPIC_ID, false, 255, "");

  const contentLabel = createLabel("Content", POST_TEXTAREA_ID, "form-label mt-3");
  const textarea = createBootstrapTextArea(POST_TEXTAREA_ID, 6, 65535, "", true);

  const toolbar = createDIV("post-toolbar d-flex flex-wrap mt-2");
  toolbar.appendChild(createToolbarButton("B", "Bold", () => wrapSelectionWithTag(textarea, "[b]", "[/b]")));
  toolbar.appendChild(createToolbarButton("I", "Italic", () => wrapSelectionWithTag(textarea, "[i]", "[/i]")));
  toolbar.appendChild(createToolbarButton("U", "Underline", () => wrapSelectionWithTag(textarea, "[u]", "[/u]")));
  toolbar.appendChild(createToolbarButton("1.", "Numbered list", () => wrapSelectionWithTag(textarea, "[ol][li]", "[/li][/ol]")));
  toolbar.appendChild(createToolbarButton("•", "Bullet list", () => wrapSelectionWithTag(textarea, "[ul][li]", "[/li][/ul]")));
  toolbar.appendChild(createToolbarButton("Link", "Insert link", () => wrapSelectionAsLink(textarea)));

  const previewLabel = createLabel("Preview", POST_PREVIEW_ID, "form-label mt-3");
  const previewPane = createDIV("post-preview border rounded p-2 bg-light");
  previewPane.id = POST_PREVIEW_ID;

  // Live preview: re-render on every keystroke using the same parser the
  // rest of the app uses to display saved posts, so what you see here is
  // what other users will see.
  textarea.addEventListener("input", () => {
    previewPane.textContent = "";
    renderPostContent(previewPane, textarea.value);
  });

  wrapper.appendChild(topicLabel);
  wrapper.appendChild(topicInput);
  wrapper.appendChild(contentLabel);
  wrapper.appendChild(toolbar);
  wrapper.appendChild(textarea);
  wrapper.appendChild(previewLabel);
  wrapper.appendChild(previewPane);

  return wrapper;
}

// Handle "add post" button — mirrors handleAddGallery() in GalleryFunctions.js
export async function handleAddPost() {
  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  showGenericModal({
    title: "Create Post",
    bodyElement: buildPostFormBody(),
    buttons: [
      { text: "Cancel", class: "btn-secondary", action: () => newHideModal("my_modal") },
      { hidden: true },
      { text: "Post", class: "btn-primary", action: executeCreatePost },
    ],
  });
}

// Execute create post — persists to `posts` via the create_post request
async function executeCreatePost() {
  const textarea = document.getElementById(POST_TEXTAREA_ID);
  const topicInput = document.getElementById(POST_TOPIC_ID);
  const errorField = document.getElementById("modal-alert-field");

  const content = (textarea?.value || "").trim();
  const topic = (topicInput?.value || "").trim();

  errorField.style.display = "none";

  if (content === "") {
    errorField.textContent = "Content is required.";
    errorField.style.display = "block";
    return;
  }

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    errorField.textContent = "Session token missing";
    errorField.style.display = "block";
    return;
  }

  try {
    const response = await createPost(topic, content, sessionToken);

    if (!response?.success || !response.data?.post) {
      errorField.textContent = response?.error || "Failed to create post";
      errorField.style.display = "block";
      return;
    }

    newHideModal("my_modal");
    showFeedback("Post created successfully");
  } catch (err) {
    console.error("Create post error:", err);
    errorField.textContent = "Failed to create post";
    errorField.style.display = "block";
  }
}

// Request wrapper — same shape as createContactMessage() in RequestFunctions.js
export async function createPost(topic, content, sessionToken) {
  const apiKey = await getSetting("api_key");
  return POSTJSONRequest({
    request: "create_post",
    api_key: apiKey,
    token: sessionToken,
    topic,
    content,
  });
}
