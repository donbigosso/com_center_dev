import { POSTJSONRequest, fetchAPIdataWGetParams, getSetting } from "./CoreFunctions.js";
import { getSessionToken, showFeedback } from "./CustomFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";
import { newHideModal, createDIV, createLabel, createBootstrapTextInput, createBootstrapTextArea, createButton, createHTMLelement } from "./PageAppearance.js";
import { verifySession } from "./RequestFunctions.js";
import { renderPostContent } from "./PostContentFunctions.js";
import { createPictureWrapper, getGalleryFolder } from "./GalleryFunctions.js";

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

// Bootstrap Icons class per media_items.media_type (VID/YT — PIC gets a real thumbnail instead).
function mediaTypeIcon(mediaType) {
  switch (mediaType) {
    case "VID":
      return "bi-camera-reels";
    case "YT":
      return "bi-youtube";
    default:
      return "bi-image";
  }
}

// Simple, single-image fullscreen viewer for post pictures. Unlike the
// gallery lightbox this has no prev/next navigation and never touches the
// address bar — it just shows the one picture that was clicked.
function ensurePostImageViewer() {
  let root = document.getElementById("post-image-viewer");
  if (root) return root;

  root = createDIV("post-image-viewer");
  root.id = "post-image-viewer";

  const backdrop = createDIV("post-image-viewer-backdrop");
  const img = createHTMLelement("img", "post-image-viewer-img");
  img.id = "post-image-viewer-img";
  img.alt = "";

  const closeBtn = createButton("button", "\u00d7", "btn post-image-viewer-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");

  const close = () => {
    root.classList.remove("is-open");
    img.src = "";
  };
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-open")) close();
  });

  root.appendChild(backdrop);
  root.appendChild(img);
  root.appendChild(closeBtn);
  document.body.appendChild(root);
  return root;
}

function openPostImageViewer(fullUrl, title) {
  const root = ensurePostImageViewer();
  const img = document.getElementById("post-image-viewer-img");
  img.src = fullUrl;
  img.alt = title || "";
  root.classList.add("is-open");
}

// Media tile shown under a post's content: a real 200x200 thumbnail for
// pictures (click opens the fullscreen viewer above), or an icon+title
// tile for non-picture media (video/YouTube) and pictures with no file
// on disk.
function createPostMediaTile(mediaItem, folder) {
  const col = createDIV("col-auto");

  const isPicture = mediaItem?.media_type === "PIC" && mediaItem?.miniature_filename && mediaItem?.filename && folder;

  if (isPicture) {
    const thumbUrl = `${folder}${encodeURIComponent(mediaItem.miniature_filename)}`;
    const fullUrl = `${folder}${encodeURIComponent(mediaItem.filename)}`;

    const tile = createDIV("post-media-pic-tile");
    const img = createHTMLelement("img", "post-media-pic-img");
    img.src = thumbUrl;
    img.alt = mediaItem.title || "Attached picture";
    img.loading = "lazy";
    img.decoding = "async";

    tile.setAttribute("role", "button");
    tile.tabIndex = 0;
    tile.title = mediaItem.title || "Open full size";
    const open = () => openPostImageViewer(fullUrl, mediaItem.title);
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    tile.appendChild(img);
    col.appendChild(tile);
    return col;
  }

  const tile = createDIV("post-media-tile d-flex align-items-center");
  const icon = createHTMLelement("i", `bi ${mediaTypeIcon(mediaItem?.media_type)} post-media-tile-icon`);
  const title = createHTMLelement("span", "post-media-tile-title");
  title.textContent = mediaItem?.title || "Untitled";

  tile.appendChild(icon);
  tile.appendChild(title);
  col.appendChild(tile);
  return col;
}

/**
 * Same as renderPostCard(), plus a row of media tiles for anything
 * attached to the post via the media_in_post table (post.media, populated
 * server-side by get_post / list_posts). Pictures render as a real
 * 200x200 thumbnail that opens a single-image fullscreen viewer on click
 * (no browsing between pictures, no address-bar changes); video/YouTube
 * items fall back to an icon+title tile. Returns a plain post card,
 * unchanged, when the post has no attached media.
 * @param {object} post
 * @returns {Promise<HTMLElement>}
 */
export async function renderPostCardWithMedia(post) {
  const card = renderPostCard(post);

  const media = Array.isArray(post?.media) ? post.media : [];
  if (media.length === 0) {
    return card;
  }

  const folder = await getGalleryFolder();

  const mediaSection = createDIV("post-media-section mt-3");
  const mediaLabel = createDIV("post-media-label");
  mediaLabel.textContent = "Attached media";
  const mediaRow = createPictureWrapper();
  mediaRow.classList.add("post-media-row");

  media.forEach((mediaItem) => {
    mediaRow.appendChild(createPostMediaTile(mediaItem, folder));
  });

  mediaSection.appendChild(mediaLabel);
  mediaSection.appendChild(mediaRow);
  card.appendChild(mediaSection);

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
