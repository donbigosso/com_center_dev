import { POSTJSONRequest, fetchAPIdataWGetParams, getSetting } from "./CoreFunctions.js";
import { getSessionToken, showFeedback } from "./CustomFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";
import { newHideModal, createDIV, createLabel, createBootstrapTextInput, createBootstrapTextArea, createButton } from "./PageAppearance.js";
import { verifySession } from "./RequestFunctions.js";
import { renderPostContent } from "./PostContentFunctions.js";

/*
 * Post formatting reference
 * -------------------------
 *   [b]bold[/b]  [i]italic[/i]  [u]underline[/u]
 *   [ol][li]first[/li][/ol]   [ul][li]first[/li][/ul]
 *   [url=https://example.com]link text[/url]
 *
 * Usage on any page:
 *   import { createPostForm, renderPost, handleAddPost } from "./functions/PostFunctions.js";
 *   createPostForm(document.getElementById("form-slot"));
 *   renderPost(document.getElementById("post-slot"), 12);
 *   handleAddPost(); // modal, same as galleries
 */

let postFormSeq = 0;

function wrapSelectionWithTag(textarea, openTag, closeTag) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  textarea.value = value.slice(0, start) + openTag + selected + closeTag + value.slice(end);

  const caretStart = start + openTag.length;
  textarea.focus();
  textarea.setSelectionRange(caretStart, caretStart + selected.length);
  textarea.dispatchEvent(new Event("input"));
}

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

function buildPostFormBody(ids) {
  const wrapper = createDIV("post-form");

  const topicLabel = createLabel("Topic (optional)", ids.topic, "form-label mt-2");
  const topicInput = createBootstrapTextInput(ids.topic, false, 255, "");

  const contentLabel = createLabel("Content", ids.textarea, "form-label mt-3");
  const textarea = createBootstrapTextArea(ids.textarea, 6, 65535, "", true);

  const toolbar = createDIV("post-toolbar d-flex flex-wrap mt-2");
  toolbar.appendChild(createToolbarButton("B", "Bold", () => wrapSelectionWithTag(textarea, "[b]", "[/b]")));
  toolbar.appendChild(createToolbarButton("I", "Italic", () => wrapSelectionWithTag(textarea, "[i]", "[/i]")));
  toolbar.appendChild(createToolbarButton("U", "Underline", () => wrapSelectionWithTag(textarea, "[u]", "[/u]")));
  //toolbar.appendChild(createToolbarButton("1.", "Numbered list", () => wrapSelectionWithTag(textarea, "[ol][li]", "[/li][/ol]")));
  //toolbar.appendChild(createToolbarButton("•", "Bullet list", () => wrapSelectionWithTag(textarea, "[ul][li]", "[/li][/ul]")));
  toolbar.appendChild(createToolbarButton("Link", "Insert link", () => wrapSelectionAsLink(textarea)));

  const previewLabel = createLabel("Preview", ids.preview, "form-label mt-3");
  const previewPane = createDIV("post-preview border rounded p-2 bg-light");
  previewPane.id = ids.preview;

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

function nextFormIds() {
  postFormSeq += 1;
  const n = postFormSeq;
  return {
    topic: `post-topic-input-${n}`,
    textarea: `post-content-textarea-${n}`,
    preview: `post-preview-pane-${n}`,
    alert: `post-form-alert-${n}`,
  };
}

async function submitPostFromIds(ids, errorField) {
  const textarea = document.getElementById(ids.textarea);
  const topicInput = document.getElementById(ids.topic);
  const content = (textarea?.value || "").trim();
  const topic = (topicInput?.value || "").trim();

  if (errorField) {
    errorField.style.display = "none";
    errorField.textContent = "";
  }

  if (content === "") {
    if (errorField) {
      errorField.textContent = "Content is required.";
      errorField.style.display = "block";
    }
    return null;
  }

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    if (errorField) {
      errorField.textContent = "Session token missing";
      errorField.style.display = "block";
    }
    return null;
  }

  const response = await createPost(topic, content, sessionToken);
  if (!response?.success || !response.data?.post) {
    if (errorField) {
      errorField.textContent = response?.error || "Failed to create post";
      errorField.style.display = "block";
    }
    return null;
  }

  return response.data.post;
}

/**
 * Mount a create-post form into any container.
 * @param {HTMLElement} container
 * @param {{ onCreated?: (post: object) => void, showSubmit?: boolean }} [opts]
 * @returns {{ form: HTMLElement, ids: object } | null}
 */
export function createPostForm(container, opts = {}) {
  if (!(container instanceof HTMLElement)) {
    return null;
  }

  const ids = nextFormIds();
  const form = buildPostFormBody(ids);
  const alert = createDIV("alert alert-danger mt-2");
  alert.id = ids.alert;
  alert.style.display = "none";
  form.appendChild(alert);

  if (opts.showSubmit !== false) {
    const submit = createButton("button", "Post", "btn btn-primary mt-3");
    submit.addEventListener("click", async () => {
      const sessionTest = await verifySession();
      if (!sessionTest) {
        showFeedback("You must be logged in");
        return;
      }
      try {
        const post = await submitPostFromIds(ids, alert);
        if (!post) return;
        showFeedback("Post created successfully");
        if (typeof opts.onCreated === "function") {
          opts.onCreated(post);
        }
      } catch (err) {
        console.error("Create post error:", err);
        alert.textContent = "Failed to create post";
        alert.style.display = "block";
      }
    });
    form.appendChild(submit);
  }

  container.appendChild(form);
  return { form, ids };
}

export async function handleAddPost() {
  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  const ids = nextFormIds();
  showGenericModal({
    title: "Create Post",
    bodyElement: buildPostFormBody(ids),
    buttons: [
      { text: "Cancel", class: "btn-secondary", action: () => newHideModal("my_modal") },
      { hidden: true },
      {
        text: "Post",
        class: "btn-primary",
        action: async () => {
          const errorField = document.getElementById("modal-alert-field");
          try {
            const post = await submitPostFromIds(ids, errorField);
            if (!post) return;
            newHideModal("my_modal");
            showFeedback("Post created successfully");
          } catch (err) {
            console.error("Create post error:", err);
            if (errorField) {
              errorField.textContent = "Failed to create post";
              errorField.style.display = "block";
            }
          }
        },
      },
    ],
  });
}

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

export async function getPost(postId) {
  return fetchAPIdataWGetParams({
    request: "get_post",
    id: postId,
  });
}

export async function listPosts({ page = 1, limit = 20, user = null } = {}) {
  const params = {
    request: "list_posts",
    page,
    limit,
  };
  if (user) {
    params.user = user;
  }
  return fetchAPIdataWGetParams(params);
}

export function renderPostCard(post) {
  const card = createDIV("post-card border rounded p-3 mb-3");
  if (post?.topic) {
    const title = document.createElement("h3");
    title.className = "post-topic h5";
    title.textContent = post.topic;
    card.appendChild(title);
  }

  const meta = createDIV("post-meta text-muted small mb-2");
  const bits = [];
  if (post?.author) bits.push(post.author);
  if (post?.date_added) bits.push(post.date_added);
  meta.textContent = bits.join(" · ");
  card.appendChild(meta);

  const body = createDIV("post-body");
  renderPostContent(body, post?.content || "");
  card.appendChild(body);
  return card;
}

/**
 * Fetch one post by id and render it into any container.
 * @param {HTMLElement} container
 * @param {number|string} postId
 * @returns {Promise<object|null>}
 */
export async function renderPost(container, postId) {
  if (!(container instanceof HTMLElement)) {
    return null;
  }

  container.replaceChildren();
  const response = await getPost(postId);
  const post = response?.data?.post;

  if (!response?.success || !post) {
    const err = createDIV("alert alert-warning");
    err.textContent = response?.error || "Post not found.";
    container.appendChild(err);
    return null;
  }

  container.appendChild(renderPostCard(post));
  return post;
}
