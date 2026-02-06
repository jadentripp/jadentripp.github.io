(function () {
  var storageKey = "writer:draft:v1";
  var form = document.getElementById("writer-form");
  var title = document.getElementById("title");
  var date = document.getElementById("date");
  var slug = document.getElementById("slug");
  var tags = document.getElementById("tags");
  var excerpt = document.getElementById("excerpt");
  var coverImage = document.getElementById("cover_image");
  var markdown = document.getElementById("markdown");
  var published = document.getElementById("published");
  var status = document.getElementById("status");
  var errors = document.getElementById("errors");
  var preview = document.getElementById("preview");
  var validateBtn = document.getElementById("validate");
  var publishBtn = document.getElementById("publish");
  var clearBtn = document.getElementById("clear-draft");
  var coverUpload = document.getElementById("cover-upload");
  var dropzone = document.getElementById("dropzone");
  var excerptCount = document.getElementById("excerpt-count");

  if (!form) return;

  var debounceTimer = null;

  var slugify = function (value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/["']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled";
  };

  var toPayload = function () {
    return {
      title: title.value,
      date: date.value,
      slug: slug.value,
      tags: tags.value,
      excerpt: excerpt.value,
      cover_image: coverImage.value,
      published: published.checked,
      markdown: markdown.value
    };
  };

  var setStatus = function (message) {
    status.textContent = message;
  };

  var renderErrors = function (messages) {
    errors.innerHTML = "";
    if (!messages || !messages.length) return;

    messages.forEach(function (message) {
      var li = document.createElement("li");
      li.textContent = message;
      errors.appendChild(li);
    });
  };

  var setExcerptCount = function () {
    excerptCount.textContent = excerpt.value.length + " characters";
  };

  var saveDraft = function () {
    localStorage.setItem(storageKey, JSON.stringify(toPayload()));
    setStatus("Draft saved locally at " + new Date().toLocaleTimeString());
  };

  var restoreDraft = function () {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      title.value = parsed.title || "";
      date.value = parsed.date || "";
      slug.value = parsed.slug || "";
      tags.value = parsed.tags || "";
      excerpt.value = parsed.excerpt || "";
      coverImage.value = parsed.cover_image || "";
      published.checked = parsed.published !== false;
      markdown.value = parsed.markdown || "";
      setStatus("Draft restored from local save.");
    } catch (_error) {
      setStatus("Could not restore previous draft.");
    }
  };

  var resetDraft = function () {
    localStorage.removeItem(storageKey);
    form.reset();
    published.checked = true;
    date.value = new Date().toISOString().slice(0, 10);
    renderErrors([]);
    setExcerptCount();
    setStatus("Draft cleared.");
    runPreview();
  };

  var requestJson = async function (url, payload) {
    var response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    var data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  };

  var runPreview = async function () {
    try {
      var data = await requestJson("/__writer/preview", { markdown: markdown.value });
      preview.innerHTML = data.html || '<p class="placeholder">Preview updates as you type.</p>';
    } catch (error) {
      preview.innerHTML = '<p class="placeholder">Preview unavailable: ' + error.message + "</p>";
    }
  };

  var runValidate = async function () {
    try {
      var data = await requestJson("/__writer/validate", toPayload());
      renderErrors(data.errors || []);
      if (data.normalized) {
        if (!slug.value && data.normalized.slug) slug.value = data.normalized.slug;
        if (!date.value && data.normalized.date) date.value = data.normalized.date;
      }
      if (data.valid) {
        setStatus("Validation passed.");
      }
      return data;
    } catch (error) {
      renderErrors([error.message]);
      return { valid: false, errors: [error.message] };
    }
  };

  var publish = async function () {
    publishBtn.disabled = true;
    setStatus("Publishing...");

    try {
      var validation = await runValidate();
      if (!validation.valid) {
        setStatus("Fix the validation errors before publishing.");
        return;
      }

      var data = await requestJson("/__writer/publish", toPayload());
      renderErrors([]);
      localStorage.removeItem(storageKey);
      setStatus("Published: " + data.file);
      if (data.url) {
        var link = document.createElement("a");
        link.href = data.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "Open published post";
        errors.innerHTML = "";
        var li = document.createElement("li");
        li.style.color = "#2f7a45";
        li.appendChild(link);
        errors.appendChild(li);
      }
    } catch (error) {
      renderErrors([error.message]);
      setStatus("Publish failed.");
    } finally {
      publishBtn.disabled = false;
    }
  };

  var queuePreviewAndAutosave = function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      runPreview();
      saveDraft();
    }, 350);
  };

  var uploadFile = async function (file, applyToCover) {
    var formData = new FormData();
    formData.append("file", file);

    try {
      setStatus("Uploading image...");
      var response = await fetch("/__writer/upload-image", {
        method: "POST",
        body: formData
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");

      if (applyToCover || !coverImage.value) {
        coverImage.value = data.path;
      }

      var start = markdown.selectionStart;
      var end = markdown.selectionEnd;
      var prefix = markdown.value.slice(0, start);
      var suffix = markdown.value.slice(end);
      var imageBlock = "\n\n![](" + data.path + ")\n\n";
      markdown.value = prefix + imageBlock + suffix;

      setStatus("Uploaded image: " + data.path);
      queuePreviewAndAutosave();
    } catch (error) {
      renderErrors([error.message]);
      setStatus("Image upload failed.");
    }
  };

  title.addEventListener("input", function () {
    if (!slug.dataset.manual || slug.dataset.manual !== "true") {
      slug.value = slugify(title.value);
    }
    queuePreviewAndAutosave();
  });

  slug.addEventListener("input", function () {
    slug.dataset.manual = slug.value ? "true" : "false";
    queuePreviewAndAutosave();
  });

  [date, tags, excerpt, coverImage, markdown, published].forEach(function (field) {
    field.addEventListener("input", function () {
      setExcerptCount();
      queuePreviewAndAutosave();
    });
    field.addEventListener("change", function () {
      setExcerptCount();
      queuePreviewAndAutosave();
    });
  });

  validateBtn.addEventListener("click", function () {
    runValidate();
  });

  publishBtn.addEventListener("click", function () {
    publish();
  });

  clearBtn.addEventListener("click", function () {
    if (confirm("Clear the local draft and form fields?")) {
      resetDraft();
    }
  });

  coverUpload.addEventListener("change", function () {
    var file = coverUpload.files && coverUpload.files[0];
    if (file) uploadFile(file, true);
    coverUpload.value = "";
  });

  dropzone.addEventListener("dragover", function (event) {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });

  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("is-dragging");
  });

  dropzone.addEventListener("drop", function (event) {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) uploadFile(file, false);
  });

  document.addEventListener("keydown", function (event) {
    var isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
    var isPublish = (event.ctrlKey || event.metaKey) && event.key === "Enter";

    if (isSave) {
      event.preventDefault();
      saveDraft();
      runPreview();
    }

    if (isPublish) {
      event.preventDefault();
      publish();
    }
  });

  restoreDraft();
  if (!date.value) date.value = new Date().toISOString().slice(0, 10);
  if (!slug.value && title.value) slug.value = slugify(title.value);
  setExcerptCount();
  runPreview();
})();
