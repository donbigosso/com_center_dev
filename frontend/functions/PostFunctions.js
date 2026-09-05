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
 *
 * Dedicated create page:
 *   frontend/create_post.html?page=TRIP&include_media=yes
 */

export const MAX_POST_MEDIA = 5;
export const POST_PAGE_ENUMS = ["TRIP", "BLOG", "ABOUT"];

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
    media: `post-media-picker-${n}`,
  };
}

function defaultCaptionFromFilename(filename) {
  const base = String(filename || "picture").replace(/\.[^.]+$/, "");
  return base.slice(0, 255);
}

/**
 * Inline picture picker for create-post: caption + file, max N items.
 * Description is intentionally omitted; caption maps to media_items.title.
 */
function buildPostMediaPicker(ids, maxMedia = MAX_POST_MEDIA) {
  const items = [];
  let seq = 0;

  const section = createDIV("post-media-picker mt-4");
  const heading = createLabel(
    `Pictures (optional, up to ${maxMedia})`,
    ids.media,
    "form-label"
  );
  const hint = createDIV("post-media-picker-hint");
  hint.textContent = "Each picture needs a caption. No description is stored.";

  const list = createDIV("post-media-picker-list");
  list.id = ids.media;

  const fileInput = createHTMLelement("input", "d-none");
  fileInput.type = "file";
  fileInput.accept = "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp";
  fileInput.multiple = true;

  const addBtn = createButton("button", "Add picture", "btn btn-sm btn-outline-secondary post-media-add-btn");
  addBtn.type = "button";

  const updateAddState = () => {
    const remaining = maxMedia - items.length;
    addBtn.disabled = remaining <= 0;
    addBtn.textContent = remaining <= 0 ? "Picture limit reached" : "Add picture";
    fileInput.multiple = remaining > 1;
  };

  const removeItem = (itemId) => {
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const [removed] = items.splice(index, 1);
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    const row = list.querySelector(`[data-media-slot="${itemId}"]`);
    if (row) row.remove();
    updateAddState();
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const remaining = maxMedia - items.length;
    incoming.slice(0, remaining).forEach((file) => {
      seq += 1;
      const itemId = `${ids.media}-${seq}`;
      const previewUrl = URL.createObjectURL(file);
      const item = {
        id: itemId,
        file,
        caption: defaultCaptionFromFilename(file.name),
        previewUrl,
      };
      items.push(item);

      const row = createDIV("post-media-slot");
      row.dataset.mediaSlot = itemId;

      const preview = createHTMLelement("img", "post-media-slot-preview");
      preview.src = previewUrl;
      preview.alt = item.caption;

      const fields = createDIV("post-media-slot-fields");
      const captionId = `${itemId}-caption`;
      const captionLabel = createLabel("Caption", captionId, "form-label");
      const captionInput = createBootstrapTextInput(captionId, true, 255, item.caption);
      captionInput.addEventListener("input", () => {
        item.caption = captionInput.value;
      });

      const removeBtn = createButton("button", "Remove", "btn btn-sm btn-outline-danger post-media-slot-remove");
      removeBtn.type = "button";
      removeBtn.addEventListener("click", () => removeItem(itemId));

      fields.appendChild(captionLabel);
      fields.appendChild(captionInput);
      fields.appendChild(removeBtn);
      row.appendChild(preview);
      row.appendChild(fields);
      list.appendChild(row);
    });
    updateAddState();
  };

  addBtn.addEventListener("click", () => {
    if (items.length >= maxMedia) return;
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });

  section.appendChild(heading);
  section.appendChild(hint);
  section.appendChild(list);
  section.appendChild(fileInput);
  section.appendChild(addBtn);
  updateAddState();

  return {
    element: section,
    getItems: () =>
      items.map((item) => ({
        file: item.file,
        caption: (item.caption || "").trim(),
      })),
    reset: () => {
      [...items].forEach((item) => removeItem(item.id));
    },
  };
}

async function submitPostFromIds(ids, errorField, extras = {}) {
  const textarea = document.getElementById(ids.textarea);
  const topicInput = document.getElementById(ids.topic);
  const content = (textarea?.value || "").trim();
  const topic = (topicInput?.value || "").trim();
  const mediaItems = typeof extras.getMediaItems === "function" ? extras.getMediaItems() : [];

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

  if (mediaItems.length > MAX_POST_MEDIA) {
    if (errorField) {
      errorField.textContent = `A post can have at most ${MAX_POST_MEDIA} pictures.`;
      errorField.style.display = "block";
    }
    return null;
  }

  for (const item of mediaItems) {
    const caption = (item.caption || "").trim();
    if (!item.file) {
      if (errorField) {
        errorField.textContent = "Each picture needs a file.";
        errorField.style.display = "block";
      }
      return null;
    }
    if (caption === "") {
      if (errorField) {
        errorField.textContent = "Each picture needs a caption.";
        errorField.style.display = "block";
      }
      return null;
    }
  }

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    if (errorField) {
      errorField.textContent = "Session token missing";
      errorField.style.display = "block";
    }
    return null;
  }

  const response = await createPost(topic, content, sessionToken, extras.page || null);
  if (!response?.success || !response.data?.post) {
    if (errorField) {
      errorField.textContent = response?.error || "Failed to create post";
      errorField.style.display = "block";
    }
    return null;
  }

  const post = response.data.post;
  const postId = post.post_id;
  const uploadedMedia = [];

  for (const item of mediaItems) {
    const upload = await uploadPostMedia({
      postId,
      caption: (item.caption || "").trim(),
      file: item.file,
      sessionToken,
    });
    if (!upload?.success || !upload.data?.media) {
      if (errorField) {
        errorField.textContent =
          upload?.error ||
          "Post was created but a picture failed to upload. You can try again with a new post.";
        errorField.style.display = "block";
      }
      post.media = uploadedMedia;
      return post;
    }
    uploadedMedia.push(upload.data.media);
  }

  if (uploadedMedia.length > 0) {
    const refreshed = await getPost(postId);
    if (refreshed?.success && refreshed.data?.post) {
      return refreshed.data.post;
    }
    post.media = uploadedMedia;
  }

  return post;
}

/**
 * Mount a create-post form into any container.
 * @param {HTMLElement} container
 * @param {{
 *   onCreated?: (post: object) => void,
 *   showSubmit?: boolean,
 *   page?: string|null,
 *   includeMedia?: boolean,
 *   maxMedia?: number,
 * }} [opts]
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

  const includeMedia = Boolean(opts.includeMedia);
  const maxMedia = Number(opts.maxMedia) > 0 ? Number(opts.maxMedia) : MAX_POST_MEDIA;
  let mediaPicker = null;

  if (includeMedia) {
    mediaPicker = buildPostMediaPicker(ids, maxMedia);
    form.appendChild(mediaPicker.element);
  }

  if (opts.showSubmit !== false) {
    const submit = createButton("button", "Post", "btn btn-primary mt-3");
    submit.addEventListener("click", async () => {
      const sessionTest = await verifySession();
      if (!sessionTest) {
        showFeedback("You must be logged in");
        return;
      }
      const originalLabel = submit.textContent;
      submit.disabled = true;
      submit.textContent = includeMedia ? "Publishing…" : "Posting…";
      try {
        const post = await submitPostFromIds(ids, alert, {
          page: opts.page || null,
          getMediaItems: mediaPicker ? mediaPicker.getItems : null,
        });
        if (!post) return;
        const mediaFailed = alert.style.display === "block";
        showFeedback(mediaFailed ? "Post created, but some pictures failed" : "Post created successfully");
        if (!mediaFailed) {
          const topicInput = document.getElementById(ids.topic);
          const textarea = document.getElementById(ids.textarea);
          const previewPane = document.getElementById(ids.preview);
          if (topicInput) topicInput.value = "";
          if (textarea) textarea.value = "";
          if (previewPane) previewPane.replaceChildren();
          if (mediaPicker) mediaPicker.reset();
        }
        if (typeof opts.onCreated === "function") {
          opts.onCreated(post);
        }
      } catch (err) {
        console.error("Create post error:", err);
        alert.textContent = "Failed to create post";
        alert.style.display = "block";
      } finally {
        submit.disabled = false;
        submit.textContent = originalLabel;
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

export async function createPost(topic, content, sessionToken, page = null) {
  const apiKey = await getSetting("api_key");
  const payload = {
    request: "create_post",
    api_key: apiKey,
    token: sessionToken,
    topic,
    content,
  };
  if (page) {
    payload.page = page;
  }
  return POSTJSONRequest(payload);
}

export async function listPostPages() {
  return fetchAPIdataWGetParams({
    request: "list_post_pages",
  });
}

export async function uploadPostMedia({ postId, caption, file, sessionToken }) {
  const apiAddress = await getSetting("api_address");
  if (!apiAddress) {
    return { success: false, error: "API address is not configured." };
  }

  const formData = new FormData();
  formData.append("request", "upload_post_media");
  formData.append("token", sessionToken);
  formData.append("post_id", String(postId));
  formData.append("caption", caption);
  formData.append("title", caption);
  formData.append("file", file);

  const response = await fetch(apiAddress, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  return response.json();
}

export async function getPost(postId) {
  return fetchAPIdataWGetParams({
    request: "get_post",
    id: postId,
  });
}

export async function listPosts({ page = 1, limit = 20, user = null, onPage = null } = {}) {
  const params = {
    request: "list_posts",
    page,
    limit,
  };
  if (user) {
    params.user = user;
  }
  if (onPage) {
    params.on_page = onPage;
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

  const caption = createDIV("post-image-viewer-caption");
  caption.id = "post-image-viewer-caption";

  const close = () => {
    root.classList.remove("is-open");
    img.src = "";
    img.alt = "";
    caption.textContent = "";
    caption.classList.add("d-none");
  };
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-open")) close();
  });

  root.appendChild(backdrop);
  root.appendChild(img);
  root.appendChild(caption);
  root.appendChild(closeBtn);
  document.body.appendChild(root);
  return root;
}

function openPostImageViewer(fullUrl, title) {
  const root = ensurePostImageViewer();
  const img = document.getElementById("post-image-viewer-img");
  const caption = document.getElementById("post-image-viewer-caption");
  img.src = fullUrl;
  img.alt = title || "";
  if (caption) {
    caption.textContent = title || "";
    caption.classList.toggle("d-none", !title);
  }
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
    if (mediaItem.title) {
      const caption = createHTMLelement("span", "post-media-pic-title");
      caption.textContent = mediaItem.title;
      tile.appendChild(caption);
    }
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
