# Deploying Codewize to Vercel

This guide will walk you through deploying your Codewize Next.js application to Vercel, including setting up your Convex production database and Groq AI API keys.

## Prerequisites
1. A [GitHub](https://github.com/) account
2. A [Vercel](https://vercel.com/) account
3. Your Vercel account linked to your GitHub account

---

## Step 1: Push Your Code to GitHub
Vercel deploys your app directly from a GitHub repository.

1. Open your terminal in VS Code (in the `D:\Codewize` folder).
2. Run the following commands to initialize Git and push your code:
```bash
git init
git add .
git commit -m "Ready for production"
```
3. Go to GitHub and create a new public or private repository.
4. Copy the repository URL and link it to your local project, then push:
```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy your Convex Backend to Production
Right now, you are using a "Development" Convex project. You need to deploy it to "Production" so Vercel can access it globally.

1. In your VS Code terminal, run:
```bash
npx convex deploy
```
2. This will securely push your schema and functions to your production Convex environment.
3. Open the [Convex Dashboard](https://dashboard.convex.dev/).
4. Click on your project, and navigate to **Settings -> Environment Variables**.
5. Copy your Production `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` values. You will need them for Vercel.

---

## Step 3: Setup Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New... -> Project**.
3. Import the GitHub repository you created in Step 1.
4. Vercel will automatically detect that this is a **Next.js** project. Keep the default Build and Output Settings.

---

## Step 4: Configure Environment Variables
Before clicking Deploy, open the **"Environment Variables"** dropdown in the Vercel setup screen. 
Add all the variables from your local `.env.local` file. 

You MUST include at least the following:

| Name | Description / Where to get it |
| :--- | :--- |
| `NEXT_PUBLIC_CONVEX_URL` | The **Production URL** from your Convex Dashboard. |
| `CONVEX_DEPLOYMENT` | The **Production Deployment ID** from your Convex Dashboard. |
| `GROQ_API_KEY` | Your AI API Key from the [Groq Console](https://console.groq.com/keys). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Your Google Auth Client ID (if you are using Google sign in). |

*(If you have any other variables in your `.env.local` file, add them here too).*

---

## Step 5: Deploy!
1. Click the blue **Deploy** button.
2. Vercel will build your project. This takes about 1-2 minutes.
3. Once finished, you will see a screen saying "Congratulations!".
4. Click the preview image to open your live application.

---

## Step 6: Updating your App
Because Vercel is linked to your GitHub, every time you make a change in VS Code, all you have to do is push it to GitHub:
```bash
git add .
git commit -m "Update UI"
git push
```
Vercel will automatically detect the push and deploy your new updates!