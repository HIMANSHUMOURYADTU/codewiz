"use client";
import React from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import Lookup from "@/data/Lookup";
import axios from "axios";
import { MessagesContext } from "@/context/MessagesContext";
import { UserDetailContext } from "@/context/UserDetailContext";
import Prompt from "@/data/Prompt";
import { useContext } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useConvex } from "convex/react";
import { Loader } from "react-feather";
import SandPackPreviewClient from "./SandPackPreviewClient";
import { ActionContext } from "@/context/ActionContext";
import { toast } from "sonner";

const countToken = (inputText) => {
  if (!inputText) return 0;
  return inputText
    .trim()
    .split(/\s+/)
    .filter((word) => word).length;
};

const normalizeSandpackFiles = (files = {}) => {
  const normalized = { ...files };

  if (!normalized["/App.js"] && normalized["/src/App.js"]) {
    normalized["/App.js"] = normalized["/src/App.js"];
  }

  if (!normalized["/index.js"] && normalized["/src/index.js"]) {
    normalized["/index.js"] = normalized["/src/index.js"];
  }

  Object.keys(normalized).forEach((key) => {
    const file = normalized[key];
    if (!file || typeof file.code !== "string" || file.code === null || file.code === "null" || file.code.trim() === "") {
      console.warn(`Removing invalid file entry: ${key}`);
      delete normalized[key];
      return;
    }
  });

  if (!normalized["/App.js"] || !normalized["/App.js"].code.trim()) {
    normalized["/App.js"] = {
      code:
        "import React from 'react';\n" +
        "export default function App() {\n" +
        "  return (\n" +
        "    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center'>\n" +
        "      <div className='text-center space-y-3'>\n" +
        "        <h1 className='text-4xl font-bold'>Your app is loading</h1>\n" +
        "        <p className='text-slate-300'>Try generating again if the output is empty.</p>\n" +
        "      </div>\n" +
        "    </div>\n" +
        "  );\n" +
        "}\n",
    };
  }

  // Fix imports and exports across all JS/JSX files
  Object.keys(normalized).forEach((key) => {
    if (!key.endsWith(".js") && !key.endsWith(".jsx")) return;
    
    const file = normalized[key];
    if (typeof file?.code !== "string") return;

    // 1. Convert any named imports from local relative files to default imports.
    // e.g., import { Component } from './components' -> import Component from './components'
    // This fixes "got undefined" errors if the AI used named imports but default exports.
    file.code = file.code.replace(
      /import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*['"](\.[^'"]+)['"];?/g,
      "import $1 from '$2';"
    );
    
    // Remove any CSS imports since we inject Tailwind globally
    file.code = file.code.replace(/import\s+['"].*\.css['"];?\n?/g, '');

    // 2. Force Default Exports for components
    if (key !== "/App.js" && key !== "/index.js") {
      const componentName = key.split("/").pop()?.replace(/\.jsx?$/, "");
      
      if (!/export\s+default/m.test(file.code) && componentName) {
        // Try to find the exact function or const with the matching component name
        const match = file.code.match(new RegExp(`(?:const|function|class)\\s+(${componentName})\\b`, "m"));
        if (match && match[1]) {
          file.code += `\n\nexport default ${match[1]};`;
        } else {
          // If we can't find it, look for ANY function or const that starts with uppercase
          const backupMatch = file.code.match(/(?:const|function|class)\s+([A-Z][a-zA-Z0-9_]+)\b/m);
          if (backupMatch && backupMatch[1]) {
             file.code += `\n\nexport default ${backupMatch[1]};`;
          }
        }
      }
    }
  });

  if (!normalized["/index.js"]) {
    normalized["/index.js"] = {
      code:
        "import React from 'react';\n" +
        "import { createRoot } from 'react-dom/client';\n" +
        "import App from './App';\n" +
        "const root = createRoot(document.getElementById('root'));\n" +
        "root.render(<App />);\n",
    };
  }

  if (!normalized["/package.json"]) {
    normalized["/package.json"] = {
      code: JSON.stringify(
        {
          name: "react-app",
          version: "1.0.0",
          main: "/index.js",
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            "lucide-react": "^0.469.0",
            "react-router-dom": "^6.14.0",
            "react-scripts": "^5.0.0"
          },
          scripts: {
            "start": "react-scripts start",
            "build": "react-scripts build",
            "test": "react-scripts test",
            "eject": "react-scripts eject"
          }
        },
        null,
        2
      ),
    };
  }

  if (!normalized["/public/index.html"]) {
    normalized["/public/index.html"] = {
      code:
        '<!DOCTYPE html>\n' +
        '<html lang="en">\n' +
        '  <head>\n' +
        '    <meta charset="UTF-8">\n' +
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '    <script src="https://cdn.tailwindcss.com"></script>\n' +
        '    <title>React App</title>\n' +
        '  </head>\n' +
        '  <body>\n' +
        '    <div id="root"></div>\n' +
        '  </body>\n' +
        '</html>',
    };
  }

  return normalized;
};

function CodeView() {
  const convex = useConvex();
  const { id } = useParams();
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("code");
  const [files, setFiles] = React.useState(Lookup?.DEFAULT_FILE);
  const { messages, setMessages } = useContext(MessagesContext);
  const UpdateFiles = useMutation(api.workspace.UpdateFiles);
  const { userDetail, setUserDetail } = useContext(UserDetailContext);
  const UpdateTokens = useMutation(api.users.UpdateToken);
  const { action, setAction } = useContext(ActionContext);

  React.useEffect(() => {
    id && GetFiles();
  }, [id]);

  React.useEffect(() => {
    setActiveTab("preview");
  }, [action]);

  const GetFiles = async () => {
    setLoading(true);
    const result = await convex.query(api.workspace.GetWorkspaceData, {
      workspaceId: id,
    });
    const mergedFiles = { ...Lookup.DEFAULT_FILE, ...result?.fileData };
    setFiles(mergedFiles);
    setLoading(false);
  };

  React.useEffect(() => {
    if (messages?.length > 0) {
      const role = messages[messages?.length - 1].role;
      if (role === "user") {
        GenerateAiCode();
      }
    }
  }, [messages]);

  const GenerateAiCode = async () => {
    setLoading(true);
    const PROMPT = JSON.stringify(messages) + " " + Prompt.CODE_GEN_PROMPT;
    try {
      const result = await axios.post("/api/gen-ai-code", {
        prompt: PROMPT,
      });
      console.log(result.data);
      const aiResp = result.data;
      const normalizedFiles = normalizeSandpackFiles(aiResp?.files);

      const mergedFiles = { ...Lookup.DEFAULT_FILE, ...normalizedFiles };
      setFiles(mergedFiles);
      await UpdateFiles({
        workspaceId: id,
        files: normalizedFiles,
      });
      const token =
        Number(userDetail?.token) - Number(countToken(JSON.stringify(aiResp)));
      await UpdateTokens({
        userId: userDetail?._id,
        token: token,
      });
      setUserDetail((prev) => ({ ...prev, token: token }));
    } catch (error) {
      console.error("Error in GenerateAiCode:", error);
      toast.error("Failed to generate AI code. Please try again later.");
    } finally {
      setActiveTab("code");  
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="bg-[#181818] w-full p-2 border">
        <div className="flex items-center flex-wrap shrink-0 bg-black p-1 w-[140px] gap-3 justify-center rounded-full">
          <h2
            className={`text-sm cursor-pointer ${activeTab === "code" ? "text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full" : ""}`}
            onClick={() => setActiveTab("code")}
          >
            Code
          </h2>
          <h2
            className={`text-sm cursor-pointer ${activeTab === "preview" ? "text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            Preview
          </h2>
        </div>
      </div>
      <SandpackProvider
        template="react"
        theme="dark"
        files={files}
        options={{ 
          externalResources: ["https://cdn.tailwindcss.com"],
          bundlerURL: "https://sandpack-bundler.codesandbox.io",
        }}
      >
        <SandpackLayout>
          {activeTab == "code" ? (
            <>
              <SandpackFileExplorer style={{ height: "80vh" }} />
              <SandpackCodeEditor style={{ height: "80vh" }} />
            </>
          ) : (
            <>
              <SandPackPreviewClient />
            </>
          )}
        </SandpackLayout>
      </SandpackProvider>
      {loading && (
        <div className="p-10 bg-gray-900 opacity-80 absolute top-0 rounded-lg w-full h-full flex items-center justify-center">
          <Loader className="animate-spin h-10 w-10 text-white" />
          <h2 className="text-white">Generating Your Files...</h2>
        </div>
      )}
    </div>
  );
}

export default CodeView;