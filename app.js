import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig, portfolioSettings } from "./firebase-config.js";

const configured = firebaseConfig.apiKey !== "PASTE_YOUR_FIREBASE_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID" && Boolean(firebaseConfig.appId);
let db = null;
if (configured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("emailText").textContent = portfolioSettings.email;
document.getElementById("emailLink").href = `mailto:${portfolioSettings.email}`;
document.getElementById("linkedinLink").href = portfolioSettings.linkedin;
document.getElementById("githubLink").href = portfolioSettings.github;

const fallbackProjects = [
  { id:"sample-1", title:"C Café — Commerce & Operations App", category:"Mobile application", description:"A café app concept connecting customer ordering with product management, cart, checkout and administration workflows.", stack:["Android","Java","Firebase"], type:"Development", visual:"cafe", featured:true },
  { id:"sample-2", title:"Smart Chat", category:"Mobile application", description:"A messaging app project exploring conversations, authentication and a clean mobile-first user experience.", stack:["React Native","Expo","Firebase"], type:"Development", visual:"chat" },
  { id:"sample-3", title:"Bee Chat — Product UI/UX", category:"UX case study", description:"A messaging experience prototype focused on clear navigation, readable conversations and consistent interface patterns.", stack:["Figma","Wireframes","Prototyping"], type:"Design", visual:"design" },
  { id:"sample-4", title:"Auto Care Service Center System", category:"Business system", description:"A service-centre system concept for organising customer, vehicle and service information in a structured workflow.", stack:["Java","MySQL","System design"], type:"Systems", visual:"system" },
  { id:"sample-5", title:"Employee Workflow Automation", category:"IT solution concept", description:"A proposed spreadsheet workflow for managing employee records and routing relevant entries into a separate VOP list.", stack:["Excel","Workflow design","Automation"], type:"Systems", visual:"automation" },
  { id:"sample-6", title:"Nerdtech Company Website", category:"Responsive web", description:"A company website project focused on clear content hierarchy, responsive layouts and straightforward navigation.", stack:["HTML","Bootstrap","CSS"], type:"Development", visual:"web" }
];
let allProjects = fallbackProjects;
let activeFilter = "All";

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function visualMarkup(project) {
  if (project.imageUrl) return `<div class="project-remote-image"><img src="${escapeHTML(project.imageUrl)}" alt="${escapeHTML(project.title)} preview" loading="lazy"></div>`;
  const visual = ["cafe","chat","design","system","automation","web"].includes(project.visual) ? project.visual : (project.type === "Design" ? "design" : project.type === "Systems" ? "system" : "web");
  const content = {
    cafe: `<div class="cafe-label">CAFÉ / ORDERING</div><div class="cafe-orb">C</div><b>Good coffee.<br>Better workflow.</b><div class="cafe-bars"><i></i><i></i><i></i></div>`,
    chat: `<div class="chat-preview"><div class="avatar">S</div><div><b>Team workspace</b><small>Messages, organised.</small></div><div class="bubble"></div><div class="bubble bubble-b"></div><div class="bubble bubble-c"></div></div>`,
    design: `<div class="design-preview"><div class="design-sidebar"></div><div class="design-content"><div></div><div></div><div></div><div></div></div><div class="design-phone"><i></i><i></i><i></i></div></div>`,
    system: `<div class="system-preview"><div class="system-nav"></div><div class="system-main"><b>Service overview</b><div class="metric-row"><i></i><i></i><i></i></div><div class="chart-lines"><span></span><span></span><span></span><span></span><span></span></div></div></div>`,
    automation: `<div class="automation-preview"><div class="flow-node">Employee DB</div><span>↓</span><div class="flow-node flow-active">Validation</div><span>↓</span><div class="flow-node">VOP list</div></div>`,
    web: `<div class="web-preview"><div class="web-heading"></div><div class="web-line"></div><div class="web-line short"></div><div class="web-blocks"><i></i><i></i><i></i></div></div>`
  }[visual];
  return `<div class="project-visual visual-${visual}"><div class="mock-window"><div class="mock-top"><span></span><span></span><span></span><i>PROJECT PREVIEW</i></div><div class="mock-content">${content}</div></div></div>`;
}
function renderProjects() {
  const filtered = activeFilter === "All" ? allProjects : allProjects.filter(p => p.type === activeFilter);
  document.getElementById("countAll").textContent = allProjects.length;
  ["Development","Design","Systems"].forEach(type => {
    document.getElementById(`count${type}`).textContent = allProjects.filter(p => p.type === type).length;
  });
  const grid = document.getElementById("projectGrid");
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-projects"><b>New work is on the way.</b><span>Projects will appear here when published.</span></div>`;
    return;
  }
  grid.innerHTML = filtered.map((p, index) => {
    const tags = Array.isArray(p.stack) ? p.stack : [];
    const links = `${p.liveUrl ? `<a href="${escapeHTML(p.liveUrl)}" target="_blank" rel="noopener noreferrer">Live demo ↗</a>` : ""}${p.repoUrl ? `<a href="${escapeHTML(p.repoUrl)}" target="_blank" rel="noopener noreferrer">Source code ↗</a>` : ""}`;
    return `<article class="project-card">${visualMarkup(p)}<div class="project-info"><div class="project-overline"><span>${escapeHTML(p.category || "Project")}</span><span>${String(index+1).padStart(2,"0")}${p.featured ? " · FEATURED" : ""}</span></div><h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.description)}</p><div class="tag-row">${tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join("")}</div><div class="public-project-links">${links}</div><a class="project-link" href="#contact">Discuss this project <span>↗</span></a></div></article>`;
  }).join("");
}
document.getElementById("filters").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach(el => el.classList.toggle("active", el === button));
  renderProjects();
});
document.getElementById("mobileMenu").addEventListener("click", () => {
  const nav = document.getElementById("mainNav");
  const opened = nav.classList.toggle("nav-open");
  document.getElementById("mobileMenu").setAttribute("aria-expanded", String(opened));
});
document.querySelectorAll("#mainNav a").forEach(link => link.addEventListener("click", () => document.getElementById("mainNav").classList.remove("nav-open")));

if (db) {
  onSnapshot(collection(db, "projects"), snapshot => {
    const records = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
    records.sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    allProjects = records;
    renderProjects();
  }, error => {
    console.error("Project loading failed:", error);
    allProjects = fallbackProjects;
    renderProjects();
  });
} else {
  allProjects = fallbackProjects;
  renderProjects();
  const note = document.createElement("p");
  note.className = "config-note";
  note.textContent = "Preview mode: add your Firebase configuration to firebase-config.js to load and manage live projects.";
  document.getElementById("work").appendChild(note);
}

document.getElementById("contactForm").addEventListener("submit", async event => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const status = document.getElementById("contactStatus");
  const button = document.getElementById("contactSubmit");
  const form = new FormData(formElement);
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const message = String(form.get("message") || "").trim();
  if (!name || !email || !message) {
    status.textContent = "Please complete all fields before sending.";
    return;
  }

  // Netlify Forms receives the submission on the deployed site. Configure an email
  // notification in Netlify so each submission is delivered to the portfolio owner.
  button.disabled = true;
  button.textContent = "Sending…";
  status.textContent = "";
  try {
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:") {
      const subject = encodeURIComponent(`Portfolio message from ${name}`);
      const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
      window.location.href = `mailto:${encodeURIComponent(portfolioSettings.email)}?subject=${subject}&body=${body}`;
      status.textContent = "Your email app is opening with the message ready to send.";
      return;
    }
    const payload = new URLSearchParams(new FormData(formElement)).toString();
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload
    });
    if (!response.ok) throw new Error(`Netlify Forms returned ${response.status}`);
    formElement.reset();
    status.textContent = "Thanks — your message was submitted successfully. I’ll get back to you soon.";
  } catch (error) {
    console.error("Contact form submission failed:", error);
    const subject = encodeURIComponent(`Portfolio message from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    status.textContent = "Online sending failed. Opening your email app as a backup…";
    window.location.href = `mailto:${encodeURIComponent(portfolioSettings.email)}?subject=${subject}&body=${body}`;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Send message <span aria-hidden="true">→</span>';
  }
});
