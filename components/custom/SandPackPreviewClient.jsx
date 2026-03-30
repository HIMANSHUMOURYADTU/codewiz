import React, { useEffect } from "react";
import { SandpackPreview, useSandpack } from "@codesandbox/sandpack-react";
import { ActionContext } from "@/context/ActionContext";
import { useContext } from "react";
import JSZip from "jszip";

function SandPackPreviewClient() {
  const previewRef = React.useRef();
  const { sandpack } = useSandpack();
  const { action, setAction } = useContext(ActionContext);

  useEffect(() => {
    if(action?.actionType) {
       handleAction();
    }
  }, [action]);

  const handleAction = async () => {
    if (action?.actionType === "deploy") {
      const client = previewRef.current?.getClient();
      if (client) {
        const result = await client.getCodeSandboxURL();
        // Uses the official CodeSandbox to Vercel Deploy URL
        window.open(`https://vercel.com/new/clone?s=https://codesandbox.io/s/${result?.sandboxId}`);
      }
    } else if (action?.actionType === "export") {
      try {
        const zip = new JSZip();
        
        // Add files to zip
        Object.keys(sandpack.files).forEach((filePath) => {
          const file = sandpack.files[filePath];
          if (file && typeof file.code === "string") {
            // Remove leading slash if present for valid zip paths
            const zipPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
            zip.file(zipPath, file.code);
          }
        });
        
        // Generate zip blob and trigger download
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "codewize-project.zip";
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Failed to export project: ", error);
      }
    }
  };

  return (
    <SandpackPreview
      style={{ height: "80vh" }}
      ref={previewRef}
      showNavigator
    />
  );
}

export default SandPackPreviewClient;
