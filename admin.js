import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Set these two values from your Cloudinary dashboard.
const CLOUDINARY_CLOUD_NAME = "tm09bgcb";
const CLOUDINARY_UPLOAD_PRESET = "portfolio_covers";
const ADMIN_EMAIL = "dilshan4930@gmail.com";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.appId && firebaseConfig.projectId)
  && firebaseConfig.apiKey !== "PASTE_YOUR_FIREBASE_API_KEY"
  && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
const cloudinaryConfigured = CLOUDINARY_CLOUD_NAME !== "YOUR_CLOUDINARY_CLOUD_NAME"
  && CLOUDINARY_UPLOAD_PRESET !== "YOUR_UNSIGNED_UPLOAD_PRESET"
  && Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

const authCard = document.getElementById("authCard");
const dashboard = document.getElementById("dashboard");
const loginStatus = document.getElementById("loginStatus");
const formStatus = document.getElementById("formStatus");
const adminUser = document.getElementById("adminUser");
const imageFileInput = document.getElementById("projectImageFile");
const imageUrlInput = document.getElementById("projectImage");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const imagePreview = document.getElementById("imagePreview");
const imageUploadStatus = document.getElementById("imageUploadStatus");
const removeImageBtn = document.getElementById("removeImageBtn");

let auth = null;
let db = null;
let currentUser = null;
let projects = [];
let editingId = null;
let stopProjectsListener = null;
let selectedImageFile = null;
let previewObjectUrl = null;
let removeExistingImage = false;

const fields = {
  title: document.getElementById("projectTitle"),
  category: document.getElementById("projectCategory"),
  description: document.getElementById("projectDescription"),
  stack: document.getElementById("projectStack"),
  type: document.getElementById("projectType"),
  liveUrl: document.getElementById("projectLive"),
  repoUrl: document.getElementById("projectRepo"),
  featured: document.getElementById("projectFeatured")
};

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function showMessage(element, message, kind = "") {
  if (!element) return;
  element.textContent = message;
  element.className = `admin-message ${kind}`.trim();
}
function setImagePreview(url, message = "Current cover image", kind = "success") {
  if (url) {
    imagePreview.src = url;
    imagePreviewWrap.hidden = false;
    showMessage(imageUploadStatus, message, kind);
  } else {
    imagePreview.removeAttribute("src");
    imagePreviewWrap.hidden = true;
    showMessage(imageUploadStatus, message || "Choose an image to preview it here.");
  }
}
function clearSelectedFile() {
  selectedImageFile = null;
  if (imageFileInput) imageFileInput.value = "";
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
}
function resetForm() {
  editingId = null;
  removeExistingImage = false;
  clearSelectedFile();
  document.getElementById("projectForm").reset();
  imageUrlInput.value = "";
  setImagePreview("");
  document.getElementById("formTitle").textContent = "Add a project";
  document.getElementById("saveProjectBtn").textContent = "＋ Publish project";
  document.getElementById("cancelEdit").hidden = true;
  showMessage(formStatus, "");
}
function startEdit(project) {
  editingId = project.id;
  removeExistingImage = false;
  clearSelectedFile();
  fields.title.value = project.title || "";
  fields.category.value = project.category || "";
  fields.description.value = project.description || "";
  fields.stack.value = Array.isArray(project.stack) ? project.stack.join(", ") : "";
  fields.type.value = project.type || "Development";
  imageUrlInput.value = project.imageUrl || "";
  fields.liveUrl.value = project.liveUrl || "";
  fields.repoUrl.value = project.repoUrl || "";
  fields.featured.checked = Boolean(project.featured);
  setImagePreview(project.imageUrl || "", project.imageUrl ? "Current cover image. Choose another file to replace it." : "No cover image selected.");
  document.getElementById("formTitle").textContent = "Edit project";
  document.getElementById("saveProjectBtn").textContent = "Save changes";
  document.getElementById("cancelEdit").hidden = false;
  showMessage(formStatus, "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderProjects() {
  document.getElementById("projectCount").textContent = projects.length;
  document.getElementById("featuredCount").textContent = projects.filter(p => p.featured).length;
  document.getElementById("listSubtitle").textContent = `${projects.length} item${projects.length === 1 ? "" : "s"} in Firestore`;
  const list = document.getElementById("adminProjectList");
  if (!projects.length) {
    list.innerHTML = `<div class="list-placeholder"><span>▤</span><b>No projects added yet</b><p>Add your first project using the form.</p></div>`;
    return;
  }
  list.innerHTML = projects.map(project => `<article class="admin-project-item">
    <div class="admin-thumb">${project.imageUrl ? `<img src="${esc(project.imageUrl)}" alt="" onerror="this.style.display='none'">` : "▤"}</div>
    <div class="admin-project-details"><div class="admin-tags"><span>${esc(project.type || "Project")}</span>${project.featured ? `<span class="featured-tag">FEATURED</span>` : ""}</div>
    <h3>${esc(project.title)}</h3><p>${esc(project.category || "Project")} · ${esc((project.stack || []).slice(0,3).join(", "))}</p>
    <div class="item-actions"><button type="button" data-edit="${esc(project.id)}">✎ Edit</button><button type="button" class="delete-action" data-delete="${esc(project.id)}">⌫ Delete</button>${project.liveUrl ? `<a href="${esc(project.liveUrl)}" target="_blank" rel="noopener noreferrer">Demo ↗</a>` : ""}</div></div>
  </article>`).join("");
}
function listenToProjects() {
  if (stopProjectsListener) stopProjectsListener();
  const projectsQuery = query(collection(db, "projects"), orderBy("updatedAt", "desc"));
  stopProjectsListener = onSnapshot(projectsQuery, snapshot => {
    projects = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    projects.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    renderProjects();
  }, error => {
    console.error("Read projects failed:", error.code, error.message);
    showMessage(formStatus, `Could not read projects: ${error.code || error.message}`, "error");
  });
}

// Upload directly from the browser to Cloudinary using an unsigned preset.
// Never put your Cloudinary API secret in this file.
function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    if (!cloudinaryConfigured) {
      reject(new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in admin.js."));
      return;
    }
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    data.append("folder", "dilshan-portfolio/project-covers");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/image/upload`);
    xhr.upload.addEventListener("progress", event => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        showMessage(imageUploadStatus, `Uploading cover image… ${percent}%`);
      } else {
        showMessage(imageUploadStatus, "Uploading cover image to Cloudinary…");
      }
    });
    xhr.onload = () => {
      let result = {};
      try { result = JSON.parse(xhr.responseText || "{}"); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300 && result.secure_url) {
        resolve(result.secure_url);
      } else {
        const message = result?.error?.message || `Cloudinary upload failed (HTTP ${xhr.status}). Check cloud name and unsigned preset.`;
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading to Cloudinary. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Cloudinary upload was cancelled."));
    xhr.send(data);
  });
}

if (!configured) {
  showMessage(loginStatus, "Setup needed: add your actual Firebase Web App configuration to firebase-config.js.", "error");
  document.getElementById("loginBtn").disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) {
      authCard.hidden = true;
      dashboard.hidden = false;
      adminUser.hidden = false;
      document.getElementById("adminEmail").textContent = user.email || "Admin";
      document.getElementById("signedInAs").textContent = user.email || "Admin";
      listenToProjects();
    } else {
      if (stopProjectsListener) stopProjectsListener();
      stopProjectsListener = null;
      authCard.hidden = false;
      dashboard.hidden = true;
      adminUser.hidden = true;
      projects = [];
    }
  });
}

document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!auth) return;
  const button = document.getElementById("loginBtn");
  button.disabled = true;
  button.textContent = "Signing in…";
  showMessage(loginStatus, "");
  try {
    const credential = await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value.trim(), document.getElementById("loginPassword").value);
    await credential.user.reload();
    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user);
      showMessage(loginStatus, "Verification email sent. Verify your email, then sign in again.", "error");
      await signOut(auth);
    }
  } catch (error) {
    console.error("Sign-in failed:", error.code, error.message);
    showMessage(loginStatus, `Sign-in failed: ${error.code || error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Sign in securely →";
  }
});
document.getElementById("signOutBtn").addEventListener("click", () => signOut(auth));
document.getElementById("cancelEdit").addEventListener("click", resetForm);

imageFileInput.addEventListener("change", () => {
  const file = imageFileInput.files?.[0];
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    clearSelectedFile();
    showMessage(imageUploadStatus, "Choose a JPG, PNG, WEBP, or GIF image.", "error");
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    clearSelectedFile();
    showMessage(imageUploadStatus, "Image is larger than 5 MB. Choose a smaller file.", "error");
    return;
  }
  selectedImageFile = file;
  removeExistingImage = false;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  setImagePreview(previewObjectUrl, `${file.name} — ready to upload when you save.`, "success");
});
removeImageBtn.addEventListener("click", () => {
  clearSelectedFile();
  imageUrlInput.value = "";
  removeExistingImage = true;
  setImagePreview("", "Cover image will be removed when you save.");
});

document.getElementById("projectForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser || !db) {
    showMessage(formStatus, "Please sign in before saving a project.", "error");
    return;
  }
  const button = document.getElementById("saveProjectBtn");
  const payload = {
    title: fields.title.value.trim(),
    category: fields.category.value.trim() || "Project",
    description: fields.description.value.trim(),
    stack: fields.stack.value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 12),
    type: fields.type.value,
    imageUrl: imageUrlInput.value.trim(),
    liveUrl: fields.liveUrl.value.trim(),
    repoUrl: fields.repoUrl.value.trim(),
    featured: fields.featured.checked,
    updatedAt: serverTimestamp()
  };
  if (!payload.title || !payload.description) {
    showMessage(formStatus, "Title and description are required.", "error");
    return;
  }
  if (currentUser.email !== ADMIN_EMAIL) {
    showMessage(formStatus, `Access denied for ${currentUser.email}. Use the authorized admin account.`, "error");
    return;
  }

  button.disabled = true;
  button.textContent = selectedImageFile ? "Uploading image…" : "Saving…";
  showMessage(formStatus, "");
  try {
    await currentUser.reload();
    currentUser = auth.currentUser;
    const token = await currentUser.getIdTokenResult(true);
    if (!currentUser.emailVerified || token.claims.email_verified !== true) {
      showMessage(formStatus, "Please verify your admin email, sign out, and sign in again.", "error");
      return;
    }

    if (selectedImageFile) {
      showMessage(imageUploadStatus, "Preparing Cloudinary upload…");
      payload.imageUrl = await uploadToCloudinary(selectedImageFile);
      imageUrlInput.value = payload.imageUrl;
      setImagePreview(payload.imageUrl, "Image uploaded successfully to Cloudinary.", "success");
    } else if (removeExistingImage) {
      payload.imageUrl = "";
    }

    button.textContent = "Saving project…";
    const wasEditing = Boolean(editingId);
    if (wasEditing) {
      await updateDoc(doc(db, "projects", editingId), payload);
    } else {
      await addDoc(collection(db, "projects"), { ...payload, createdAt: serverTimestamp() });
    }
    resetForm();
    showMessage(formStatus, wasEditing ? "Project updated successfully." : "Project published successfully.", "success");
  } catch (error) {
    console.error("Project save / Cloudinary upload failed:", { code: error.code, message: error.message, projectId: firebaseConfig.projectId });
    showMessage(formStatus, `Save failed: ${error.message || error.code || "Unknown error"}`, "error");
    if (selectedImageFile) showMessage(imageUploadStatus, `Upload failed: ${error.message || "Check Cloudinary settings."}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = editingId ? "Save changes" : "＋ Publish project";
  }
});

document.getElementById("adminProjectList").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const project = projects.find(p => p.id === editButton.dataset.edit);
    if (project) startEdit(project);
  }
  if (deleteButton) {
    const project = projects.find(p => p.id === deleteButton.dataset.delete);
    if (!project || !confirm(`Delete "${project.title}" permanently?`)) return;
    try {
      await deleteDoc(doc(db, "projects", project.id));
      if (editingId === project.id) resetForm();
      showMessage(formStatus, "Project deleted.", "success");
    } catch (error) {
      console.error("Delete project failed:", error.code, error.message);
      showMessage(formStatus, `Delete failed (${error.code || "error"}): ${error.message}`, "error");
    }
  }
});

if (!cloudinaryConfigured) {
  console.warn("Cloudinary setup required: set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET near the top of admin.js.");
}
