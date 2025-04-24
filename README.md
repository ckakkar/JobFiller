# 🧠 JobFiller – Smart Job Application Autofiller Extension

**JobFiller** is a browser extension designed to automate and simplify the job application process. It parses resume data, maps fields to job applications, and fills them automatically, helping job seekers save time and avoid repetitive typing.

---

## 🚀 Features

- 🔍 Auto-detects form fields on job portals
- 🧾 Parses resumes using a built-in PDF reader
- 🧠 Intelligent field mapping with customizable options
- 💾 Local storage for resume data and preferences
- 📄 Popup UI for quick field mapping
- ⚙️ Options page for fine-tuned customization
- 🧩 Seamless integration as a browser extension

---

## 📂 Project Structure

jobfiller/
│
├── background.js              # Background script for handling persistent events
├── content.js                 # Injected into pages to detect and interact with forms
├── popup.html / popup.js     # UI popup shown on extension icon click
├── options.html / options.js # Extension settings interface
├── field-mapper.js            # Handles mapping between resume and form fields
├── field-mapper-page.js      # Extended field mapping UI logic
├── resume-storage.js         # LocalStorage helper for resume data
├── pdf-parser.js             # Reads and parses resume PDFs
├── pdf.min.mjs               # PDF.js library (minified)
├── pdf.worker.min.mjs        # PDF.js worker (minified)
├── icons/                    # Extension icons
├── manifest.json             # Extension metadata and permissions
├── help.html                 # Optional help page
└── field-mapper.html         # Mapping interface

---

## 📦 Installation

### 🧪 Local Development (for Chrome/Brave):

1. Clone or download the repository
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer Mode** (top-right)
4. Click **Load unpacked**
5. Select the `jobfiller/` directory

---

## 🛠️ How It Works

1. **PDF Parsing** – Resume is parsed client-side using [PDF.js](https://mozilla.github.io/pdf.js/).
2. **Field Detection** – `content.js` scans job applications for recognizable input fields.
3. **Field Mapping** – `field-mapper.js` links resume fields (e.g., Name, Email) to form inputs.
4. **Autofill** – The extension fills in the form fields using stored resume data.

---

## 📄 Requirements

- Chrome/Brave/Edge (Chromium-based browsers)
- Resume in **PDF format**
- Permissions required: `activeTab`, `storage`, `scripting`

---

## ⚙️ Customization

You can:
- Update `field-mapper.js` to add or edit mapping logic
- Modify `popup.html` for a different UI layout
- Customize `options.html` for different user preferences

---

## 🧪 Testing

To test:
- Upload a sample resume PDF in the popup interface
- Visit a job application form
- Click the extension icon → Map fields → Autofill

---

## 📦 Building for Production

Since this is a plain JS/HTML/CSS extension, no build process is required. Just zip the contents of the `jobfiller/` folder and upload to the Chrome Web Store or use it as a local extension.

---

## 📸 Screenshots

> _(Add screenshots of popup, field mapper UI, and a sample autofill on a job portal)_  
> `help.html` can be extended with a visual walkthrough.

---

## 🧑‍💻 Contributing

PRs welcome! If you want to contribute, fork the repo and submit a pull request. Feature ideas, bug reports, and UI improvements are always appreciated.

---

## 📜 License

MIT License. Feel free to use and adapt this extension for personal or commercial use.

---

## 👋 Author

**Cyrus Kakkar**  
_This project was built to streamline and automate the most tedious part of job hunting._

---

## 🗣️ Contact

For feedback or collaboration:
- Email: cyruskakkar@gmail.com