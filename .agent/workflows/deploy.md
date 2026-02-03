---
description: How to deploy the hostel portal to Netlify
---

### Prerequisites
- A Netlify account (free)
- Your project folder on your computer

### Option 1: Drag & Drop (Easiest)
1. Go to the [Netlify App](https://app.netlify.com/drop).
2. Drag your project folder `hostel-portal-1` and drop it into the upload box.
3. Wait for the deploy to finish. 🎉

### Option 2: Netlify CLI
1. Install Netlify CLI:
   ```bash
   npm install netlify-cli -g
   ```
2. Login to Netlify:
   ```bash
   netlify login
   ```
3. Deploy:
   ```bash
   netlify deploy --prod --dir .
   ```

### Important Settings for Netlify
Since this is a Single Page Application (SPA) style project with multiple HTML files, if you eventually use React/Vue you'd need redirects, but for this Vanilla JS project, it works out of the box!

> [!TIP]
> **Firebase Config**: Make sure your Firebase project settings allow your new Netlify domain (e.g., `your-site.netlify.app`) in the **Authentication > Settings > Authorized Domains** section.
